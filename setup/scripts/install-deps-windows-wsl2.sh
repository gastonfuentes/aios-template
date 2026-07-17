#!/usr/bin/env bash
# install-deps-windows-wsl2.sh — instala dependencias del template AIOS en Windows 11 + WSL2 Ubuntu.
# Pre-requisito: tener WSL2 + Ubuntu 22+ instalado. Si no, ejecutar `wsl --install` en PowerShell admin.

set -euo pipefail

echo "[AIOS-Template] Starting install-deps-windows-wsl2.sh..."

# Verificar que estamos en WSL2 (no Windows nativo)
if ! grep -qi "microsoft\|wsl" /proc/version 2>/dev/null; then
  echo "❌ No estás en WSL2. Este script requiere Windows + WSL2 Ubuntu."
  echo "  En PowerShell admin ejecuta: wsl --install"
  echo "  Después abre WSL Ubuntu y vuelve a correr este script desde ahí."
  exit 1
fi
echo "✓ WSL2 detectado: $(grep -oP 'Microsoft@[a-zA-Z0-9-]+' /proc/version || echo 'WSL2')"

# Delegamos al install-deps-linux.sh (Ubuntu dentro de WSL2 es igual que Linux nativo)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/install-deps-linux.sh"
