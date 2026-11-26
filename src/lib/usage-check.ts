import "server-only";
import { getEmailSender } from "@/lib/email/sender";
import { escapeHtml } from "@/lib/email/html";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatUsage, usageLines, type UsageLine } from "@/lib/usage";

const LABEL: Record<UsageLine["metric"], string> = {
  database: "Base de données",
  storage: "Fichiers (logos, reçus)",
  activeUsers: "Utilisateurs actifs (30 jours)",
};

/**
 * Daily: when a Supabase metric passes 80 % or 95 % of the plan limit, email the
 * Parcolia platform admins (at most once a week per metric and level).
 */
export async function checkUsageAndWarn(): Promise<UsageLine[]> {
  const sb = createAdminClient();
  const { data } = await sb.rpc("platform_usage");
  const u = data?.[0];
  if (!u) return [];
  const lines = usageLines({ database_bytes: Number(u.database_bytes), storage_bytes: Number(u.storage_bytes), active_users_30d: u.active_users_30d });
  const hot = lines.filter((l) => l.level > 0);
  if (!hot.length) return lines;

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const { data: sent } = await sb.from("usage_alerts_sent").select("metric, level").gte("sent_on", weekAgo);
  const fresh = hot.filter((l) => !(sent ?? []).some((s) => s.metric === l.metric && s.level === l.level));
  if (!fresh.length) return lines;

  const { data: admins } = await sb.from("platform_admins").select("profile:profiles!platform_admins_user_id_fkey(email)");
  const emails = (admins ?? []).map((a) => (a.profile as { email: string | null } | null)?.email).filter((e): e is string => Boolean(e));
  if (!emails.length) return lines;

  const urgent = fresh.some((l) => l.level === 95);
  const rows = fresh.map((l) => `${LABEL[l.metric]} : ${formatUsage(l.metric, l.used)} sur ${formatUsage(l.metric, l.limit)} (${l.pct} %)`);
  const subject = `${urgent ? "Urgent — " : ""}Parcolia : Supabase approche de la limite du plan`;
  const text = `${rows.join("\n")}\n\nPassez au plan Pro de Supabase ou libérez de la place. Voir docs/DEPLOY.md, section « Limites ».`;
  const html = `<p>Bonjour,</p><p>L'utilisation de Supabase approche de la limite du plan :</p><ul>${rows.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul><p>Passez au plan Pro de Supabase ou libérez de la place (docs/DEPLOY.md, section « Limites »).</p>`;
  const sender = getEmailSender();
  for (const to of emails) await sender.send({ to, subject, html, text });
  await sb.from("usage_alerts_sent").upsert(fresh.map((l) => ({ metric: l.metric, level: l.level })), { onConflict: "metric,level,sent_on" });
  return lines;
}
