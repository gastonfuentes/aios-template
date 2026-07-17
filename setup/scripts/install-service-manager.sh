#!/usr/bin/env bash
# install-service-manager.sh — instala el daemon como service persistent según OS.
# macOS: launchd (~/Library/LaunchAgents). Linux: systemd user (~/.config/systemd/user).
# Idempotente: re-ejecutar reescribe el unit + bootstrap/reload.

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
AGENT_NAME="${AGENT_NAME:-aios}"
DAEMON_DIR="$PROJECT_ROOT/agent-server"
SERVICE_LABEL="com.${AGENT_NAME}.daemon"

echo "[AIOS-Template] Starting install-service-manager.sh..."

# 1. Verificar dist/ del daemon
if [[ ! -d "$DAEMON_DIR/dist" ]]; then
  echo "→ dist/ ausente. Compilando con npm run build..."
  (cd "$DAEMON_DIR" && npm run build 2>&1 | tail -5)
fi
echo "✓ Daemon compilado en $DAEMON_DIR/dist"

case "$(uname -s)" in
  Darwin)
    # 2a. macOS — launchd
    LOG_DIR="$HOME/Library/Logs/$AGENT_NAME"
    PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_LABEL}.plist"
    mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

    echo "→ Renderizando plist en $PLIST_PATH..."
    cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>node</string>
    <string>${DAEMON_DIR}/dist/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>${DAEMON_DIR}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>Crashed</key><true/></dict>
  <key>StandardOutPath</key><string>${LOG_DIR}/daemon.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/daemon.err.log</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
</dict>
</plist>
EOF

    # Bootout previo (idempotente) + bootstrap fresh
    launchctl bootout "gui/$UID/${SERVICE_LABEL}" 2>/dev/null || true
    launchctl bootstrap "gui/$UID" "$PLIST_PATH"
    echo "✓ launchd service registrado: $SERVICE_LABEL"
    echo "  Logs: $LOG_DIR/daemon.log"
    echo "  Stop: launchctl bootout gui/\$UID/$SERVICE_LABEL"
    ;;

  Linux)
    # 2b. Linux — systemd user
    UNIT_DIR="$HOME/.config/systemd/user"
    UNIT_PATH="$UNIT_DIR/${AGENT_NAME}-daemon.service"
    LOG_DIR="$HOME/.local/share/$AGENT_NAME"
    mkdir -p "$UNIT_DIR" "$LOG_DIR"

    echo "→ Renderizando unit en $UNIT_PATH..."
    cat > "$UNIT_PATH" <<EOF
[Unit]
Description=${AGENT_NAME} daemon (agent-server)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${DAEMON_DIR}
ExecStart=/usr/bin/env node ${DAEMON_DIR}/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=append:${LOG_DIR}/daemon.log
StandardError=append:${LOG_DIR}/daemon.err.log
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    systemctl --user enable --now "${AGENT_NAME}-daemon.service"
    echo "✓ systemd user service registrado: ${AGENT_NAME}-daemon"
    echo "  Logs: $LOG_DIR/daemon.log"
    echo "  Stop: systemctl --user disable --now ${AGENT_NAME}-daemon"
    ;;

  *)
    echo "❌ OS no soportado: $(uname -s)"
    exit 1
    ;;
esac

echo "[AIOS-Template] Done install-service-manager.sh ✓"
