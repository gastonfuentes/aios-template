#!/usr/bin/env bash
# cleanup.sh — deshace el setup parcial del template AIOS.
# Idempotente: skip items ya limpios. NO borra .env ni .claude/identity/.
# Flag --hard: también borra node_modules.

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
AGENT_NAME="${AGENT_NAME:-aios}"
SERVICE_LABEL="com.${AGENT_NAME}.daemon"
DAEMON_DIR="$PROJECT_ROOT/agent-server"
PID_FILE="$DAEMON_DIR/store/daemon.pid"
HARD=false
CLEANED=()

for arg in "$@"; do
  [[ "$arg" == "--hard" ]] && HARD=true
done

echo "[AIOS-Template] Starting cleanup.sh..."

# 1. Stop daemon local (PID file)
if [[ -f "$PID_FILE" ]]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null && sleep 1
    kill -9 "$PID" 2>/dev/null || true
    CLEANED+=("daemon local (PID $PID)")
  fi
  rm -f "$PID_FILE"
fi

# 2. Bootout launchd (macOS) / disable systemd (Linux)
case "$(uname -s)" in
  Darwin)
    PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_LABEL}.plist"
    if [[ -f "$PLIST_PATH" ]]; then
      launchctl bootout "gui/$UID/${SERVICE_LABEL}" 2>/dev/null || true
      rm -f "$PLIST_PATH"
      CLEANED+=("launchd plist ($SERVICE_LABEL)")
    fi
    LOG_DIR="$HOME/Library/Logs/$AGENT_NAME"
    ;;
  Linux)
    UNIT_PATH="$HOME/.config/systemd/user/${AGENT_NAME}-daemon.service"
    if [[ -f "$UNIT_PATH" ]]; then
      systemctl --user disable --now "${AGENT_NAME}-daemon.service" 2>/dev/null || true
      rm -f "$UNIT_PATH"
      systemctl --user daemon-reload 2>/dev/null || true
      CLEANED+=("systemd user unit (${AGENT_NAME}-daemon)")
    fi
    LOG_DIR="$HOME/.local/share/$AGENT_NAME"
    ;;
esac

# 3. Stop tunnel processes (cloudflared / tailscale funnel / ngrok)
for proc in cloudflared ngrok; do
  if pgrep -x "$proc" &>/dev/null; then
    pkill -x "$proc" 2>/dev/null || true
    CLEANED+=("tunnel process: $proc")
  fi
done
if pgrep -f "tailscale funnel" &>/dev/null; then
  pkill -f "tailscale funnel" 2>/dev/null || true
  CLEANED+=("tunnel process: tailscale funnel")
fi

# 4. Eliminar logs
if [[ -d "${LOG_DIR:-}" ]]; then
  rm -rf "$LOG_DIR"
  CLEANED+=("logs en $LOG_DIR")
fi

# 5. --hard: borrar node_modules
if [[ "$HARD" == "true" ]]; then
  for sub in mission-control agent-server; do
    if [[ -d "$PROJECT_ROOT/$sub/node_modules" ]]; then
      rm -rf "$PROJECT_ROOT/$sub/node_modules"
      CLEANED+=("$sub/node_modules")
    fi
  done
fi

# 6. Resumen
echo ""
echo "### Resumen de cleanup"
if [[ ${#CLEANED[@]} -eq 0 ]]; then
  echo "  ✓ Nada que limpiar (setup ya estaba limpio)"
else
  for item in "${CLEANED[@]}"; do
    echo "  ✓ $item"
  done
fi
echo ""
echo "  Preservados: .env, .env.local, .claude/identity/, supabase/migrations/"
[[ "$HARD" == "false" ]] && echo "  Tip: corre con --hard para borrar también node_modules"

echo "[AIOS-Template] Done cleanup.sh ✓"
