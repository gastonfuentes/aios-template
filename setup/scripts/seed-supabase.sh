#!/usr/bin/env bash
# seed-supabase.sh — aplica las migraciones del template a Supabase Cloud.
# Camino preferido: Supabase CLI. Fallback: instrucción manual al operador para dashboard.

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"

echo "[AIOS-Template] Starting seed-supabase.sh..."

if [[ ! -d "$MIGRATIONS_DIR" ]] || [[ -z "$(ls -A "$MIGRATIONS_DIR" 2>/dev/null)" ]]; then
  echo "⚠ No hay migrations en $MIGRATIONS_DIR — skip seed."
  echo "  El template v0.1 todavía no incluye el bundle de migrations (TODO Fase 5)."
  echo "  Por ahora aplica el schema manualmente desde el dashboard Supabase o usa MCP."
  exit 0
fi

if command -v supabase &>/dev/null; then
  echo "→ Aplicando migrations via supabase CLI..."
  cd "$PROJECT_ROOT"
  supabase db push 2>&1 | tail -5
  echo "✓ Migrations aplicadas via CLI"
else
  echo "⚠ supabase CLI no instalado. Aplicación manual requerida:"
  echo "  1. Abre tu Supabase project → SQL Editor"
  echo "  2. Pega el contenido de cada archivo en $MIGRATIONS_DIR en orden alfabético"
  echo "  3. Run cada uno"
  echo ""
  echo "  O instala CLI: brew install supabase/tap/supabase (macOS) / npm i -g supabase (Linux)"
fi

# Seed demo opcional (controlado por env SEED_DEMO=true)
if [[ "${SEED_DEMO:-false}" == "true" ]] && [[ -f "$PROJECT_ROOT/supabase/seed-demo.sql" ]]; then
  echo "→ Aplicando seed-demo.sql..."
  if command -v psql &>/dev/null && [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    psql "$SUPABASE_DB_URL" -f "$PROJECT_ROOT/supabase/seed-demo.sql" 2>&1 | tail -3
    echo "✓ Demo data sembrado"
  else
    echo "  ⚠ Skipping seed-demo: instala psql o setea SUPABASE_DB_URL."
  fi
fi

echo "[AIOS-Template] Done seed-supabase.sh ✓"
