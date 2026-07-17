#!/usr/bin/env bash
# install-deps-linux.sh — instala dependencias del template AIOS en Ubuntu 22+ / Debian 12+.
# Idempotente: re-ejecutar no re-instala lo ya presente.

set -euo pipefail

echo "[AIOS-Template] Starting install-deps-linux.sh..."

# 1. Update apt
sudo apt-get update -qq

# 2. Node 20 LTS vía NodeSource
if ! command -v node &>/dev/null || [[ $(node --version | cut -d'.' -f1 | tr -d 'v') -lt 20 ]]; then
  echo "→ Instalando Node 20 LTS via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
NODE_VERSION=$(node --version)
echo "✓ Node $NODE_VERSION"

# 3. Build essentials para mejores nativas (better-sqlite3, sharp, etc.)
sudo apt-get install -y build-essential python3 git curl ca-certificates
echo "✓ Build essentials presentes"

# 4. npm deps del workspace
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
echo "→ Installing npm deps en mission-control..."
(cd "$PROJECT_ROOT/mission-control" && npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -3)
echo "→ Installing npm deps en agent-server..."
(cd "$PROJECT_ROOT/agent-server" && npm install --no-audit --no-fund --legacy-peer-deps 2>&1 | tail -3)

echo "[AIOS-Template] Done install-deps-linux.sh ✓"
