#!/usr/bin/env bash
# snapshot-month.sh — arma .claude/memory/historial/<YYYY-MM-anterior>.md
# con bloques de decisiones.md + errores-aprendidos.md + memorias incidentales
# del mes calendario anterior. Idempotente: si el archivo ya existe, no-op.
# Llama memory-commit.sh al cerrar para auto-commit + auto-push (fail-soft).
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
MEM="$REPO_ROOT/.claude/memory"
HIST="$MEM/historial"
COMMIT="$SCRIPT_DIR/memory-commit.sh"

if [ ! -d "$MEM" ]; then
  echo "ERROR: no encontré $MEM. Corre init-memory.sh primero." >&2
  exit 1
fi

mkdir -p "$HIST"

# Calcular mes anterior (cross-platform: macOS BSD date + GNU date).
# Estrategia: tomar primer día del mes en curso, restar 1 día, formatear YYYY-MM.
THIS_MONTH_FIRST="$(date +%Y-%m-01)"
if date -j -v-1d -f "%Y-%m-%d" "$THIS_MONTH_FIRST" "+%Y-%m" >/dev/null 2>&1; then
  # macOS BSD date
  YYYYMM="$(date -j -v-1d -f "%Y-%m-%d" "$THIS_MONTH_FIRST" "+%Y-%m")"
else
  # GNU date (Linux)
  YYYYMM="$(date -d "$THIS_MONTH_FIRST -1 day" "+%Y-%m" 2>/dev/null || echo "")"
fi

if [ -z "$YYYYMM" ]; then
  echo "ERROR: no pude calcular el mes anterior con date(1)." >&2
  exit 1
fi

OUT="$HIST/$YYYYMM.md"

if [ -f "$OUT" ]; then
  echo "info: snapshot $YYYYMM ya existe en $OUT — no-op."
  exit 0
fi

# Helper: extraer bloques de un append-only cuyo título tenga fecha en el mes target.
# Formato esperado de bloque: "## YYYY-MM-DD: <título>" + cuerpo hasta el siguiente "## " o EOF.
extract_blocks_for_month() {
  local source="$1"
  local target_month="$2"
  if [ ! -f "$source" ]; then
    return 0
  fi
  awk -v target="$target_month" '
    /^## [0-9]{4}-[0-9]{2}-[0-9]{2}:/ {
      # Cierra el bloque anterior si estaba marcado.
      if (capturing) {
        printf "%s", buf
        buf = ""
        capturing = 0
      }
      # Empieza nuevo bloque si la fecha matchea el mes target.
      match($0, /[0-9]{4}-[0-9]{2}/)
      block_month = substr($0, RSTART, RLENGTH)
      if (block_month == target) {
        capturing = 1
        buf = $0 "\n"
      }
      next
    }
    capturing { buf = buf $0 "\n" }
    END {
      if (capturing) printf "%s", buf
    }
  ' "$source"
}

# Helper: listar archivos en una carpeta incidental cuyo last_updated frontmatter cae en el mes.
list_incidentals_for_month() {
  local dir="$1"
  local target_month="$2"
  if [ ! -d "$dir" ]; then
    return 0
  fi
  for f in "$dir"/*.md; do
    [ -e "$f" ] || continue  # glob vacío
    local lu
    lu="$(awk -F': *' '/^last_updated:/ {print $2; exit}' "$f" 2>/dev/null | tr -d '"' | head -c 7)"
    if [ "$lu" = "$target_month" ]; then
      local rel="${f#$REPO_ROOT/}"
      echo "- [\`$rel\`]($rel)"
    fi
  done
}

DECISIONS="$(extract_blocks_for_month "$MEM/decisiones.md" "$YYYYMM")"
ERRORS="$(extract_blocks_for_month "$MEM/errores-aprendidos.md" "$YYYYMM")"
INC_USER="$(list_incidentals_for_month "$MEM/user" "$YYYYMM")"
INC_FEEDBACK="$(list_incidentals_for_month "$MEM/feedback" "$YYYYMM")"
INC_PROJECT="$(list_incidentals_for_month "$MEM/project" "$YYYYMM")"
INC_REFERENCE="$(list_incidentals_for_month "$MEM/reference" "$YYYYMM")"

ANY_INCIDENTAL=""
[ -n "$INC_USER$INC_FEEDBACK$INC_PROJECT$INC_REFERENCE" ] && ANY_INCIDENTAL="yes"

GENERATED_AT="$(date '+%Y-%m-%d %H:%M %Z')"
TODAY="$(date +%Y-%m-%d)"

{
  echo "---"
  echo "last_updated: $TODAY"
  echo "update_frequency: low"
  echo "volatility: snapshot"
  echo "---"
  echo ""
  echo "# Snapshot mensual — $YYYYMM"
  echo ""
  echo "> Generado automáticamente por el cron \`monthly-memory-snapshot\` el $GENERATED_AT."
  echo ""

  echo "## Decisiones"
  echo ""
  if [ -n "$DECISIONS" ]; then
    # printf "%s\n" recupera el trailing newline que bash $() strippea de awk.
    printf "%s\n" "$DECISIONS"
  else
    echo "_Sin decisiones registradas en \`decisiones.md\` con fecha de $YYYYMM._"
  fi
  echo ""

  echo "## Errores aprendidos"
  echo ""
  if [ -n "$ERRORS" ]; then
    printf "%s\n" "$ERRORS"
  else
    echo "_Sin errores registrados en \`errores-aprendidos.md\` con fecha de $YYYYMM._"
  fi
  echo ""

  echo "## Memorias incidentales modificadas en $YYYYMM"
  echo ""
  if [ -n "$ANY_INCIDENTAL" ]; then
    [ -n "$INC_USER" ]      && { echo "### user/";      echo "$INC_USER";      echo ""; }
    [ -n "$INC_FEEDBACK" ]  && { echo "### feedback/";  echo "$INC_FEEDBACK";  echo ""; }
    [ -n "$INC_PROJECT" ]   && { echo "### project/";   echo "$INC_PROJECT";   echo ""; }
    [ -n "$INC_REFERENCE" ] && { echo "### reference/"; echo "$INC_REFERENCE"; echo ""; }
  else
    echo "_Sin memorias incidentales modificadas en $YYYYMM._"
  fi
  echo ""

  if [ -z "$DECISIONS$ERRORS$ANY_INCIDENTAL" ]; then
    echo "## Cierre"
    echo ""
    echo "Sin actividad registrada este mes."
  fi
} > "$OUT"

SIZE="$(wc -c <"$OUT" | tr -d ' ')"
echo "ok: snapshot generado en $OUT (size: ${SIZE} bytes)."

# Auto-commit + auto-push fail-soft.
if [ -x "$COMMIT" ]; then
  bash "$COMMIT" "memoria: snapshot mensual $YYYYMM"
else
  echo "WARN: $COMMIT no es ejecutable — saltando auto-commit." >&2
fi

exit 0
