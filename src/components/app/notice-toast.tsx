"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Shows a toast for ?notice=… (after a redirect) and cleans the URL. */
export function NoticeToast() {
  const t = useTranslations("notices");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const notice = params.get("notice");
  const denied = params.get("denied");

  useEffect(() => {
    if (!notice && !denied) return;
    if (denied) toast.error(t("denied"));
    else if (notice && t.has(notice)) toast.success(t(notice));
    const rest = new URLSearchParams(params);
    rest.delete("notice");
    rest.delete("denied");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [notice, denied, params, pathname, router, t]);

  return null;
}
