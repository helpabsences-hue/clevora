# Daily alerts

Every morning each agency receives one summary (late returns, insurance and
technical visit ending soon, oil changes due) sent to the roles chosen in
Paramètres › Alertes (`agencies.alert_roles`, admins by default), in each
person's language.

- Logic: `src/app/api/cron/daily-alerts/route.ts` (uses `src/lib/alerts/*`).
- Protected by `Authorization: Bearer $CRON_SECRET`; sends at most once per
  agency per day (`agencies.alerts_sent_on`). `?force=1` resends, `?agency=<id>`
  limits to one agency.
- Channels: `AlertChannel` interface in `src/lib/alerts/channels.ts`. Email is
  implemented (SMTP → Resend in production). A WhatsApp channel can be added
  later by implementing the same interface.

## Scheduling (pick one)

**Vercel Cron** (already configured in `vercel.json`, 07:00 UTC ≈ 08:00 in
Casablanca). Set `CRON_SECRET` in the Vercel project: Vercel sends it automatically.

**Supabase Cron** (if you prefer the schedule to live in Supabase): enable the
`pg_cron` and `pg_net` extensions, store the app URL and secret in Vault, then:

```sql
select cron.schedule('parcolia-daily-alerts', '0 7 * * *', $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/daily-alerts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
  );
$$);
```

Use only one of the two, otherwise the second call is simply skipped
("already_sent").
