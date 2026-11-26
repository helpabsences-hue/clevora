"use client";

import { MailIcon, MessageCircleIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhone } from "@/lib/phone";
import { cancelInvitationAction, resendInvitationAction } from "../actions";
import type { PendingInvitation } from "../queries";

export function InvitationList({ invitations }: { invitations: PendingInvitation[] }) {
  const t = useTranslations("team.invitations");
  if (!invitations.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y" data-testid="invitation-list">
          {invitations.map((i) => (
            <InvitationRow key={i.id} invitation={i} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function InvitationRow({ invitation }: { invitation: PendingInvitation }) {
  const t = useTranslations("team.invitations");
  const tr = useTranslations("roles");
  const te = useTranslations("errors");
  const format = useFormatter();
  const { writable } = useAgency();
  const [pending, startTransition] = useTransition();
  const target = invitation.email ?? formatPhone(invitation.phone);

  const resend = () =>
    startTransition(async () => {
      const result = await resendInvitationAction(invitation.id);
      if (!result.ok) return void toast.error(te(result.error));
      if (result.data.whatsappUrl) window.open(result.data.whatsappUrl, "_blank", "noopener,noreferrer");
      toast.success(t("resent"));
    });
  const cancel = () =>
    startTransition(async () => {
      const result = await cancelInvitationAction(invitation.id);
      if (result.ok) toast.success(t("cancelled"));
      else toast.error(te(result.error));
    });

  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          {invitation.email ? <MailIcon className="size-5" /> : <MessageCircleIcon className="size-5" />}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-full self-start truncate font-semibold" dir="ltr">
            {target}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="neutral">{tr(invitation.role)}</Badge>
            {invitation.expired ? (
              <Badge variant="danger">{t("expired")}</Badge>
            ) : (
              <Badge variant="info">{t("expires", { date: format.dateTime(new Date(invitation.expiresAt), { day: "2-digit", month: "2-digit", year: "numeric" }) })}</Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={resend} disabled={pending || !writable}>
          <RotateCwIcon aria-hidden />
          {t("resend")}
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 sm:flex-none" onClick={cancel} disabled={pending || !writable}>
          <XIcon aria-hidden />
          {t("cancel")}
        </Button>
      </div>
    </li>
  );
}
