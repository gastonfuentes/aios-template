#!/usr/bin/env bash
# deploy-vercel.sh — deploya el Mission Control PWA a Vercel.
# Pre-requisitos: vercel CLI instalado + cuenta Vercel autenticada (vercel login).
# Idempotente: link existente se preserva; env vars se setean con upsert.

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
MC_DIR="$PROJECT_ROOT/mission-control"
MC_ENV="$MC_DIR/.env.local"

echo "[AIOS-Template] Starting deploy-vercel.sh..."

# 1. Verificar vercel CLI
if ! command -v vercel &>/dev/null; then
  echo "❌ vercel CLI no instalado. Instala con: npm i -g vercel"
  exit 1
fi
echo "✓ vercel CLI presente"

# 2. Verificar .env.local del MC
if [[ ! -f "$MC_ENV" ]]; then
  echo "❌ $MC_ENV no existe. Corre primero el setup principal."
  exit 1
fi

cd "$MC_DIR"

# 3. Link a project Vercel si no existe
if [[ ! -d ".vercel" ]]; then
  echo "→ No hay .vercel/ — corriendo vercel link..."
  vercel link --yes
fi
echo "✓ Project linked"

# 4. Helper: lee var del .env.local y la sembrá con printf (NUNCA echo — aprendizaje PRP-003)
read_env_var() {
  local key="$1"
  set +e +o pipefail
  local val
  val=$(grep "^${key}=" "$MC_ENV" 2>/dev/null | head -1 | sed 's/^[^=]*=//' | sed 's/^"//' | sed 's/"$//')
  set -e -o pipefail
  printf "%s" "$val"
}

seed_var() {
  local key="$1"
  local val
  val=$(read_env_var "$key")
  if [[ -z "$val" ]]; then
    echo "  ⚠ $key ausente en $MC_ENV — skip"
    return 0
  fi
  # rm previo si existe (vercel env add no upsert), then add
  vercel env rm "$key" production --yes &>/dev/null || true
  printf "%s" "$val" | vercel env add "$key" production --yes &>/dev/null
  echo "  ✓ $key"
}

# 5. Sembrar env vars críticas en production
echo "→ Sembrando env vars críticas en Vercel production..."
for VAR in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY ALLOWED_EMAILS MC_BASE_URL MISSION_CONTROL_TOKEN OPENCLAW_GATEWAY_TOKEN NEXT_PUBLIC_VAPID_PUBLIC_KEY; do
  seed_var "$VAR"
done

# 6. Deploy a production
echo "→ Deploying a production..."
DEPLOY_URL=$(vercel deploy --prod --yes 2>&1 | tail -20 | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)

if [[ -z "$DEPLOY_URL" ]]; then
  echo "❌ No se pudo capturar la URL del deploy — revisa output de vercel deploy"
  exit 1
fi
echo "✓ Deploy URL: $DEPLOY_URL"

# 7. Verificar deploy responde
echo "→ Verificando deploy live..."
if curl -sf -o /dev/null -w "%{http_code}" "$DEPLOY_URL" | grep -qE '^(200|301|302|307|308)$'; then
  echo "✓ Deploy responde HTTP 2xx/3xx"
else
  echo "  ⚠ Deploy no respondió 2xx/3xx — puede estar booteando aún"
fi

echo "[AIOS-Template] Done deploy-vercel.sh ✓ ($DEPLOY_URL)"
