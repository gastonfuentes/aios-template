#!/usr/bin/env bash
# Corre Playwright tests + sirve el reporte HTML al terminar.
# Uso: ./scripts/run-with-report.sh [args adicionales]

set -euo pipefail

# Limpiar reporte anterior
rm -rf playwright-report/

# Correr tests (no fallar si hay tests rojos — queremos ver el reporte igual)
npx playwright test "$@" || true

# Verificar que se genero el reporte
if [ ! -d playwright-report ]; then
  echo "No se genero reporte. Verifica config."
  exit 1
fi

# Servir
PORT="${PORT:-8080}"
echo ""
echo "Reporte disponible en: http://localhost:$PORT"
echo "Ctrl+C para cerrar."
echo ""

cd playwright-report
python3 -m http.server "$PORT"
