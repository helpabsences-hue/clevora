import { CarFrontIcon, ClipboardCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CarDiagram } from "@/components/app/car-diagram";
import { Ltr } from "@/components/app/ltr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import type { KnownDamages } from "../../inspections/queries";

/** The car's damages as last seen (its last finished inspection): Parc auto › car. */
export async function KnownDamagesCard({ known }: { known: KnownDamages | null }) {
  const t = await getTranslations("inspection");
  return (
    <Card data-testid="known-damages">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CarFrontIcon className="size-5 text-muted-foreground" aria-hidden />
          {t("knownTitle")}
        </CardTitle>
        {known ? (
          <p className="text-sm text-muted-foreground">
            {t("knownFrom", { number: known.contractNumber })} <Ltr>{formatDate(known.completedAt)}</Ltr>
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {!known ? (
          <p className="text-sm text-muted-foreground">{t("knownEmpty")}</p>
        ) : (
          <div className="grid items-start gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
            <CarDiagram
              label={t("diagramLabel")}
              className="max-w-[140px] justify-self-center"
              marks={known.damages.map((d, i) => ({ id: d.id, x: d.x, y: d.y, label: String(i + 1), tone: "existing", title: d.note ?? t(`types.${d.type}`) }))}
            />
            <div className="flex min-w-0 flex-col gap-3">
              {known.damages.length ? (
                <ol className="flex flex-col gap-1.5 text-sm">
                  {known.damages.map((d, i) => (
                    <li key={d.id} className="flex items-start gap-2">
                      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted-foreground text-xs font-bold text-white">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="font-medium">{t(`types.${d.type}`)}</span>
                        {d.view ? ` · ${t(`views.${d.view}`)}` : ""}
                        {d.note ? <span className="block truncate text-xs text-muted-foreground">{d.note}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">{t("knownNone")}</p>
              )}
              <Button variant="outline" asChild className="self-start">
                <Link href={`/inspections/${known.reservationId}`}>
                  <ClipboardCheckIcon aria-hidden />
                  {t("knownOpen")}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
