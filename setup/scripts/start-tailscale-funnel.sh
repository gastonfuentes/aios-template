#!/usr/bin/env bash
# start-tailscale-funnel.sh — arranca Tailscale Funnel sobre el daemon localhost:3099.
# Pre-requisitos: tailscale CLI instalado + cuenta Tailscale (MagicDNS habilitado).
# Lee env vars: AGENT_NAME (default 'aios'). Captura el subdomain MagicDNS asignado.

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
AGENT_NAME="${AGENT_NAME:-aios}"
DAEMON_ENV="$PROJECT_ROOT/agent-server/.env"

echo "[AIOS-Template] Starting start-tailscale-funnel.sh..."

# 1. Verificar tailscale CLI
if ! command -v tailscale &>/dev/null; then
  echo "⚠ tailscale CLI no instalado — skip."
  echo "  Instala con: brew install tailscale (macOS) o https://tailscale.com/download"
  exit 0
fi
echo "✓ tailscale $(tailscale version | head -1)"

# 2. Auth (idempotente: skip si ya hay sesión activa)
if ! tailscale status &>/dev/null; then
  echo "→ Autenticando con Tailscale (se abrirá el browser)..."
  tailscale up
else
  echo "✓ Sesión Tailscale activa"
fi

# 3. Capturar MagicDNS hostname (formato: <host>.<tailnet>.ts.net)
MAGIC_DNS=$(tailscale status --json 2>/dev/null | grep -oE '"DNSName":\s*"[^"]+"' | head -1 | cut -d'"' -f4 | sed 's/\.$//')
if [[ -z "$MAGIC_DNS" ]]; then
  echo "❌ No pude detectar MagicDNS hostname. Verifica que MagicDNS esté habilitado en tu tailnet."
  exit 1
fi
echo "✓ MagicDNS hostname: $MAGIC_DNS"

# 4. Serve daemon en background (idempotente: tailscale serve maneja re-runs)
echo "→ Configurando tailscale serve → http://127.0.0.1:3099..."
tailscale serve --bg --https=443 http://127.0.0.1:3099 2>&1 | tail -3 || true

# 5. Habilitar Funnel público (puerto 443)
echo "→ Habilitando Funnel público en :443..."
tailscale funnel 443 on 2>&1 | tail -3 || true

# 6. Sembrar URLs en .env (idempotente: skip si ya están)
FUNNEL_URL="https://$MAGIC_DNS"
if ! grep -q "^MC_BASE_URL=$FUNNEL_URL" "$DAEMON_ENV" 2>/dev/null; then
  {
    printf "\n# Tailscale Funnel URLs (sembrado por start-tailscale-funnel.sh)\n"
    printf "MC_BASE_URL=%s\n" "$FUNNEL_URL"
    printf "MISSION_CONTROL_ORIGIN=%s\n" "$FUNNEL_URL"
  } >> "$DAEMON_ENV"
  echo "✓ URLs sembradas en $DAEMON_ENV"
else
  echo "✓ URLs ya sembradas en $DAEMON_ENV"
fi

# 7. Verificar status final
echo "→ Status del Funnel:"
tailscale funnel status 2>&1 | tail -5 || true

echo "✓ Funnel activo en: $FUNNEL_URL"
echo "[AIOS-Template] Done start-tailscale-funnel.sh ✓"
