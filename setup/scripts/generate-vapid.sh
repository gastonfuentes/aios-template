#!/usr/bin/env bash
# generate-vapid.sh — genera VAPID keys para PWA push notifications.
# Idempotente: verifica si ya existen en .env antes de regenerar (preserva subscriptions vivas).

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
DAEMON_ENV="$PROJECT_ROOT/agent-server/.env"
MC_ENV="$PROJECT_ROOT/mission-control/.env.local"

echo "[AIOS-Template] Starting generate-vapid.sh..."

# 1. Check si VAPID keys ya existen
if grep -q "^VAPID_PUBLIC_KEY=" "$DAEMON_ENV" 2>/dev/null && grep -q "^VAPID_PRIVATE_KEY=" "$DAEMON_ENV" 2>/dev/null; then
  echo "✓ VAPID keys ya sembradas en $DAEMON_ENV — NO regenero (preservaría subscriptions PWA vivas)."
  exit 0
fi

# 2. Generar via web-push (asume agent-server/node_modules ya instalado)
echo "→ Generando VAPID keys via web-push..."
cd "$PROJECT_ROOT/agent-server"
KEYS=$(npx web-push generate-vapid-keys --json)
PUBLIC_KEY=$(echo "$KEYS" | grep -oE '"publicKey":"[^"]+"' | cut -d'"' -f4)
PRIVATE_KEY=$(echo "$KEYS" | grep -oE '"privateKey":"[^"]+"' | cut -d'"' -f4)
VAPID_EMAIL="${VAPID_EMAIL:-your-email@example.com}"

if [[ -z "$PUBLIC_KEY" || -z "$PRIVATE_KEY" ]]; then
  echo "❌ Failed to extract keys from web-push output"
  exit 1
fi

# 3. Sembrar AMBOS .env (daemon + MC) byte-exact
{
  printf "\n# VAPID keys for PWA push notifications (PRP-031 canónico)\n"
  printf "VAPID_PUBLIC_KEY=%s\n" "$PUBLIC_KEY"
  printf "VAPID_PRIVATE_KEY=%s\n" "$PRIVATE_KEY"
  printf "VAPID_EMAIL=%s\n" "$VAPID_EMAIL"
} >> "$DAEMON_ENV"

{
  printf "\n# VAPID public key (sembrado por generate-vapid.sh)\n"
  printf "NEXT_PUBLIC_VAPID_PUBLIC_KEY=%s\n" "$PUBLIC_KEY"
} >> "$MC_ENV"

echo "✓ VAPID public key: ${PUBLIC_KEY:0:20}..."
echo "✓ Sembrado en $DAEMON_ENV + $MC_ENV"
echo "[AIOS-Template] Done generate-vapid.sh ✓"
