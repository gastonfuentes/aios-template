#!/usr/bin/env bash
# start-cloudflare-tunnel.sh — arranca Cloudflare Tunnel apuntando al daemon localhost:3099.
# Pre-requisitos: cloudflared CLI instalado + dominio gestionado en Cloudflare.
# Lee env vars: AGENT_NAME (default 'aios') + CF_SUBDOMAIN (ej. agent.tudominio.com).

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
AGENT_NAME="${AGENT_NAME:-aios}"
DAEMON_ENV="$PROJECT_ROOT/agent-server/.env"
TUNNEL_NAME="${AGENT_NAME}-daemon"
CF_DIR="$HOME/.cloudflared"
CONFIG_FILE="$CF_DIR/${TUNNEL_NAME}.yml"

echo "[AIOS-Template] Starting start-cloudflare-tunnel.sh..."

# 1. Verificar cloudflared CLI
if ! command -v cloudflared &>/dev/null; then
  echo "⚠ cloudflared CLI no instalado — skip."
  echo "  Instala con: brew install cloudflared (macOS) o https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 0
fi
echo "✓ cloudflared $(cloudflared --version 2>&1 | head -1 | awk '{print $3}')"

# 2. Verificar CF_SUBDOMAIN
if [[ -z "${CF_SUBDOMAIN:-}" ]]; then
  echo "❌ CF_SUBDOMAIN no sembrado. Ejemplo: export CF_SUBDOMAIN=agent.tudominio.com"
  exit 1
fi
echo "✓ CF_SUBDOMAIN=$CF_SUBDOMAIN"

# 3. Auth (idempotente: skip si ya hay cert.pem)
if [[ ! -f "$CF_DIR/cert.pem" ]]; then
  echo "→ Autenticando con Cloudflare (se abrirá el browser)..."
  cloudflared tunnel login
else
  echo "✓ cert.pem ya presente — skip login"
fi

# 4. Crear tunnel (idempotente: skip si ya existe)
if cloudflared tunnel list 2>/dev/null | grep -q " $TUNNEL_NAME "; then
  echo "✓ Tunnel '$TUNNEL_NAME' ya existe"
else
  echo "→ Creando tunnel '$TUNNEL_NAME'..."
  cloudflared tunnel create "$TUNNEL_NAME"
fi
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep " $TUNNEL_NAME " | awk '{print $1}')

# 5. Escribir config.yml
mkdir -p "$CF_DIR"
cat > "$CONFIG_FILE" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CF_DIR/$TUNNEL_ID.json
ingress:
  - hostname: $CF_SUBDOMAIN
    service: http://127.0.0.1:3099
  - service: http_status:404
EOF
echo "✓ config.yml escrito en $CONFIG_FILE"

# 6. Route DNS (idempotente)
echo "→ Configurando DNS route..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$CF_SUBDOMAIN" 2>&1 | tail -3 || true

# 7. Sembrar URLs en .env (idempotente: skip si ya están)
if ! grep -q "^MC_BASE_URL=https://$CF_SUBDOMAIN" "$DAEMON_ENV" 2>/dev/null; then
  {
    printf "\n# Cloudflare Tunnel URLs (sembrado por start-cloudflare-tunnel.sh)\n"
    printf "MC_BASE_URL=https://%s\n" "$CF_SUBDOMAIN"
    printf "MISSION_CONTROL_ORIGIN=https://%s\n" "$CF_SUBDOMAIN"
  } >> "$DAEMON_ENV"
  echo "✓ URLs sembradas en $DAEMON_ENV"
else
  echo "✓ URLs ya sembradas en $DAEMON_ENV"
fi

# 8. Run tunnel en background
echo "→ Arrancando tunnel en background..."
nohup cloudflared tunnel --config "$CONFIG_FILE" run "$TUNNEL_NAME" > /tmp/cloudflared-${TUNNEL_NAME}.log 2>&1 &
echo "✓ Tunnel PID=$! — logs en /tmp/cloudflared-${TUNNEL_NAME}.log"

echo "[AIOS-Template] Done start-cloudflare-tunnel.sh ✓"
