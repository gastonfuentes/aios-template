# Service manager templates

> **TL;DR**: 2 templates (launchd para macOS / systemd para Linux) que el script `install-service-manager.sh` renderea con placeholders del operador y bootstrap-ea al sistema.

---

## Cuál usar

| OS detectado | Service manager | Template |
|---|---|---|
| macOS (Darwin) | launchd | [launchd-macos.plist.template](launchd-macos.plist.template) |
| Linux | systemd user unit | [systemd-linux.service.template](systemd-linux.service.template) |
| Windows WSL2 | systemd (vía WSL2 systemd support) | [systemd-linux.service.template](systemd-linux.service.template) |

---

## Placeholders renderizados

El script [install-service-manager.sh](../scripts/install-service-manager.sh) reemplaza:

- `{{AGENT_NAME}}` → nombre del agente capitalizado (ej. `Echo`).
- `{{AGENT_NAME_LOWERCASE}}` → lowercase (ej. `echo`).
- `{{PROJECT_ROOT}}` → ruta absoluta del repo clonado.
- `{{LOG_PATH}}` → `~/Library/Logs/<lowercase>` (macOS) o `~/.local/share/<lowercase>` (Linux).
- `{{TIMEZONE}}` → output de `date +%Z` o `America/Mexico_City` por default.

---

## Operación

```bash
# macOS — bootstrap el plist al user session
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.<agent>.agent.plist

# Ver status
launchctl print gui/$UID/com.<agent>.agent

# Restart
launchctl kickstart -k gui/$UID/com.<agent>.agent

# Stop (mantiene plist instalado, no arranca cross-restart)
launchctl bootout gui/$UID/com.<agent>.agent
```

```bash
# Linux — enable + start
systemctl --user enable <agent>-agent.service
systemctl --user start <agent>-agent

# Ver status
systemctl --user status <agent>-agent

# Restart
systemctl --user restart <agent>-agent

# Logs
journalctl --user -u <agent>-agent -f
```

---

Las características clave de ambos templates:

- **RunAtLoad / WantedBy=default.target**: arranca al login del operador automáticamente.
- **KeepAlive crashed only / Restart=on-failure**: solo reinicia si crashea, no si sale clean (Ctrl+C deliberado).
- **ThrottleInterval=10 / RestartSec=10**: throttle entre reintentos para evitar crash-loop spam.
- **PATH explícito** incluyendo `/opt/homebrew/bin` (macOS) o `/usr/local/bin` (Linux) — load-bearing para que el daemon encuentre `node`, `tsx`, `claude` (si Claude Code CLI).
- **Logs separados stdout/stderr** para diagnóstico granular.
