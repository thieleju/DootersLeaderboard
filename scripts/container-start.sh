#!/bin/sh
set -eu

DB_DIR="/app/db"
DB_FILE="${DB_DIR}/db.sqlite"
DB_CREATED=0

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="file:${DB_FILE}"
fi

mkdir -p "$DB_DIR"

if [ ! -f "$DB_FILE" ]; then
  echo "[startup] Database file not found, creating ${DB_FILE}"
  : > "$DB_FILE"
  DB_CREATED=1
else
  echo "[startup] Database file exists: ${DB_FILE}"
fi

echo "[startup] Running schema sync: pnpm run db:push"
pnpm run db:push

if [ "$DB_CREATED" -eq 1 ]; then
  echo "[startup] Fresh database detected, running production seed"
  pnpm run db:seed:production
fi

echo "[startup] Starting Next.js standalone server"
exec node server.js