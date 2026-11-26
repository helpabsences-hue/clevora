#!/usr/bin/env bash
# Run the database tests WITHOUT Docker, on a plain local Postgres
# (needs: postgresql 15+ with pgvector and pgtap, plus pg_prove).
#
#   npm run db:test
#
# Steps: recreate the test database, apply the Supabase stand-in
# (scripts/db/supabase-shim.sql), every migration in order, seed.sql, then run
# supabase/tests/database/*.test.sql with pg_prove.
#
# With Docker available, the same test files run against a real local Supabase:
#   npx supabase start && npx supabase test db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${PARCOLIA_TEST_DB:-parcolia_test}"
run_psql() { psql -X -v ON_ERROR_STOP=1 -q "$@"; }

echo "▶ Recreating database $DB"
run_psql -d postgres -c "drop database if exists $DB with (force);"
run_psql -d postgres -c "create database $DB;"

echo "▶ Supabase stand-in (auth, storage, roles)"
run_psql -d "$DB" -f "$ROOT/scripts/db/supabase-shim.sql"

echo "▶ Migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   - $(basename "$f")"
  run_psql -d "$DB" -f "$f"
done

echo "▶ Seed"
run_psql -d "$DB" -f "$ROOT/supabase/seed.sql"

echo "▶ Tests"
pg_prove -d "$DB" --ext .sql "$ROOT/supabase/tests/database"
