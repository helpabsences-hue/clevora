"use client";

import { SaveIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SearchBar } from "@/components/app/search-bar";
import { StickyActionBar, Stepper } from "@/components/app/stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { DateField, MoneyField, PhoneField, PlateField, TimeField } from "@/components/ui/fields";
import { YesNo, YesNoRow } from "@/components/ui/yes-no";

export function DevInteractive() {
  const [step, setStep] = useState(1);
  const [delivery, setDelivery] = useState<boolean | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean | null>>({ spare: true, jack: null });
  const [date, setDate] = useState("2026-11-12");
  const [time, setTime] = useState("10:00");
  const [money, setMoney] = useState<number | null>(1250);
  const [plate, setPlate] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState<string>("panne");
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">SearchBar</h2>
        <SearchBar
          placeholder="Contrat, matricule, client, CIN, téléphone"
          filters={["Toutes", "Disponibles", "En location", "Maintenance"].map((f, i) => (
            <Button key={f} size="sm" variant={i === 0 ? "default" : "outline"}>
              {f}
            </Button>
          ))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Stepper · StickyActionBar</h2>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4 sm:pt-6">
            <Stepper steps={["Dates et voiture", "Client", "Prix", "Départ"]} current={step} counterLabel={`Étape ${step + 1} sur 4`} onStepClick={setStep} />
            <StickyActionBar className="sm:static">
              <Button variant="outline" size="lg" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Retour
              </Button>
              <Button size="lg" className="flex-1 sm:flex-none" onClick={() => setStep((s) => Math.min(3, s + 1))}>
                Continuer
              </Button>
            </StickyActionBar>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Champs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="dev-date" label="Date de départ"><DateField id="dev-date" value={date} onChange={setDate} /></Field>
            <Field id="dev-time" label="Heure"><TimeField id="dev-time" value={time} onChange={setTime} /></Field>
            <Field id="dev-money" label="Prix par jour"><MoneyField id="dev-money" value={money} onChange={setMoney} /></Field>
            <Field id="dev-plate" label="Matricule"><PlateField id="dev-plate" value={plate} onChange={setPlate} /></Field>
            <Field id="dev-phone" label="Téléphone" className="sm:col-span-2"><PhoneField id="dev-phone" value={phone} onChange={setPhone} /></Field>
            <Field id="dev-error" label="Champ avec erreur" error="required" className="sm:col-span-2"><PlateField id="dev-error" value="" onChange={() => undefined} aria-invalid /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Oui / Non · Choix</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Livraison ?</span>
              <YesNo label="Livraison ?" value={delivery} onChange={setDelivery} />
            </div>
            <div>
              <YesNoRow label="Roue de secours" value={checks.spare} onChange={(v) => setChecks((c) => ({ ...c, spare: v }))} />
              <YesNoRow label="Cric" value={checks.jack} onChange={(v) => setChecks((c) => ({ ...c, jack: v }))} />
            </div>
            <ChoiceChips
              name="reason"
              label="Motif"
              value={reason}
              onChange={setReason}
              className="grid-cols-2 sm:grid-cols-3"
              options={["panne", "accident", "carrosserie", "pneus", "entretien", "autre"].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => toast.success("Modifications enregistrées.")}>
                <SaveIcon aria-hidden />
                Toast
              </Button>
              <Button variant="destructive" onClick={() => setConfirm(true)}>
                <Trash2Icon aria-hidden />
                Confirmer
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Supprimer cette voiture ?"
        description="Elle disparaîtra du parc. Les réservations passées sont conservées."
        confirmLabel="Supprimer"
        confirmIcon={<Trash2Icon aria-hidden />}
        destructive
        onConfirm={() => setConfirm(false)}
      />
    </>
  );
}
