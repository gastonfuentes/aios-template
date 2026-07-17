#!/usr/bin/env bash
# Convierte un directorio de PNG/JPG a WebP optimizado en paralelo.
# Uso: ./scripts/optimize-batch.sh <input-dir> [output-dir]

set -euo pipefail

INPUT="${1:-}"
OUTPUT="${2:-${INPUT}-webp}"

if [ -z "$INPUT" ] || [ ! -d "$INPUT" ]; then
  echo "Uso: $0 <input-dir> [output-dir]"
  exit 1
fi

mkdir -p "$OUTPUT"

for img in "$INPUT"/*.{png,jpg,jpeg,PNG,JPG,JPEG}; do
  [ -f "$img" ] || continue
  name=$(basename "${img%.*}")
  out="$OUTPUT/$name.webp"

  if [ -f "$out" ]; then
    echo "skip: $out (existe)"
    continue
  fi

  npx sharp-cli -i "$img" -o "$out" -- webp --quality=85 &
done

wait
echo "Listo. Tamaños finales:"
du -sh "$OUTPUT"/*.webp 2>/dev/null | sort -h | tail -10
