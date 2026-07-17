# Calendar cheatsheet — `gog` CLI

> Comandos `gog calendar` que el SDK invoca al activar `google-workspace`. Todos con `--account=your-email@example.com` explícito y timezone Guadalajara `-06:00` cuando aplique.

## Listar eventos

```bash
# Eventos de hoy
gog calendar events primary \
  --from $(date +%Y-%m-%dT00:00:00) \
  --to $(date +%Y-%m-%dT23:59:59) \
  --account=your-email@example.com --json

# Eventos de mañana
gog calendar events primary \
  --from $(date -v+1d +%Y-%m-%dT00:00:00) \
  --to $(date -v+1d +%Y-%m-%dT23:59:59) \
  --account=your-email@example.com --json

# Eventos próximos 7 días
gog calendar events primary \
  --from $(date +%Y-%m-%dT00:00:00) \
  --to $(date -v+7d +%Y-%m-%dT23:59:59) \
  --account=your-email@example.com --json
```

## Crear eventos

```bash
# Evento simple en primary calendar
gog calendar create primary \
  --summary "Llamada con cliente X" \
  --from 2026-05-07T10:00:00 \
  --to 2026-05-07T11:00:00 \
  --account=your-email@example.com

# Evento con descripción
gog calendar create primary \
  --summary "Grabación video YouTube #45" \
  --description "Tema: arquitectura del template. Setup: laptop del operador + cámara." \
  --from 2026-05-08T15:00:00 \
  --to 2026-05-08T17:00:00 \
  --account=your-email@example.com

# Evento en calendario específico (usar calendar ID)
gog calendar create [CALENDAR_ID] \
  --summary "Sesión YOUR_COMMUNITY" \
  --from 2026-05-10T19:00:00 \
  --to 2026-05-10T20:30:00 \
  --account=your-email@example.com
```

## Calendar IDs útiles

El operador documenta sus calendar IDs en `.claude/memory/preferencias.md`. Default:

| Calendario | ID | Uso |
|------------|----|----|
| Personal | `your-email@example.com` | Default personal calendar |
| (otros) | (configurar via `gog calendar list`) | — |

Para listar calendarios disponibles:

```bash
gog calendar list --account=your-email@example.com --json
```

## Reglas

- **Confirmar antes de borrar o modificar** un evento existente. El operador puede tener compromisos importantes.
- **Timezone explícito** cuando el formato lo soporte (`2026-05-07T10:00:00-06:00`).
- **`--account=` siempre** — nunca defaults globales.
