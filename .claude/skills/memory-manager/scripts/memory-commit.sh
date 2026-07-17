#!/usr/bin/env bash
# memory-commit.sh — auto-commit + auto-push de cambios bajo .claude/memory/
# Usage: bash memory-commit.sh "memoria: <accion> <archivo>"
#
# Política: ver .claude/skills/memory-manager/references/git-policy.md
# Fail-soft: push fallido NO aborta el flujo de la skill — log WARN, retorna 0.
set -u  # no -e para no abortar antes del fail-soft del push

MSG="${1:-memoria: cambio sin descripción}"

# Resolver REPO_ROOT desde la ubicación del script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

cd "$REPO_ROOT" || { echo "WARN: no pude cd a $REPO_ROOT" >&2; exit 0; }

# Pre-check 1: estamos en un repo git.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "WARN: $REPO_ROOT no es un repo git — saltando commit." >&2
  exit 0
fi

# Pre-check 2: git user.email configurado.
if [ -z "$(git config user.email)" ]; then
  echo "WARN: git user.email no configurado — no commiteo." >&2
  exit 0
fi

# Pre-check 3: hay cambios bajo .claude/memory/?
if git diff --quiet -- .claude/memory && git diff --cached --quiet -- .claude/memory; then
  # Verificar si hay archivos untracked dentro de .claude/memory/
  if [ -z "$(git ls-files --others --exclude-standard .claude/memory/ 2>/dev/null)" ]; then
    echo "info: nada que commitear bajo .claude/memory/."
    exit 0
  fi
fi

# Stage solo .claude/memory/ — explícito para no arrastrar cambios del operador.
if ! git add .claude/memory/ 2>/dev/null; then
  echo "WARN: git add .claude/memory/ falló." >&2
  exit 0
fi

# Commit. --no-gpg-sign por consistencia (commits del agente no firmados).
if ! git commit -m "$MSG" --no-gpg-sign >/dev/null 2>&1; then
  # Si commit falla porque no quedó nada staged tras el add (race), retornar silencioso.
  if git diff --quiet --cached -- .claude/memory; then
    echo "info: nada se commiteó (no había diff staged)."
    exit 0
  fi
  echo "WARN: git commit falló." >&2
  exit 0
fi

echo "ok: commit '$MSG' creado."

# Push fail-soft.
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'main')"
if git push origin "$CURRENT_BRANCH" >/dev/null 2>&1; then
  echo "ok: push a origin/$CURRENT_BRANCH exitoso."
else
  echo "WARN: push a origin/$CURRENT_BRANCH falló (offline / rebase needed / credenciales). Commit local persiste; sincronizá manualmente con git pull --rebase && git push, o el próximo write con éxito reintentará." >&2
fi

exit 0
