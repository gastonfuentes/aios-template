#!/usr/bin/env bash
# start-ngrok-tunnel.sh — arranca ngrok apuntando al daemon localhost:3099.
# Pre-requisitos: ngrok CLI instalado + cuenta ngrok (NGROK_AUTHTOKEN sembrado).
# Lee env vars: AGENT_NAME (default 'aios') + NGROK_AUTHTOKEN.

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
AGENT_NAME="${AGENT_NAME:-aios}"
DAEMON_ENV="$PROJECT_ROOT/agent-server/.env"
NGROK_LOG="/tmp/ngrok-${AGENT_NAME}.log"

echo "[AIOS-Template] Starting start-ngrok-tunnel.sh..."

# 1. Verificar ngrok CLI
if ! command -v ngrok &>/dev/null; then
  echo "⚠ ngrok CLI no instalado — skip."
  echo "  Instala con: brew install ngrok/ngrok/ngrok (macOS) o https://ngrok.com/download"
  exit 0
fi
echo "✓ ngrok $(ngrok --version | head -1 | awk '{print $3}')"

# 2. Verificar NGROK_AUTHTOKEN
if [[ -z "${NGROK_AUTHTOKEN:-}" ]]; then
  echo "❌ NGROK_AUTHTOKEN no sembrado. Obtén el tuyo en https://dashboard.ngrok.com/get-started/your-authtoken"
  echo "  export NGROK_AUTHTOKEN=<token>"
  exit 1
fi
echo "✓ NGROK_AUTHTOKEN presente"

# 3. Configurar authtoken (idempotente: ngrok re-sobrescribe sin error)
echo "→ Configurando authtoken..."
ngrok config add-authtoken "$NGROK_AUTHTOKEN" 2>&1 | tail -2

# 4. Matar instancias previas del agent (idempotente)
if pgrep -f "ngrok http 3099" &>/dev/null; then
  echo "→ Matando instancia ngrok previa..."
  pkill -f "ngrok http 3099" || true
  sleep 1
fi

# 5. Arrancar ngrok en background con log a stdout capturado
echo "→ Arrancando ngrok http 3099 en background..."
nohup ngrok http 3099 --log=stdout --log-format=json > "$NGROK_LOG" 2>&1 &
NGROK_PID=$!
echo "✓ ngrok PID=$NGROK_PID — logs en $NGROK_LOG"

# 6. Esperar URL pública en log (timeout 15s)
echo "→ Esperando URL pública..."
NGROK_URL=""
for i in {1..15}; do
  sleep 1
  NGROK_URL=$(grep -oE 'https://[a-z0-9-]+\.ngrok-free\.app' "$NGROK_LOG" 2>/dev/null | head -1 || true)
  if [[ -z "$NGROK_URL" ]]; then
    NGROK_URL=$(grep -oE 'https://[a-z0-9-]+\.ngrok\.app' "$NGROK_LOG" 2>/dev/null | head -1 || true)
  fi
  [[ -n "$NGROK_URL" ]] && break
done

if [[ -z "$NGROK_URL" ]]; then
  echo "❌ Timeout esperando URL pública de ngrok. Revisa $NGROK_LOG"
  exit 1
fi
echo "✓ URL pública: $NGROK_URL"

# 7. Sembrar URLs en .env (idempotente: skip si ya están)
if ! grep -q "^MC_BASE_URL=$NGROK_URL" "$DAEMON_ENV" 2>/dev/null; then
  {
    printf "\n# ngrok Tunnel URLs (sembrado por start-ngrok-tunnel.sh)\n"
    printf "MC_BASE_URL=%s\n" "$NGROK_URL"
    printf "MISSION_CONTROL_ORIGIN=%s\n" "$NGROK_URL"
  } >> "$DAEMON_ENV"
  echo "✓ URLs sembradas en $DAEMON_ENV"
else
  echo "✓ URLs ya sembradas en $DAEMON_ENV"
fi

echo "[AIOS-Template] Done start-ngrok-tunnel.sh ✓"
