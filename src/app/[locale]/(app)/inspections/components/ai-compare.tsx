"use client";

import { CheckIcon, LoaderIcon, SparklesIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { View } from "@/lib/inspections/model";
import { aiViewsAction, compareViewAction, updateDamageAction } from "../actions";

const wait = (s: number) => new Promise((r) => setTimeout(r, Math.min(60, s) * 1000 + 300));

/**
 * « Comparaison IA »: view after view (the free tier allows a few images per minute:
 * when the AI says "busy", wait and retry that view), then the suggestions appear
 * on the drawing for a person to confirm or remove.
 */
export function AiCompareButton({ reservationId, again }: { reservationId: string; again: boolean }) {
  const t = useTranslations("inspection.ai");
  const tv = useTranslations("inspection.views");
  const te = useTranslations("errors");
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const run = async () => {
    setStatus(t("starting"));
    try {
      const views = await aiViewsAction(reservationId);
      if (!views.ok) return void toast.error(te(views.error));
      let found = 0;
      for (let i = 0; i < views.data.length; i++) {
        const view = views.data[i] as View;
        for (let attempt = 0; attempt < 4; attempt++) {
          setStatus(t("progress", { n: i + 1, total: views.data.length, view: tv(view) }));
          const r = await compareViewAction(reservationId, view, i === views.data.length - 1);
          if (!r.ok) {
            toast.error(te(r.error));
            return;
          }
          if (r.data.retryAfter) {
            setStatus(t("waiting", { s: Math.ceil(r.data.retryAfter) }));
            await wait(r.data.retryAfter);
            continue;
          }
          found += r.data.found;
          break;
        }
      }
      toast.success(found ? t("found", { count: found }) : t("nothing"));
      router.refresh();
    } finally {
      setStatus(null);
    }
  };
  return (
    <Button type="button" variant="outline" onClick={run} disabled={status !== null} className="border-[#7c3aed]/40 text-[#6d28d9] hover:bg-[#7c3aed]/10 dark:text-[#c4b5fd]" data-testid="ai-compare">
      {status ? <LoaderIcon className="animate-spin" aria-hidden /> : <SparklesIcon aria-hidden />}
      <span aria-live="polite">{status ?? (again ? t("again") : t("button"))}</span>
    </Button>
  );
}

/** Confirm / remove one AI suggestion. */
export function ReviewSuggestion({ id, n }: { id: string; n: number }) {
  const t = useTranslations("inspection.ai");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (change: "confirm" | "remove") =>
    start(async () => {
      const r = await updateDamageAction(id, change);
      if (!r.ok) return void toast.error(te(r.error));
      toast.success(change === "confirm" ? t("confirmed") : t("removed"));
      router.refresh();
    });
  return (
    <span className="flex gap-1.5">
      <Button type="button" size="sm" onClick={() => act("confirm")} disabled={pending} aria-label={t("confirmN", { n })}>
        <CheckIcon aria-hidden />
        {t("confirm")}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => act("remove")} disabled={pending} aria-label={t("removeN", { n })}>
        <XIcon aria-hidden />
        {t("remove")}
      </Button>
    </span>
  );
}
