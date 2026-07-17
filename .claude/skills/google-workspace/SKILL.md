---
name: google-workspace
description: "Opera Gmail y Google Calendar via el CLI gog. Cubre búsqueda y archive de inbox, listado y creación de eventos, lectura de calendarios múltiples, automation flags --json/--no-input/--max y patrón de cleanup nightly del inbox para crons del agente. Activar cuando el operador menciona email, correo, calendario, calendar, agenda, evento, schedule, inbox, gmail, gog, agendar, archivar correos, limpiar bandeja."
allowed-tools: Read, Write, Bash
---

# Google Workspace via `gog` CLI

> Skill heredada del template `business-os-template` de Daniel Carreón, refactor a Skills 2.0 al cerrar Fase 9 de AIOS.

---

## Cuando activar

- "¿Qué tengo hoy en el calendario?"
- "Búscame los correos sin leer."
- "Agéndame una llamada con X mañana 10am."
- "Limpia el inbox de promociones de los últimos 7 días."
- "¿Cuántos correos tengo en bandeja?"

## Cuando NO activar

- Email transaccional desde la app (signup, reset password) — eso es Resend/Supabase Auth, no `gog`.
- Calendar visual rendering — eso es UI de MC `/calendar`, lectura via Supabase `calendar_events`, no via `gog` directo.
- Confirmar que el operador tiene `gog` instalado y configurado: si `which gog` retorna vacío, escalar c1 con instrucción simple.

---

## Setup operacional (c1 del operador, primera vez)

`gog` es CLI externo no incluido por default. Documentar al operador:

1. Instalar `gog` siguiendo la documentación oficial del CLI.
2. Autenticar la cuenta `your-email@example.com` con `gog auth login --account=your-email@example.com`.
3. Confirmar con `gog gmail labels list --account=your-email@example.com --json`.

Cuentas configuradas en AIOS:

| Cuenta | Servicios | Uso |
|--------|-----------|-----|
| `your-email@example.com` | gmail, calendar | Personal + GitHub repo |

---

## Automation flags (siempre en cron + scripted contexts)

- `--json` — output machine-readable.
- `--no-input` — nunca prompt interactivo.
- `--max N` — limitar resultados (default 25 suele ser exceso).
- `--account=<email>` — explícito siempre, nunca confiar en defaults.

---

## Comandos Gmail

Cheatsheet completo en [`references/gmail-cheatsheet.md`](references/gmail-cheatsheet.md). Comandos más usados:

```bash
# Inbox unread (top 10)
gog gmail messages search "in:inbox is:unread" --account=your-email@example.com --max 10 --json

# Archive (remove INBOX label)
gog gmail messages modify <messageId> --remove-labels INBOX --account=your-email@example.com

# Send plain text
gog gmail send --to recipient@example.com --subject "Subject" --body "Text" --account=your-email@example.com

# Send multi-line via stdin
gog gmail send --to recipient@example.com --subject "Subject" --body-file - --account=your-email@example.com <<'EOF'
Cuerpo del mensaje aquí.
EOF
```

---

## Comandos Calendar

Cheatsheet completo en [`references/calendar-cheatsheet.md`](references/calendar-cheatsheet.md). Comandos más usados:

```bash
# Eventos de hoy
gog calendar events primary --from $(date +%Y-%m-%dT00:00:00) --to $(date +%Y-%m-%dT23:59:59) --account=your-email@example.com --json

# Eventos de mañana
gog calendar events primary --from $(date -v+1d +%Y-%m-%dT00:00:00) --to $(date -v+1d +%Y-%m-%dT23:59:59) --account=your-email@example.com --json

# Crear evento (calendar primario)
gog calendar create primary --summary "Llamada con cliente X" --from 2026-05-07T10:00:00 --to 2026-05-07T11:00:00 --account=your-email@example.com
```

Calendar IDs adicionales que el operador puede haber configurado se documentan en [`references/calendar-cheatsheet.md`](references/calendar-cheatsheet.md).

---

## Patrón cleanup inbox (cron job futuro)

Cuando un cron del daemon (Fase 10+) quiera limpiar el inbox:

1. Buscar cada label de bajo valor en inbox:
   - `in:inbox label:PROMOTIONS newer_than:7d`
   - `in:inbox label:NEWSLETTERS newer_than:7d`
   - `in:inbox label:NOTIFICATIONS newer_than:7d`
2. Archivar cada message (remove INBOX label).
3. Contar inbox restante: `gog gmail search "in:inbox" --max 1 --json`.
4. Retornar string vacío si todo normal; alert si inbox > 20 o si hubo error.

Patrón documentado completo en [`references/cron-cleanup-pattern.md`](references/cron-cleanup-pattern.md).

---

## Reglas de seguridad

- **NUNCA enviar email sin aprobación explícita del operador.** El operador debe ver el draft antes de que el SDK invoque `gog gmail send`.
- **NUNCA borrar emails — solo archivar** (remove INBOX label). El delete es destructivo y no recuperable.
- **Confirmar acciones destructivas en calendar** (`delete`, modificación de eventos existentes) con A/B/C en lenguaje cotidiano antes de ejecutar.
- **Usar `--account=` flag en TODO comando** — nunca confiar en defaults globales.
- **Siempre incluir timezone offset en fechas** (e.g., `-06:00` para Guadalajara) cuando el formato lo soporte.

---

## Integración con AIOS

- **`calendar_events` Supabase**: la tabla en MC almacena snapshots/copias de eventos para que el dashboard `/calendar` (Fase 10) pueda renderizar sin pegar a Google. La skill `google-workspace` opera Google directo; un cron futuro (Fase 10+) sincroniza Google ↔ Supabase.
- **`tasks` con label `email-followup`**: si el operador pide "convierte este correo en tarea", la skill crea una row en `public.tasks` con metadata apuntando al `messageId` y label `email-followup`. Ver [`@.claude/skills/aios-supabase/SKILL.md`](../aios-supabase/SKILL.md) para el patrón de INSERT.

---

## Cross-references

- [`@.claude/skills/aios-supabase/SKILL.md`](../aios-supabase/SKILL.md) — para tablas relacionadas (`calendar_events`, `tasks`).
- [`@.claude/skills/memory-manager/SKILL.md`](../memory-manager/SKILL.md) — si el operador pide guardar un correo importante como memoria, registrar via `memory-manager` modo append.

---

## Reference Files

- [`references/gmail-cheatsheet.md`](references/gmail-cheatsheet.md) — comandos Gmail completos (search, archive, label, send variantes).
- [`references/calendar-cheatsheet.md`](references/calendar-cheatsheet.md) — comandos Calendar completos (list, create, modify, delete con confirmación).
- [`references/cron-cleanup-pattern.md`](references/cron-cleanup-pattern.md) — patrón completo de cleanup nightly para crons del daemon.
