import type { Locale } from "@/i18n/routing";
import { escapeHtml } from "./html";

type Input = {
  locale: Locale;
  agencyName: string;
  agencyLogoUrl: string | null;
  brandColor: string;
  inviterName: string | null;
  role: "admin" | "staff";
  url: string;
};

const COPY = {
  fr: {
    subject: (a: string) => `${a} vous invite sur Parcolia`,
    title: (a: string) => `Rejoignez ${a}`,
    body: (inviter: string | null, a: string, role: string) =>
      `${inviter ? `${inviter} vous invite` : "Vous êtes invité(e)"} à rejoindre l'équipe de ${a} sur Parcolia, en tant que ${role}.`,
    cta: "Rejoindre l'agence",
    expires: "Ce lien est valable 7 jours.",
    roles: { admin: "administrateur", staff: "agent" },
    footer: "Propulsé par Parcolia — la gestion de votre agence de location, simplement.",
  },
  ar: {
    subject: (a: string) => `${a} تدعوك إلى Parcolia`,
    title: (a: string) => `انضم إلى ${a}`,
    body: (inviter: string | null, a: string, role: string) =>
      `${inviter ? `${inviter} يدعوك` : "أنت مدعو"} للانضمام إلى فريق ${a} على Parcolia بصفة ${role}.`,
    cta: "الانضمام إلى الوكالة",
    expires: "هذا الرابط صالح لمدة 7 أيام.",
    roles: { admin: "مسؤول", staff: "موظف" },
    footer: "بدعم من Parcolia — وكالة الكراء ديالك، ببساطة.",
  },
  en: {
    subject: (a: string) => `${a} invites you to Parcolia`,
    title: (a: string) => `Join ${a}`,
    body: (inviter: string | null, a: string, role: string) =>
      `${inviter ? `${inviter} invites you` : "You are invited"} to join the ${a} team on Parcolia as ${role}.`,
    cta: "Join the agency",
    expires: "This link is valid for 7 days.",
    roles: { admin: "an admin", staff: "staff" },
    footer: "Powered by Parcolia — your rental agency, made simple.",
  },
} as const;

/** Invitation email with the agency's logo and colour, and a Parcolia footer. */
export function renderInvitationEmail(input: Input): { subject: string; html: string; text: string } {
  const c = COPY[input.locale];
  const role = c.roles[input.role];
  const dir = input.locale === "ar" ? "rtl" : "ltr";
  const align = input.locale === "ar" ? "right" : "left";
  const agency = escapeHtml(input.agencyName);
  const body = escapeHtml(c.body(input.inviterName, input.agencyName, role));
  const url = escapeHtml(input.url);
  const logo = input.agencyLogoUrl
    ? `<img src="${escapeHtml(input.agencyLogoUrl)}" alt="${agency}" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:contain;border-radius:12px;margin:0 0 16px">`
    : `<div style="width:56px;height:56px;border-radius:12px;background:${input.brandColor};color:#fff;font-size:24px;font-weight:700;line-height:56px;text-align:center;margin:0 0 16px">${escapeHtml(input.agencyName.trim().charAt(0).toUpperCase())}</div>`;

  const html = `<!doctype html>
<html lang="${input.locale}" dir="${dir}">
  <body style="margin:0;padding:24px;background:#F1F5F9;font-family:Inter,Segoe UI,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
      <div style="height:6px;background:${input.brandColor}"></div>
      <div style="padding:32px;text-align:${align}" dir="${dir}">
        ${logo}
        <h1 style="margin:0 0 12px;font-size:22px;color:#0F172A">${escapeHtml(c.title(input.agencyName))}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#334155">${body}</p>
        <p style="margin:0 0 16px"><a href="${url}" style="display:inline-block;background:${input.brandColor};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 24px;border-radius:10px">${escapeHtml(c.cta)}</a></p>
        <p style="margin:0 0 24px;font-size:13px;color:#64748b">${escapeHtml(c.expires)}</p>
        <p style="margin:0;padding-top:16px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8">${escapeHtml(c.footer)}</p>
      </div>
    </div>
  </body>
</html>`;

  const text = `${c.title(input.agencyName)}\n\n${c.body(input.inviterName, input.agencyName, role)}\n\n${c.cta}: ${input.url}\n${c.expires}\n\n${c.footer}`;
  return { subject: c.subject(input.agencyName), html, text };
}
