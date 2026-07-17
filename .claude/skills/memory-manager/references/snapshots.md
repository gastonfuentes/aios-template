# Snapshots mensuales

> Cron `monthly-memory-snapshot` (1° de cada mes a las 5:00am Guadalajara) genera `historial/<YYYY-MM>.md` con el digest del mes anterior. Sirve como vista ejecutiva para el yo de dentro de 6 meses.

---

## Qué cubre cada snapshot

El archivo `historial/<YYYY-MM>.md` cubre el mes calendario natural. Si el cron corre el 1 de junio 2026, el snapshot cubre `2026-05` (mayo completo).

Contenido:

1. **Frontmatter** con `last_updated` (fecha del run del cron), `update_frequency: low` (un snapshot por mes, no se actualiza después), `volatility: snapshot`.
2. **Encabezado** `# Snapshot mensual — YYYY-MM` + fecha de generación.
3. **Sección Decisiones** — copia de los bloques de `decisiones.md` cuya fecha (extraída del título `## YYYY-MM-DD: ...`) cae en el mes cubierto.
4. **Sección Errores aprendidos** — análogo, desde `errores-aprendidos.md`.
5. **Sección Memorias incidentales** — lista de archivos en `user/`, `feedback/`, `project/`, `reference/` cuyo `last_updated` (frontmatter) cae en el mes. Solo títulos + path + descripción de 1 línea, no cuerpo entero (el operador navega al archivo si quiere).
6. **Sección Cierre** — opcional. Si todas las secciones están vacías: "Sin actividad registrada este mes."

---

## Contrato del cron

- **Schedule**: `0 5 1 * *` (1° de mes, 5:00 Guadalajara). El TZ se respeta vía `SCHEDULER_TZ='America/Mexico_City'` que `scheduler.ts` ya importa de `config.ts`.
- **Categoría**: `cron-reports` (reusa la sesión SDK semanal de `daily-briefing-6am` y `nightly-community-pulse`). Razón: los tres son reportes generados sobre el estado del mundo. Si tras 1-2 meses de uso el snapshot mensual contamina la sesión, mover a categoría propia `'cron-memory'`.
- **Prompt**: con `SECURITY_PREAMBLE` heredado, instruye al SDK invocar la skill `memory-manager` modo snapshot. La skill ejecuta `bash .claude/skills/memory-manager/scripts/snapshot-month.sh` desde `PROJECT_ROOT`.
- **`last_result` en `/cron`**: el script imprime a stdout el path del archivo creado + size. El daemon captura ese stdout como `last_result` y lo muestra en la card.

---

## Idempotencia

Si `historial/<YYYY-MM>.md` ya existe, el script es no-op:

- Loguea info "snapshot ya existe, no se regenera".
- Retorna 0 (no error).
- No commitea.

Razón: el operador puede correr "Run now" varias veces sin pisar el snapshot original. Si quiere regenerar (ej. después de agregar un bloque retroactivo a `decisiones.md` con fecha del mes pasado), debe borrar el archivo a mano (`rm .claude/memory/historial/2026-05.md`) y re-correr.

---

## Qué NO hace el snapshot

- No edita `decisiones.md` ni `errores-aprendidos.md`. Solo lee.
- No agrega resumen IA. El SDK puede leer el snapshot y resumirlo cuando el operador se lo pida — eso es trabajo del SDK en runtime, no del cron.
- No comprime ni rota archivos viejos en `historial/`. Crece linealmente. Si en años duele, otro PRP lo aborda.
- No notifica al iPhone vía push. Eso depende de Fase 10 (`/api/openclaw/event` + Cloudflare Tunnel). Mientras tanto, el operador ve el snapshot al abrir `/cron` en MC.

---

## Si dos snapshots se solapan

Caso patológico: el operador hace "Run now" justo cuando el cron natural también dispara, ambos arrancan en paralelo. El segundo en llegar al `[ -f historial/<YYYY-MM>.md ]` se vuelve no-op por la idempotencia. El primero gana. No hay carrera de escritura porque el script crea el archivo y commit+push antes de salir.

Si por una razón rara dos archivos se generan (ej. en distinta hora, un edge case del filesystem), el segundo run pisaría el primero. La protección es la idempotencia — no hay manera limpia de que esto ocurra en operación normal.

---

## Política de retención

No hay. Append solo. Si en años el directorio crece a cientos de MB (improbable — cada snapshot pesa pocos KB), evaluar otro PRP.

---

## Validación manual del snapshot

Tras un run (manual o natural):

```bash
ls .claude/memory/historial/                          # nuevo archivo aparece
head -20 .claude/memory/historial/<YYYY-MM>.md        # frontmatter + título correcto
git log -1 --oneline                                   # commit "memoria: snapshot mensual <YYYY-MM>"
git status                                             # clean
```

Si el archivo está vacío de bloques (solo encabezado + "Sin actividad registrada este mes."): correcto si efectivamente no hubo decisiones ni errores ni archivos incidentales modificados en el mes.

Si el archivo tiene bloques esperados ausentes: probable bug del parser. El script extrae las fechas de los títulos `## YYYY-MM-DD: ...` con regex bash. Si algún bloque en `decisiones.md` no sigue esa convención (ej. `## Decisión sobre pricing`, sin fecha), no aparece en el snapshot. Documentar como aprendizaje.
