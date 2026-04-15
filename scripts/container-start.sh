#!/bin/sh
set -eu

echo "[startup] container-start.sh booting"

on_exit() {
  code=$?
  if [ "$code" -ne 0 ]; then
    echo "[startup] exiting with error code $code"
  fi
}

trap on_exit EXIT

DB_DIR="/app/db"
DB_FILE="${DB_DIR}/db.sqlite"
DB_CREATED=0

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="file:${DB_FILE}"
fi

missing=""
for required_var in AUTH_SECRET AUTH_DISCORD_ID AUTH_DISCORD_SECRET DISCORD_ADMIN_ID; do
  eval "value=\${$required_var:-}"
  if [ -z "$value" ]; then
    missing="$missing $required_var"
  fi
done

if [ -n "$missing" ]; then
  echo "[startup] Missing required environment variables:$missing"
  exit 1
fi

echo "[startup] Environment looks valid"

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