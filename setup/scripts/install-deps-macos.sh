#!/usr/bin/env bash
# install-deps-macos.sh — instala dependencias del template AIOS en macOS Apple Silicon o Intel.
# Idempotente: re-ejecutar no re-instala lo ya presente.

set -euo pipefail

echo "[AIOS-Template] Starting install-deps-macos.sh..."

# 1. Verificar Homebrew
if ! command -v brew &>/dev/null; then
  echo "❌ Homebrew no instalado. Instálalo desde https://brew.sh y vuelve a correr."
  exit 1
fi
echo "✓ Homebrew presente"

# 2. Node 20+ vía Homebrew (no afecta si ya está instalado por otro método)
if ! command -v node &>/dev/null; then
  echo "→ Instalando Node 20 LTS via brew..."
  brew install node@20
  brew link --force --overwrite node@20 || true
fi
NODE_VERSION=$(node --version)
echo "✓ Node $NODE_VERSION"

# 3. Git (usualmente preinstalado en macOS)
if ! command -v git &>/dev/null; then
  brew install git
fi
echo "✓ Git $(git --version | awk '{print $3}')"

# 4. npm deps del workspace (mission-control + agent-server)
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
echo "→ Installing npm deps en mission-control..."
(cd "$PROJECT_ROOT/mission-control" && npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -3)
echo "→ Installing npm deps en agent-server..."
(cd "$PROJECT_ROOT/agent-server" && npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -3)

echo "[AIOS-Template] Done install-deps-macos.sh ✓"
