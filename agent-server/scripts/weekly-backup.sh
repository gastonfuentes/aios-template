#!/usr/bin/env bash
# AIOS weekly backup — PRP-007.
#
# Corre OUT del scheduler del daemon (bash + launchd propio
# `~/Library/LaunchAgents/com.aios.weekly-backup.plist`). Sigue funcionando
# aunque el daemon esté caído.
#
# Empaqueta:
#   1. ~/.claude/projects/<project-slug>/   (sesiones SDK)
#   2. <repo>/agent-server/store/agent-server.db  (SQLite del daemon)
#   3. <repo>/.claude/memory/                     (Fase 8 — opcional, puede no existir)
#
# Retención: borra .tar.gz más viejos que 60 días.

set -euo pipefail

REPO_ROOT="<PROJECT_ROOT>"
BACKUP_DIR="$HOME/aios-backups"
LOG_FILE="$BACKUP_DIR/weekly-backup.log"
TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/aios-backup-$TS.tar.gz"

mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "start backup → $ARCHIVE"

# Construir lista de paths que existen (tar falla con paths inválidos).
PATHS=()

SDK_SESSIONS="$HOME/.claude/projects/<project-slug>"
if [ -d "$SDK_SESSIONS" ]; then
  PATHS+=("$SDK_SESSIONS")
else
  log "skip: $SDK_SESSIONS no existe (sin sesiones SDK todavía)"
fi

DAEMON_DB="$REPO_ROOT/agent-server/store/agent-server.db"
if [ -f "$DAEMON_DB" ]; then
  PATHS+=("$DAEMON_DB")
else
  log "skip: $DAEMON_DB no existe (daemon nunca se inició)"
fi

MEMORY_DIR="$REPO_ROOT/.claude/memory"
if [ -d "$MEMORY_DIR" ]; then
  PATHS+=("$MEMORY_DIR")
else
  log "skip: $MEMORY_DIR no existe (Fase 8 lo creará)"
fi

if [ "${#PATHS[@]}" -eq 0 ]; then
  log "abort: no hay nada que respaldar"
  exit 0
fi

# tar -czf con paths absolutos. -C / + paths relativos sería más limpio,
# pero los paths absolutos son útiles para restore selectivo.
if tar -czf "$ARCHIVE" "${PATHS[@]}" 2>>"$LOG_FILE"; then
  SIZE=$(stat -f%z "$ARCHIVE" 2>/dev/null || echo "?")
  log "ok: $ARCHIVE size=${SIZE}B paths=${#PATHS[@]}"
else
  log "error: tar falló (revisa entradas anteriores del log)"
  exit 1
fi

# Retención 60 días.
DELETED=$(find "$BACKUP_DIR" -name 'aios-backup-*.tar.gz' -mtime +60 -delete -print 2>/dev/null | wc -l | tr -d ' ')
if [ "$DELETED" -gt 0 ]; then
  log "retention: borrados $DELETED backups con más de 60 días"
fi

log "end backup"
