"use client";

import { MailIcon, MessageCircleIcon, SendIcon, ShieldCheckIcon, UserIcon, UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { inviteMemberAction } from "../actions";
import { inviteSchema, type InviteInput } from "../schema";

type FormValues = { channel: "email" | "whatsapp"; email: string; phone: string; role: "admin" | "staff" };

export function InviteDialog() {
  const t = useTranslations("team.invite");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const { writable } = useAgency();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({ defaultValues: { channel: "email", email: "", phone: "", role: "staff" } });
  const { errors } = form.formState;
  const channel = useWatch({ control: form.control, name: "channel" });
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = form.handleSubmit((v) => {
    const input: InviteInput =
      v.channel === "email" ? { channel: "email", email: v.email, role: v.role } : { channel: "whatsapp", phone: v.phone, role: v.role };
    // Same schema as the server action
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) form.setError(issue.path[0] as keyof FormValues, { message: issue.message });
      return;
    }
    startTransition(async () => {
      const result = await inviteMemberAction(input);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as keyof FormValues, { message });
        }
        if (!result.fieldErrors) toast.error(te(result.error));
        return;
      }
      if (result.data.whatsappUrl) {
        window.open(result.data.whatsappUrl, "_blank", "noopener,noreferrer");
        toast.success(t("whatsappReady"));
      } else {
        toast.success(t("emailSent", { email: v.email }));
      }
      form.reset({ channel: v.channel, email: "", phone: "", role: "staff" });
      setOpen(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" disabled={!writable}>
          <UserPlusIcon aria-hidden />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("how")}</span>
            <ChoiceChips
              name="channel"
              label={t("how")}
              value={channel}
              onChange={(v) => form.setValue("channel", v)}
              options={[
                { value: "email", label: t("byEmail"), icon: <MailIcon className="size-4" aria-hidden /> },
                { value: "whatsapp", label: t("byWhatsapp"), icon: <MessageCircleIcon className="size-4" aria-hidden /> },
              ]}
            />
          </div>

          {channel === "email" ? (
            <Field id="invite-email" label={t("email")} error={errors.email?.message}>
              <Input {...fieldAria("invite-email", errors.email?.message)} type="email" inputMode="email" autoComplete="off" {...form.register("email")} />
            </Field>
          ) : (
            <Field id="invite-phone" label={t("phone")} hint={tv("phoneHint")} error={errors.phone?.message}>
              <Input
                {...fieldAria("invite-phone", errors.phone?.message, true)}
                type="tel"
                inputMode="tel"
                dir="ltr"
                placeholder="06 12 34 56 78"
                {...form.register("phone")}
              />
            </Field>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("role")}</span>
            <ChoiceChips
              name="role"
              label={t("role")}
              value={role}
              onChange={(v) => form.setValue("role", v)}
              options={[
                { value: "staff", label: t("staffLabel"), description: t("staffHelp"), icon: <UserIcon className="size-4" aria-hidden /> },
                { value: "admin", label: t("adminLabel"), description: t("adminHelp"), icon: <ShieldCheckIcon className="size-4" aria-hidden /> },
              ]}
            />
          </div>

          <DialogFooter>
            <Button type="submit" size="lg" disabled={pending}>
              {channel === "email" ? <SendIcon aria-hidden /> : <MessageCircleIcon aria-hidden />}
              {channel === "email" ? t("sendEmail") : t("openWhatsapp")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
