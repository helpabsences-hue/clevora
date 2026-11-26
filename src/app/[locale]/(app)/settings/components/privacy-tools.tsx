"use client";

import { DownloadIcon, SearchIcon, UserXIcon, UsersRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Ltr } from "@/components/app/ltr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { anonymizeClientAction, anonymizeOldClientsAction, oldClientsCountAction, searchClientsAction, type ClientHit } from "../actions";

/** Loi 09-08: a client's data on request (export / anonymize) and retention. */
export function PrivacyTools() {
  const t = useTranslations("settings.privacy");
  const te = useTranslations("errors");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ClientHit[] | null>(null);
  const [target, setTarget] = useState<ClientHit | null>(null);
  const [years, setYears] = useState(5);
  const [oldCount, setOldCount] = useState<number | null>(null);
  const [confirmOld, setConfirmOld] = useState(false);
  const [pending, startTransition] = useTransition();

  const search = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await searchClientsAction(q);
      if (r.ok) setHits(r.data);
      else toast.error(te(r.error));
    });
  };
  const anonymize = () =>
    startTransition(async () => {
      if (!target) return;
      const r = await anonymizeClientAction(target.id);
      setTarget(null);
      if (!r.ok) {
        toast.error(te(r.error));
        return;
      }
      toast.success(t("anonymized"));
      setHits((h) => h?.map((x) => (x.id === target.id ? { ...x, full_name: "Client anonymisé", phone: null, anonymized: true } : x)) ?? null);
    });
  const count = () =>
    startTransition(async () => {
      const r = await oldClientsCountAction(years);
      if (r.ok) setOldCount(r.data);
      else toast.error(te(r.error));
    });
  const runRetention = () =>
    startTransition(async () => {
      const r = await anonymizeOldClientsAction(years);
      setConfirmOld(false);
      if (!r.ok) {
        toast.error(te(r.error));
        return;
      }
      toast.success(t("retentionDone", { count: r.data }));
      setOldCount(0);
    });

  return (
    <section aria-labelledby="privacy-title" className="flex flex-col gap-4 rounded-xl border p-4" data-testid="privacy-tools">
      <div>
        <h3 id="privacy-title" className="font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("intro")}{" "}
          <Link href="/privacy" className="font-medium underline underline-offset-4">{t("policyLink")}</Link>
        </p>
      </div>

      <form onSubmit={search} className="flex gap-2">
        <label htmlFor="privacy-q" className="sr-only">{t("search")}</label>
        <Input id="privacy-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
        <Button type="submit" variant="outline" disabled={pending || q.trim().length < 2}>
          <SearchIcon aria-hidden />
          {t("find")}
        </Button>
      </form>
      {hits ? (
        hits.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noClient")}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border" data-testid="privacy-hits">
            {hits.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{c.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    <Ltr>{c.id_number}</Ltr> · {t("rentals", { count: c.rentals })}
                  </span>
                </span>
                {c.anonymized ? (
                  <Badge variant="neutral">{t("isAnonymized")}</Badge>
                ) : (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/clients/${c.id}/export`} download>
                        <DownloadIcon aria-hidden />
                        {t("export")}
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setTarget(c)}>
                      <UserXIcon aria-hidden />
                      {t("anonymize")}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}

      <div className="flex flex-col gap-2 border-t pt-4">
        <h4 className="font-semibold">{t("retentionTitle")}</h4>
        <p className="text-sm text-muted-foreground">{t("retentionBody")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="privacy-years" className="text-sm">{t("years")}</label>
          <select id="privacy-years" value={years} onChange={(e) => { setYears(Number(e.target.value)); setOldCount(null); }} className="h-11 rounded-lg border border-input bg-card px-3 text-base">
            {[2, 3, 5, 10].map((y) => <option key={y} value={y}>{t("yearsValue", { count: y })}</option>)}
          </select>
          <Button variant="outline" onClick={count} disabled={pending}>
            <UsersRoundIcon aria-hidden />
            {t("countOld")}
          </Button>
          {oldCount !== null ? (
            oldCount > 0 ? (
              <Button variant="destructive" onClick={() => setConfirmOld(true)} disabled={pending}>
                <UserXIcon aria-hidden />
                {t("anonymizeOld", { count: oldCount })}
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">{t("noOld")}</span>
            )
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={t("confirmTitle")}
        description={t("confirmBody", { name: target?.full_name ?? "" })}
        confirmLabel={t("anonymize")}
        confirmIcon={<UserXIcon aria-hidden />}
        destructive
        pending={pending}
        onConfirm={anonymize}
      />
      <ConfirmDialog
        open={confirmOld}
        onOpenChange={setConfirmOld}
        title={t("confirmOldTitle", { count: oldCount ?? 0 })}
        description={t("confirmOldBody")}
        confirmLabel={t("anonymizeOld", { count: oldCount ?? 0 })}
        confirmIcon={<UserXIcon aria-hidden />}
        destructive
        pending={pending}
        onConfirm={runRetention}
      />
    </section>
  );
}
