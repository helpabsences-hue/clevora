"use client";

import { MoreVerticalIcon, PowerIcon, PowerOffIcon, ShieldCheckIcon, Trash2Icon, UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAgency } from "@/components/app/agency-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/action-result";
import { formatPhone } from "@/lib/phone";
import { changeRoleAction, removeMemberAction, setMemberStatusAction } from "../actions";
import type { TeamMember } from "../queries";

export function MemberList({
  members,
  currentUserId,
  activeAdmins,
}: {
  members: TeamMember[];
  currentUserId: string;
  activeAdmins: number;
}) {
  const t = useTranslations("team.members");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y" data-testid="member-list">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isMe={m.userId === currentUserId}
              isLastAdmin={m.role === "admin" && m.status === "active" && activeAdmins <= 1}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MemberRow({ member, isMe, isLastAdmin }: { member: TeamMember; isMe: boolean; isLastAdmin: boolean }) {
  const t = useTranslations("team.members");
  const tr = useTranslations("roles");
  const te = useTranslations("errors");
  const tn = useTranslations("notices");
  const { writable } = useAgency();
  const [pending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const name = member.fullName || member.email || "—";

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(tn("saved"));
      else toast.error(te(result.error));
      setConfirmRemove(false);
    });

  // Actions are hidden for yourself and for the last admin (the database refuses them anyway).
  const canManage = writable && !isMe;
  const canDowngrade = canManage && !isLastAdmin;

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" data-testid="member-row">
      <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-bold">
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-semibold">{name}</span>
          {isMe ? <Badge variant="neutral">{t("you")}</Badge> : null}
        </div>
        <span className="max-w-full self-start truncate text-sm text-muted-foreground" dir="ltr">
          {[member.email, formatPhone(member.phone)].filter(Boolean).join(" · ")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={member.role === "admin" ? "info" : "neutral"}>
            {member.role === "admin" ? <ShieldCheckIcon aria-hidden /> : <UserIcon aria-hidden />}
            {tr(member.role)}
          </Badge>
          <Badge variant={member.status === "active" ? "success" : "warning"}>{t(`status.${member.status}`)}</Badge>
        </div>
      </div>
      {canManage ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("actionsFor", { name })} disabled={pending}>
              <MoreVerticalIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {member.role === "staff" ? (
              <DropdownMenuItem onSelect={() => run(() => changeRoleAction(member.id, "admin"))}>
                <ShieldCheckIcon aria-hidden />
                {t("makeAdmin")}
              </DropdownMenuItem>
            ) : canDowngrade ? (
              <DropdownMenuItem onSelect={() => run(() => changeRoleAction(member.id, "staff"))}>
                <UserIcon aria-hidden />
                {t("makeStaff")}
              </DropdownMenuItem>
            ) : null}
            {member.status === "active" ? (
              canDowngrade ? (
                <DropdownMenuItem onSelect={() => run(() => setMemberStatusAction(member.id, "disabled"))}>
                  <PowerOffIcon aria-hidden />
                  {t("disable")}
                </DropdownMenuItem>
              ) : null
            ) : (
              <DropdownMenuItem onSelect={() => run(() => setMemberStatusAction(member.id, "active"))}>
                <PowerIcon aria-hidden />
                {t("enable")}
              </DropdownMenuItem>
            )}
            {canDowngrade ? (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmRemove(true)}>
                <Trash2Icon aria-hidden />
                {t("remove")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t("removeTitle", { name })}
        description={t("removeBody")}
        confirmLabel={t("remove")}
        confirmIcon={<Trash2Icon aria-hidden />}
        destructive
        pending={pending}
        onConfirm={() => run(() => removeMemberAction(member.id))}
      />
    </li>
  );
}
