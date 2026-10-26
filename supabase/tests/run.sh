#!/usr/bin/env bash
# 임시 Postgres에서 마이그레이션과 RLS 테스트를 돌린다. (postgres 16 필요)
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
D=$(mktemp -d); trap '"$BIN"/pg_ctl -D "$D/d" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
[ "$(id -u)" = 0 ] && { chown postgres "$D"; RUN="su postgres -c"; } || RUN="bash -c"
$RUN "$BIN/initdb -D $D/d >/dev/null && $BIN/pg_ctl -D $D/d -o '-p 5499 -k $D' -l $D/log -w start >/dev/null"
FILES="-f supabase/tests/stub_auth.sql"
for f in supabase/migrations/*.sql; do FILES="$FILES -f $f"; done
OUT=$($RUN "psql -h $D -p 5499 -d postgres -v ON_ERROR_STOP=1 -q -At $FILES -f supabase/tests/rls_test.sql")
echo "$OUT"
if echo "$OUT" | grep -qx 'f'; then echo "FAILED: false check"; exit 1; fi
echo "$OUT" | grep -qx 'ALL OK'
