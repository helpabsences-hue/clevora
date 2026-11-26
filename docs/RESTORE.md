# Backups and restore

Parcolia has two layers of backups.

| What | Where | Kept |
|---|---|---|
| Supabase daily backups (Pro plan and above; point-in-time recovery as an add-on) | Supabase dashboard › Database › Backups | 7 days (Pro) |
| Nightly encrypted dump (`.github/workflows/backup.yml`) | GitHub › Actions › "Database backup" › artifacts | 30 days |

Files in Storage (agency logos, charge receipts) are **not** in the SQL dump. Logos can be uploaded again; for receipts, enable Supabase's storage backups or copy the buckets regularly (`supabase storage cp -r ss:///agency-docs ./agency-docs --experimental`).

## One-time setup of the nightly dump

1. Supabase dashboard › **Connect** › copy the **Session pooler** connection string (with the database password).
2. GitHub › repository › Settings › Secrets and variables › Actions › **New repository secret**:
   - `SUPABASE_DB_URL` = that connection string
   - `BACKUP_PASSPHRASE` = a long random passphrase. **Write it down somewhere safe offline**: without it the backups cannot be opened.
3. Actions › "Database backup" › **Run workflow** once, and check that an artifact appears.

## Restore a nightly dump

Never restore over the production database without a reason: restore into a **new** Supabase project first and check it.

1. Download the artifact (`parcolia-db-YYYYMMDD-HHMM.tar.gz.gpg`) from GitHub › Actions.
2. Decrypt and unpack:
   ```bash
   gpg --decrypt parcolia-db-YYYYMMDD-HHMM.tar.gz.gpg > backup.tar.gz
   tar xzf backup.tar.gz
   ```
3. Create a new Supabase project, then restore into it (connection string of the **new** project):
   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file backup/roles.sql --file backup/schema.sql \
     --command 'SET session_replication_role = replica' \
     --file backup/data.sql \
     --dbname "postgresql://postgres.[NEW-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
   ```
4. Check: log in with a test account against the new project, look at a few agencies, contracts and statistics.
5. To switch production to the restored project: update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` on Vercel and redeploy.

## Restore from Supabase's own backups

Dashboard › Database › Backups › choose a day › **Restore**. This replaces the current database of that project (the app is unavailable for a few minutes). With point-in-time recovery you can choose the exact minute.

## Test it

Restore the latest nightly dump into a scratch project **once every three months** and write the date here:

| Date | Who | Result |
|---|---|---|
| | | |
