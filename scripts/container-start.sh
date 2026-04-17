#!/bin/sh
set -eu

log() {
  printf '%s\n' "[startup] $*"
}

log "container-start.sh booting"

if [ "${STARTUP_DEBUG:-0}" = "1" ]; then
  set -x
fi

on_exit() {
  code=$?
  if [ "$code" -ne 0 ]; then
    log "exiting with error code $code"
  fi
}

trap on_exit EXIT

BOT_PID=""
SERVER_PID=""

cleanup() {
  if [ -n "$BOT_PID" ] && kill -0 "$BOT_PID" 2>/dev/null; then
    log "Stopping Discord bot (pid $BOT_PID)"
    kill "$BOT_PID" 2>/dev/null || true
    wait "$BOT_PID" 2>/dev/null || true
  fi

  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    log "Stopping Next.js server (pid $SERVER_PID)"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM

DB_DIR="/app/db"
DB_FILE="${DB_DIR}/db.sqlite"
DB_CREATED=0

if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="file:${DB_FILE}"
fi

log "node version: $(node -v)"
log "pnpm version: $(pnpm -v)"
log "working directory: $(pwd)"

missing=""
for required_var in AUTH_SECRET NEXTAUTH_URL AUTH_DISCORD_ID AUTH_DISCORD_SECRET DISCORD_ADMIN_ID; do
  eval "value=\${$required_var:-}"
  if [ -z "$value" ]; then
    missing="$missing $required_var"
  fi
done

BOT_ENABLED=0
if [ -n "${DISCORD_BOT_TOKEN:-}" ]; then
  BOT_ENABLED=1
fi

if [ -n "$missing" ]; then
  log "Missing required environment variables:$missing"
  exit 1
fi

log "Environment looks valid"

mkdir -p "$DB_DIR"

if [ ! -f "$DB_FILE" ]; then
  log "Database file not found, creating ${DB_FILE}"
  : > "$DB_FILE"
  DB_CREATED=1
else
  log "Database file exists: ${DB_FILE}"
fi

log "Running schema sync: pnpm run db:push"
if ! pnpm run db:push; then
  log "Schema sync failed"
  exit 1
fi

if [ "$DB_CREATED" -eq 1 ]; then
  log "Fresh database detected, running production seed"
  if ! pnpm run db:seed:production; then
    log "Production seed failed"
    exit 1
  fi
fi

log "Starting Next.js standalone server"
if [ "$BOT_ENABLED" -eq 1 ]; then
  log "Starting Discord bot"
  pnpm run dev:bot &
  BOT_PID=$!
fi

node server.js &
SERVER_PID=$!

wait "$SERVER_PID"
SERVER_EXIT=$?

if [ "$BOT_ENABLED" -eq 1 ]; then
  cleanup
fi

exit "$SERVER_EXIT"