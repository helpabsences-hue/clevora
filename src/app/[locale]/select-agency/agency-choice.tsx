"use client";

import { ChevronRightIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AgencyLogo } from "@/components/app/agency-logo";
import { switchAgencyAction } from "./actions";

export function AgencyChoice({
  agencyId,
  name,
  logoUrl,
  roleLabel,
}: {
  agencyId: string;
  name: string;
  logoUrl: string | null;
  roleLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const te = useTranslations("errors");
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await switchAgencyAction(agencyId);
          if (result && !result.ok) toast.error(te(result.error));
        })
      }
      className="flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card p-3 text-start shadow-xs transition-colors hover:bg-accent disabled:opacity-60"
    >
      <AgencyLogo name={name} url={logoUrl} size={48} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-lg font-semibold">{name}</span>
        <span className="text-sm text-muted-foreground">{roleLabel}</span>
      </span>
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
    </button>
  );
}
