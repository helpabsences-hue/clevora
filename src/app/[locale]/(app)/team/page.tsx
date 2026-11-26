import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { InvitationList } from "./components/invitation-list";
import { InviteDialog } from "./components/invite-dialog";
import { MemberList } from "./components/member-list";
import { getTeam } from "./queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("team");
  return { title: t("title") };
}

/** Équipe — admins only (staff are sent back to Aujourd'hui; RLS also refuses). */
export default async function TeamPage() {
  const { user, agency } = await requireRole(["admin"]);
  const t = await getTranslations("team");
  const supabase = await createClient();
  const { members, invitations } = await getTeam(supabase, agency.id);
  const activeAdmins = members.filter((m) => m.role === "admin" && m.status === "active").length;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { count: members.length })} action={<InviteDialog />} />
      <div className="flex flex-col gap-6">
        <MemberList members={members} currentUserId={user.id} activeAdmins={activeAdmins} />
        <InvitationList invitations={invitations} />
      </div>
    </>
  );
}
