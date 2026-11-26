import type { Locale } from "@/i18n/routing";
import { escapeHtml } from "@/lib/email/html";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AlertDigest } from "./compute";

const T = {
  fr: {
    subject: (a: string, n: number) => `${a} : ${n} alerte${n > 1 ? "s" : ""} aujourd'hui`,
    hello: (n: string | null) => (n ? `Bonjour ${n},` : "Bonjour,"),
    intro: "Voici ce qui demande votre attention aujourd'hui :",
    late: "Retours en retard",
    insurance: "Assurances",
    visit: "Visites techniques",
    oil: "Vidanges",
    expired: "expirée",
    inDays: (d: number) => (d === 0 ? "aujourd'hui" : `dans ${d} jour${d > 1 ? "s" : ""}`),
    oilDue: (km: number) => (km <= 0 ? `à faire (dépassée de ${-km} km)` : `dans ${km} km`),
    since: "prévu le",
    open: "Ouvrir Parcolia",
    footer: "Propulsé par Parcolia — e-mail quotidien envoyé aux responsables de l'agence. Réglage dans Paramètres › Alertes.",
  },
  ar: {
    subject: (a: string, n: number) => `${a}: ${n} تنبيه اليوم`,
    hello: (n: string | null) => (n ? `السلام عليكم ${n}،` : "السلام عليكم،"),
    intro: "إليك ما يحتاج إلى انتباهك اليوم:",
    late: "إرجاعات متأخرة",
    insurance: "التأمينات",
    visit: "الفحوصات التقنية",
    oil: "تغيير الزيت",
    expired: "منتهية",
    inDays: (d: number) => (d === 0 ? "اليوم" : `بعد ${d} يوم`),
    oilDue: (km: number) => (km <= 0 ? `مستحق (تجاوز ${-km} كلم)` : `بعد ${km} كلم`),
    since: "كان متوقعًا في",
    open: "فتح Parcolia",
    footer: "بدعم من Parcolia — رسالة يومية لمسؤولي الوكالة. الإعداد في الإعدادات › التنبيهات.",
  },
  en: {
    subject: (a: string, n: number) => `${a}: ${n} alert${n > 1 ? "s" : ""} today`,
    hello: (n: string | null) => (n ? `Hello ${n},` : "Hello,"),
    intro: "Here is what needs your attention today:",
    late: "Late returns",
    insurance: "Insurance",
    visit: "Technical inspections",
    oil: "Oil changes",
    expired: "expired",
    inDays: (d: number) => (d === 0 ? "today" : `in ${d} day${d > 1 ? "s" : ""}`),
    oilDue: (km: number) => (km <= 0 ? `due (over by ${-km} km)` : `in ${km} km`),
    since: "due on",
    open: "Open Parcolia",
    footer: "Powered by Parcolia — daily email to the agency managers. Change it in Settings › Alerts.",
  },
} as const;

/** Daily summary email (one per recipient, in their language). */
export function renderDigestEmail(
  d: AlertDigest,
  ctx: { agencyName: string; brandColor: string; appUrl: string; locale: Locale; name: string | null },
): { subject: string; html: string; text: string } {
  const t = T[ctx.locale];
  const dir = ctx.locale === "ar" ? "rtl" : "ltr";
  const count = d.insurance.length + d.visit.length + d.oil.length + d.lateReturns.length;
  const sections: Array<[string, string[]]> = [
    [t.late, d.lateReturns.map((r) => `${r.contract} · ${r.client} · ${r.car} · ${t.since} ${formatDateTime(r.endAt)}${r.phone ? ` · ${r.phone}` : ""}`)],
    [t.insurance, d.insurance.map((x) => `${x.car} · ${formatDate(x.date)} · ${x.daysLeft < 0 ? t.expired : t.inDays(x.daysLeft)}`)],
    [t.visit, d.visit.map((x) => `${x.car} · ${formatDate(x.date)} · ${x.daysLeft < 0 ? t.expired : t.inDays(x.daysLeft)}`)],
    [t.oil, d.oil.map((x) => `${x.car} · ${t.oilDue(x.kmLeft)}`)],
  ];
  const visible = sections.filter(([, lines]) => lines.length);
  const html = `<!doctype html><html lang="${ctx.locale}" dir="${dir}"><body style="margin:0;padding:24px;background:#F1F5F9;font-family:Inter,Segoe UI,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden" dir="${dir}">
<div style="height:6px;background:${ctx.brandColor}"></div>
<div style="padding:28px">
<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0F172A">${escapeHtml(ctx.agencyName)}</p>
<p style="margin:0 0 16px;color:#334155">${escapeHtml(t.hello(ctx.name))} ${escapeHtml(t.intro)}</p>
${visible
  .map(
    ([title, lines]) =>
      `<h2 style="margin:16px 0 6px;font-size:15px;color:${ctx.brandColor}">${escapeHtml(title)} (${lines.length})</h2><ul style="margin:0;padding-inline-start:18px;color:#0F172A;font-size:14px;line-height:1.6">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
  )
  .join("")}
<p style="margin:24px 0 0"><a href="${escapeHtml(ctx.appUrl)}" style="display:inline-block;background:${ctx.brandColor};color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escapeHtml(t.open)}</a></p>
<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8">${escapeHtml(t.footer)}</p>
</div></div></body></html>`;
  const text = `${ctx.agencyName}\n\n${t.hello(ctx.name)} ${t.intro}\n\n${visible.map(([title, lines]) => `${title}\n${lines.map((l) => `- ${l}`).join("\n")}`).join("\n\n")}\n\n${ctx.appUrl}\n\n${t.footer}`;
  return { subject: t.subject(ctx.agencyName, count), html, text };
}
