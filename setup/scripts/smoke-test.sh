#!/usr/bin/env bash
# smoke-test.sh — valida que el setup quedó funcional.
# Imprime pass/fail por check con detalle accionable.

set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
PASS=0
FAIL=0

check() {
  local name="$1"; local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo "  ✓ $name"
    PASS=$((PASS+1))
  else
    echo "  ✗ $name"
    FAIL=$((FAIL+1))
  fi
}

echo "[AIOS-Template] Starting smoke-test.sh..."
echo ""

echo "### Dependencias"
check "Node 20+ instalado" "node --version | grep -E '^v(2[0-9]|[3-9][0-9])'"
check "mission-control/node_modules existe" "test -d $PROJECT_ROOT/mission-control/node_modules"
check "agent-server/node_modules existe" "test -d $PROJECT_ROOT/agent-server/node_modules"

echo ""
echo "### Env vars críticas"
DAEMON_ENV="$PROJECT_ROOT/agent-server/.env"
MC_ENV="$PROJECT_ROOT/mission-control/.env.local"

check ".env del daemon presente" "test -f $DAEMON_ENV"
check ".env.local del MC presente" "test -f $MC_ENV"
check "LLM_PROVIDER sembrado en daemon" "grep -q '^LLM_PROVIDER=' $DAEMON_ENV"
check "VAPID keys sembradas" "grep -q '^VAPID_PUBLIC_KEY=' $DAEMON_ENV"
check "Supabase URL sembrada en MC" "grep -q '^NEXT_PUBLIC_SUPABASE_URL=' $MC_ENV"

echo ""
echo "### Identity files renderizados"
check ".claude/identity/SOUL.md generado (post-template render)" "test -f $PROJECT_ROOT/.claude/identity/SOUL.md"
check ".claude/identity/USER.md generado" "test -f $PROJECT_ROOT/.claude/identity/USER.md"
check ".claude/agents/<agent>.md generado" "ls $PROJECT_ROOT/.claude/agents/*.md 2>/dev/null | head -1"

echo ""
echo "### Build verde"
check "mission-control typecheck" "cd $PROJECT_ROOT/mission-control && npx tsc --noEmit 2>/dev/null"
check "agent-server typecheck" "cd $PROJECT_ROOT/agent-server && npm run typecheck 2>/dev/null"

echo ""
echo "### Servicios vivos (si aplica al cuadrante)"
DAEMON_PORT="${DAEMON_PORT:-3099}"
MC_PORT="${MC_PORT:-3000}"

if curl -sf "http://localhost:$DAEMON_PORT/healthz" &>/dev/null; then
  check "Daemon healthz responde en :$DAEMON_PORT" "true"
else
  echo "  ⚠ Daemon no responde en :$DAEMON_PORT (esperado si cuadrante = pwa-only-cloud o daemon aún no arrancado)"
fi

if curl -sf "http://localhost:$MC_PORT" &>/dev/null; then
  check "MC SSR responde en :$MC_PORT" "true"
else
  echo "  ⚠ MC no responde en :$MC_PORT (arranca dev con: cd mission-control && npm run dev)"
fi

echo ""
echo "### Resumen"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"

if [[ $FAIL -eq 0 ]]; then
  echo "[AIOS-Template] Done smoke-test.sh ✓ (todo verde)"
  exit 0
else
  echo "[AIOS-Template] smoke-test.sh terminó con $FAIL fallas — revisa los items marcados ✗"
  exit 1
fi
