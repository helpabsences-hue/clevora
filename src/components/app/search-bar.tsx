"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Search box synced with ?q= (debounced), plus optional filters that wrap
 * onto a second line on phones.
 */
export function SearchBar({
  placeholder,
  param = "q",
  filters,
}: {
  placeholder: string;
  param?: string;
  filters?: ReactNode;
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const push = (next: string) => {
    const sp = new URLSearchParams(params);
    if (next) sp.set(param, next);
    else sp.delete(param);
    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute start-3 top-3 size-5 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          role="searchbox"
          aria-label={placeholder}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => push(v.trim()), 300);
          }}
          className="ps-10 pe-11 [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              push("");
            }}
            className="absolute end-0 top-0 inline-flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={t("clearSearch")}
          >
            <XIcon className="size-5" />
          </button>
        ) : null}
      </div>
      {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
    </div>
  );
}
