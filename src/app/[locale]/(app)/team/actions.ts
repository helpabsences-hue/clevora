"use server";

import { rateLimit } from "@/lib/rate-limit";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { localizedPath, type Locale } from "@/i18n/routing";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { dbErrorKey, requireActionContext, type ActionContext } from "@/lib/auth/action";
import { getProfile } from "@/lib/auth/session";
import { renderInvitationEmail } from "@/lib/email/invitation";
import { getEmailSender } from "@/lib/email/sender";
import { siteUrl } from "@/lib/env";
import { whatsappNumber } from "@/lib/phone";
import { newInvitationToken } from "@/lib/tokens";
import { idField, inviteSchema, roleField, type InviteInput } from "./schema";

type InviteResult = ActionResult<{ whatsappUrl: string | null }>;

const INVITE_DAYS = 7;

function inviteUrl(token: string, locale: Locale): string {
  return siteUrl(localizedPath(`/invite/${token}`, locale));
}

async function sendInviteEmail(ctx: ActionContext, to: string, role: "admin" | "staff", token: string, locale: Locale) {
  const profile = await getProfile();
  const email = renderInvitationEmail({
    locale,
    agencyName: ctx.agency.name,
    agencyLogoUrl: ctx.agency.logoUrl,
    brandColor: ctx.agency.brandColor,
    inviterName: profile?.fullName ?? null,
    role,
    url: inviteUrl(token, locale),
  });
  await getEmailSender().send({ to, ...email });
}

const WHATSAPP_TEXT: Record<Locale, (agency: string, url: string) => string> = {
  fr: (a, u) => `Bonjour ! ${a} vous invite à rejoindre son équipe sur Parcolia. Ouvrez ce lien pour créer votre accès : ${u}`,
  ar: (a, u) => `السلام عليكم! ${a} تدعوك للانضمام إلى فريقها على Parcolia. افتح هذا الرابط لإنشاء حسابك: ${u}`,
  en: (a, u) => `Hello! ${a} invites you to join its team on Parcolia. Open this link to create your access: ${u}`,
};

function whatsappLink(phone: string, agency: string, token: string, locale: Locale): string {
  return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(WHATSAPP_TEXT[locale](agency, inviteUrl(token, locale)))}`;
}

function done(): void {
  revalidatePath("/[locale]/team", "page");
}

export async function inviteMemberAction(input: InviteInput): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return fail("invalidForm", zodFieldErrors(parsed.error.issues));
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { ctx } = guard;
  const { supabase, agency, user } = ctx;
  if (!(await rateLimit("invite", agency.id))) return fail("tooManyRequests");
  const locale = (await getLocale()) as Locale;
  const v = parsed.data;

  if (v.channel === "email") {
    // Already in the team?
    const { data: existing } = await supabase
      .from("agency_members")
      .select("id, profile:profiles!agency_members_user_id_fkey!inner(email)")
      .eq("agency_id", agency.id)
      .eq("profile.email", v.email)
      .limit(1);
    if (existing?.length) return fail("alreadyMember", { email: "alreadyMember" });
    // One pending invitation per address: replace the old one.
    await supabase.from("invitations").delete().eq("agency_id", agency.id).eq("email", v.email).is("accepted_at", null);
  } else {
    await supabase.from("invitations").delete().eq("agency_id", agency.id).eq("phone", v.phone).is("accepted_at", null);
  }

  const { token, hash } = newInvitationToken();
  const { data: invitation, error } = await supabase
    .from("invitations")
    .insert({
      agency_id: agency.id,
      email: v.channel === "email" ? v.email : null,
      phone: v.channel === "whatsapp" ? v.phone : null,
      role: v.role,
      token_hash: hash,
      invited_by: user.id,
      expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !invitation) return fail(dbErrorKey(error));

  if (v.channel === "email") {
    try {
      await sendInviteEmail(ctx, v.email, v.role, token, locale);
    } catch {
      await supabase.from("invitations").delete().eq("id", invitation.id);
      return fail("emailFailed");
    }
    done();
    return ok({ whatsappUrl: null });
  }

  done();
  return ok({ whatsappUrl: whatsappLink(v.phone, agency.name, token, locale) });
}

export async function resendInvitationAction(invitationId: string): Promise<InviteResult> {
  if (!idField.safeParse(invitationId).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { ctx } = guard;
  const locale = (await getLocale()) as Locale;

  const { token, hash } = newInvitationToken();
  const { data: invitation, error } = await ctx.supabase
    .from("invitations")
    .update({ token_hash: hash, expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString() })
    .eq("id", invitationId)
    .eq("agency_id", ctx.agency.id)
    .is("accepted_at", null)
    .select("email, phone, role")
    .maybeSingle();
  if (error || !invitation) return fail(error ? dbErrorKey(error) : "notFound");

  if (invitation.email) {
    try {
      await sendInviteEmail(ctx, invitation.email, invitation.role as "admin" | "staff", token, locale);
    } catch {
      return fail("emailFailed");
    }
    done();
    return ok({ whatsappUrl: null });
  }
  done();
  return ok({ whatsappUrl: invitation.phone ? whatsappLink(invitation.phone, ctx.agency.name, token, locale) : null });
}

export async function cancelInvitationAction(invitationId: string): Promise<ActionResult> {
  if (!idField.safeParse(invitationId).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { error } = await guard.ctx.supabase
    .from("invitations")
    .delete()
    .eq("id", invitationId)
    .eq("agency_id", guard.ctx.agency.id);
  if (error) return fail(dbErrorKey(error));
  done();
  return ok();
}

/** Updates one member of the active agency; "no row changed" means not allowed. */
async function updateMember(memberId: string, patch: { role?: "admin" | "staff"; status?: "active" | "disabled" }): Promise<ActionResult> {
  if (!idField.safeParse(memberId).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase
    .from("agency_members")
    .update(patch)
    .eq("id", memberId)
    .eq("agency_id", guard.ctx.agency.id)
    .select("id");
  if (error) return fail(error.message.includes("propre") ? "selfChange" : dbErrorKey(error));
  if (!data?.length) return fail("forbidden");
  done();
  return ok();
}

export async function changeRoleAction(memberId: string, role: string): Promise<ActionResult> {
  const parsed = roleField.safeParse(role);
  if (!parsed.success) return fail("invalidForm");
  return updateMember(memberId, { role: parsed.data });
}

export async function setMemberStatusAction(memberId: string, status: "active" | "disabled"): Promise<ActionResult> {
  if (status !== "active" && status !== "disabled") return fail("invalidForm");
  return updateMember(memberId, { status });
}

export async function removeMemberAction(memberId: string): Promise<ActionResult> {
  if (!idField.safeParse(memberId).success) return fail("forbidden");
  const guard = await requireActionContext({ roles: ["admin"] });
  if (!guard.ok) return guard;
  const { data, error } = await guard.ctx.supabase
    .from("agency_members")
    .delete()
    .eq("id", memberId)
    .eq("agency_id", guard.ctx.agency.id)
    .neq("user_id", guard.ctx.user.id)
    .select("id");
  if (error) return fail(dbErrorKey(error));
  if (!data?.length) return fail("forbidden");
  done();
  return ok();
}
