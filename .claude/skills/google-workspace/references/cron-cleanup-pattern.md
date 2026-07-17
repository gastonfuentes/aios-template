# Patrón cleanup nightly del inbox

> Patrón canónico para crons del daemon AIOS (Fase 10+) que automaticen archive de correos de bajo valor. Ejecutado por el SDK desde la skill `google-workspace`, NO directamente desde `agent-server/scripts/`.

## Algoritmo

```bash
# 1. Por cada label low-value, listar y archivar
for label in PROMOTIONS NEWSLETTERS NOTIFICATIONS; do
  gog gmail search "in:inbox label:$label newer_than:7d" \
    --account=your-email@example.com --max 100 --json | \
    jq -r '.[].id' | \
    while read msgId; do
      gog gmail messages modify "$msgId" \
        --remove-labels INBOX --account=your-email@example.com
    done
done

# 2. Contar inbox restante
inbox_count=$(gog gmail search "in:inbox" \
  --account=your-email@example.com --max 1 --json | jq -r '.totalResultsEstimate // 0')

# 3. Decisión
if [ "$inbox_count" -gt 20 ]; then
  echo "ALERT: inbox > 20 — revisar manualmente"
elif [ -z "$inbox_count" ]; then
  echo "ERROR: no se pudo leer inbox"
else
  echo ""  # silencio si está normal
fi
```

## Reglas

- **Solo archivar** (`--remove-labels INBOX`), nunca borrar.
- **Cap `--max 100`** — si hay más, lo siguiente run los toma.
- **Output silente** cuando todo está normal — solo emitir alert si necesita atención del operador.
- **Cron schedule sugerido**: nightly 23:30 Guadalajara, justo antes de `nightly-community-pulse`. Categoría `cron-reports` para reusar weekly session.

## Integración con `nightly-community-pulse`

Si Fase 10 quiere agregar este cron, el seed va en `agent-server/src/scheduler.ts` siguiendo el patrón de PRP-007/PRP-008. El prompt del cron debe instruir al SDK invocar `google-workspace` modo cleanup, no inventar el algoritmo.
