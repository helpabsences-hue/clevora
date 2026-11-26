#!/usr/bin/env bash
# Writes .env.local for CI from the local Supabase started by `supabase start`.
# Test-only values: nothing here is a real secret.
set -euo pipefail
eval "$(npx supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
OUT="${OUT:-.env.local}"
cat > "$OUT" <<ENV
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SMTP_HOST=127.0.0.1
SMTP_PORT=54325
SMTP_SECURE=false
EMAIL_FROM="Parcolia <no-reply@parcolia.ma>"
CRON_SECRET=ci-cron-secret
ENV
echo "$OUT written for CI"
