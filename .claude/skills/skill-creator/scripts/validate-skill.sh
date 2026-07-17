#!/usr/bin/env bash
# Valida una skill contra Skills 2.0 spec.
# Uso: ./scripts/validate-skill.sh injectable/agentic/skills/<id>/

set -euo pipefail

DIR="${1:-}"
if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
  echo "Uso: $0 <path-a-carpeta-skill>"
  exit 1
fi

SKILL="$DIR/SKILL.md"

if [ ! -f "$SKILL" ]; then
  echo "FAIL: no existe $SKILL"
  exit 1
fi

errors=0

# 1. Frontmatter presente
if ! head -1 "$SKILL" | grep -q "^---$"; then
  echo "FAIL: frontmatter no abre con ---"
  errors=$((errors+1))
fi

# 2. name regex
NAME=$(grep -m 1 "^name:" "$SKILL" | sed 's/^name:[[:space:]]*//' | tr -d '"')
if ! echo "$NAME" | grep -qE "^[a-z0-9-]{1,64}$"; then
  echo "FAIL: name invalido ('$NAME') — debe matchear ^[a-z0-9-]{1,64}\$"
  errors=$((errors+1))
fi

# 3. name no contiene reserved words
if echo "$NAME" | grep -qiE "anthropic|claude"; then
  echo "FAIL: name contiene reserved word ('$NAME')"
  errors=$((errors+1))
fi

# 4. description presente y no vacia
DESC=$(awk '/^description:/{flag=1; sub(/^description:[[:space:]]*/, ""); print; flag=0; next}' "$SKILL" | head -1)
if [ -z "$DESC" ] || [ "$DESC" = '""' ]; then
  echo "FAIL: description vacia o ausente"
  errors=$((errors+1))
fi

# 5. description ≤ 1024 chars (aproximado, solo cuenta primera linea)
DESC_LEN=$(echo -n "$DESC" | wc -c | tr -d ' ')
if [ "$DESC_LEN" -gt 1024 ]; then
  echo "FAIL: description >1024 chars ($DESC_LEN)"
  errors=$((errors+1))
fi

# 6. Body < 500 lineas
LINES=$(wc -l < "$SKILL" | tr -d ' ')
if [ "$LINES" -gt 500 ]; then
  echo "FAIL: SKILL.md $LINES lineas (>500)"
  errors=$((errors+1))
fi

# 7. Bundle structure canonico (no carpetas custom)
for d in "$DIR"/*/; do
  base=$(basename "$d")
  case "$base" in
    references|scripts|assets) ;;
    *)
      echo "WARN: carpeta no canonica '$base' — usar references/, scripts/, o assets/"
      ;;
  esac
done

# 8. Files >300 lineas en references tienen TOC
if [ -d "$DIR/references" ]; then
  for f in "$DIR"/references/*.md; do
    [ -f "$f" ] || continue
    flines=$(wc -l < "$f" | tr -d ' ')
    if [ "$flines" -gt 300 ]; then
      if ! grep -qE "^## (Tabla de contenidos|Contents|TOC)" "$f"; then
        echo "WARN: $f tiene $flines lineas pero no tiene TOC al inicio"
      fi
    fi
  done
fi

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "Validacion: FAIL con $errors errores"
  exit 1
fi

echo "Validacion OK: $SKILL ($LINES lineas, name='$NAME')"
