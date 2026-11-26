#!/usr/bin/env bash
# Generate TypeScript types for the database into src/types/database.ts.
#
#   npm run db:types                      # from the local Supabase (npx supabase start)
#   DB_URL=postgresql://... npm run db:types
#   npx supabase gen types typescript --local > src/types/database.ts   # with Docker
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
OUT="$ROOT/src/types/database.ts"

mkdir -p "$(dirname "$OUT")"
npx supabase gen types typescript --remote="$DB_URL" --schema public > "$OUT"
npx --yes oxfmt "$OUT" > /dev/null
echo "✔ Types written to src/types/database.ts"
