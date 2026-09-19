#!/usr/bin/env bash
#
# Applies supabase/migrations to a throwaway Postgres database and runs the
# pgTAP suite in supabase/tests against it.
#
# The real workflow is `supabase db reset && supabase test db`, which needs
# Docker. This script is the Docker-free equivalent: it stands up the same
# schema on a local Postgres with a small auth shim (see
# supabase/tests/helpers/local_supabase_shim.sql) and runs the identical test
# files.
#
# Usage: scripts/db-test.sh [database-name]

set -euo pipefail

DB_NAME="${1:-finpilot_test}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL_SUPERUSER="${PSQL_SUPERUSER:-postgres}"

run_sql() {
  psql --username "$PSQL_SUPERUSER" --dbname "$1" \
    --set ON_ERROR_STOP=1 --quiet --no-psqlrc "${@:2}"
}

echo "==> Recreating database $DB_NAME"
psql --username "$PSQL_SUPERUSER" --dbname postgres --set ON_ERROR_STOP=1 --quiet \
  -c "drop database if exists $DB_NAME with (force)" \
  -c "create database $DB_NAME"

echo "==> Installing pgTAP and the local auth shim"
run_sql "$DB_NAME" -c "create extension if not exists pgtap"
run_sql "$DB_NAME" -f "$ROOT_DIR/supabase/tests/helpers/local_supabase_shim.sql"

echo "==> Applying migrations"
for migration in "$ROOT_DIR"/supabase/migrations/*.sql; do
  echo "    $(basename "$migration")"
  run_sql "$DB_NAME" -f "$migration"
done

echo "==> Running tests"
status=0
for test_file in "$ROOT_DIR"/supabase/tests/*.test.sql; do
  echo "--- $(basename "$test_file")"
  output=$(psql --username "$PSQL_SUPERUSER" --dbname "$DB_NAME" \
    --set ON_ERROR_STOP=1 --no-psqlrc --tuples-only --no-align \
    -f "$test_file" 2>&1) || status=1
  echo "$output"
  # TAP failures, and pgTAP's own "you planned N but ran M" / "failed N tests"
  # footers, which do not start with "not ok".
  if grep -qE "^not ok|^# Looks like you" <<<"$output"; then
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  echo "==> FAILED"
  exit 1
fi

echo "==> All SQL tests passed"
