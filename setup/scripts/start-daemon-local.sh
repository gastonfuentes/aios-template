#!/usr/bin/env bash
# start-daemon-local.sh — arranca el daemon agent-server en background (sin service manager).
# Idempotente: si PID file existe y el proceso vive, no relanza.

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
AGENT_NAME="${AGENT_NAME:-aios}"
DAEMON_DIR="$PROJECT_ROOT/agent-server"
PID_FILE="$DAEMON_DIR/store/daemon.pid"
DAEMON_PORT="${DAEMON_PORT:-3099}"

# 1. Detectar OS y derivar path de log
case "$(uname -s)" in
  Darwin) LOG_DIR="$HOME/Library/Logs/$AGENT_NAME" ;;
  Linux)  LOG_DIR="$HOME/.local/share/$AGENT_NAME" ;;
  *)      echo "❌ OS no soportado: $(uname -s)"; exit 1 ;;
esac
LOG_FILE="$LOG_DIR/daemon.log"

echo "[AIOS-Template] Starting start-daemon-local.sh..."

# 2. Verificar PID existente — idempotencia
if [[ -f "$PID_FILE" ]]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "✓ Daemon ya corriendo (PID $OLD_PID) — no relanzo (idempotente)."
    echo "  Logs: $LOG_FILE"
    exit 0
  else
    echo "→ PID file stale (PID $OLD_PID no vive). Limpiando..."
    rm -f "$PID_FILE"
  fi
fi

# 3. Build si dist/ no existe
if [[ ! -d "$DAEMON_DIR/dist" ]]; then
  echo "→ dist/ ausente. Compilando con npm run build..."
  (cd "$DAEMON_DIR" && npm run build 2>&1 | tail -5)
fi

# 4. Preparar log dir + store dir
mkdir -p "$LOG_DIR" "$DAEMON_DIR/store"

# 5. Lanzar en background y persistir PID
echo "→ Arrancando daemon en background..."
(cd "$DAEMON_DIR" && nohup node dist/index.js > "$LOG_FILE" 2>&1 &
 echo $! > "$PID_FILE")
NEW_PID=$(cat "$PID_FILE")
echo "✓ Daemon launched (PID $NEW_PID)"

# 6. Esperar 3 segundos y validar healthz
sleep 3
if curl -sf "http://127.0.0.1:$DAEMON_PORT/healthz" &>/dev/null; then
  echo "✓ healthz responde en :$DAEMON_PORT"
  echo "  Logs: $LOG_FILE"
  echo "[AIOS-Template] Done start-daemon-local.sh ✓"
else
  echo "❌ healthz NO responde en :$DAEMON_PORT — revisa $LOG_FILE"
  exit 1
fi
