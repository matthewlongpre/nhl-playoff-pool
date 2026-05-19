#!/usr/bin/env bash
# Manually ingest + materialize + update projections for a given date.
# Defaults to today. Reads .env.local for DB credentials.
#
# Usage:
#   npm run pool:ingest              # today
#   npm run pool:ingest -- 2026-05-17  # specific date
set -euo pipefail

DATE=${1:-$(date +%Y-%m-%d)}
PORT=3099

echo "▶ pool ingest for $DATE"

# Start dev server with open ingest auth
ALLOW_UNAUTHENTICATED_POOL_INGEST=true npx next dev --port "$PORT" \
  --turbopack 2>&1 | grep -v "^$" &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Poll until the health endpoint responds
echo "  waiting for dev server..."
until curl -sf "http://localhost:$PORT/api/pool/internal/ingest-daily" > /dev/null 2>&1; do
  sleep 1
done
echo "  server ready"

# POST ingest + materialize for the given date
RESULT=$(curl -sf -X POST "http://localhost:$PORT/api/pool/internal/reingest" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$DATE\"}")

echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"

# Surface any error
if echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('ok') else 1)" 2>/dev/null; then
  echo "✓ ingest complete"
else
  echo "✗ ingest failed" >&2
  exit 1
fi
