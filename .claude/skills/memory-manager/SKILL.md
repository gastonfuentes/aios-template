---
name: memory-manager
description: "Gestiona la memoria persistente del proyecto AIOS como archivos .md versionados en .claude/memory/, con auto-commit y auto-push tras cada escritura, y cero inyección automática al prompt del SDK. Lee bajo demanda cuando el operador menciona recordar, recuerdas, te acuerdas, qué sabes de, en qué quedamos, memoria, guarda esto, no olvides, anota, registra, recuerda que. Reemplaza la auto-memory de Claude Code (que vive local en ~/.claude/projects/) con memoria portable, auditable y compartible vía git pull entre la máquina principal del operador y el segunda máquina del operador."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# memory-manager — Cerebro digital del operador en `.claude/memory/`

> Memoria persistente como `.md` plano en Git. Visible, editable, versionada, portable. Cero inyección automática (FIX 4 de AIOS).
>
> Esta skill se descubre por triggers semánticos en el mensaje del operador. Sin trigger, no se activa — el SDK responde sin memoria, exactamente igual que hoy. Con trigger, lee el archivo concreto bajo `.claude/memory/`, compone respuesta cita-en-mano, y si el flujo lo pide, escribe + commitea + pushea.

---

## Cuándo activar

- "¿qué sabes de X?" / "¿te acuerdas de Y?" / "¿en qué quedamos con Z?" → **lectura dirigida**.
- "guarda esto" / "no olvides Y" / "anota X" / "registra que Z" / "recuerda que" → **registro de info**.
- Mensaje contiene una **decisión estratégica** o **error+fix** que el operador comparte explícitamente con intención de persistirlo → registro.
- Cron `monthly-memory-snapshot` invoca la skill modo snapshot → ejecuta `scripts/snapshot-month.sh`.
- Activación manual via `/memory-manager` slash si el operador lo prefiere.

## Cuándo NO activar

- Mensaje conversacional sin trigger semántico (la skill no debe especular qué guardar).
- Tareas que ya tienen otra skill mejor: `prp` para planes, `bucle-agentico` para ejecución, `brief` para articular ideas. La memoria es soporte, no orquestador.
- Cron jobs que no piden snapshot — `daily-briefing-6am` y `nightly-community-pulse` NO escriben memoria. Solo `monthly-memory-snapshot` lo hace.

## Antes de empezar

Verificar empíricamente:

- [ ] `.claude/memory/` existe (creado por `scripts/init-memory.sh` la primera vez).
- [ ] `.claude/settings.json` tiene `"autoMemoryEnabled": false` (escrito por la sub-fase de bootstrap; coexiste con `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` y `hooks.PostToolUse[]` ya presentes).
- [ ] `git config user.email` retorna un valor (necesario para auto-commit).
- [ ] El repo es un repo git (`git rev-parse --is-inside-work-tree`).

Si alguno falla en la primera activación, ejecutar `bash .claude/skills/memory-manager/scripts/init-memory.sh` (idempotente — solo crea lo que falta).

---

## Arquitectura de la memoria

```
.claude/memory/
├── README.md                    índice navegable + cómo funciona la memoria
├── MEMORY.md                    índice operativo, max 200 líneas, se carga al activar la skill
├── business-context.md          mi negocio, modelos, prioridades, audiencias
├── preferencias.md              voz, formato, idioma, atajos
├── tech-stack.md                Trust Stack AIOS + decisiones técnicas heredadas
├── people.md                    Daniel Carreón, mentores, colaboradores
├── decisiones.md                APPEND-ONLY: decisiones estratégicas con fecha
├── errores-aprendidos.md        APPEND-ONLY: errores resueltos + fix + dónde aplica
├── user/                        memorias incidentales sobre el operador (Daniel pattern)
├── feedback/                    correcciones del operador (Daniel pattern)
├── project/                     estado de iniciativas en curso (Daniel pattern)
├── reference/                   patrones descubiertos, dónde encontrar cosas (Daniel pattern)
├── historial/                   snapshots mensuales <YYYY-MM>.md
└── proyectos-activos/
    ├── praxis.md
    ├── your-community-slug.md
    └── aios.md
```

Cada archivo nominativo (raíz + `proyectos-activos/`) arranca con frontmatter YAML:

```yaml
---
last_updated: YYYY-MM-DD
update_frequency: low | medium | high
volatility: stable | evolving | snapshot
---
```

Ver `references/memory-anatomy.md` para semántica completa de cada archivo, regla de naming, y umbral de tamaño (>300 líneas → split + ToC).

---

## Flujo principal

### Lectura dirigida (trigger "¿qué sabes de X?", "¿te acuerdas de Y?", "¿en qué quedamos?")

1. Leer `.claude/memory/MEMORY.md` (índice operativo, ≤ 200 líneas — barato).
2. Identificar el archivo de detalle relevante por dominio (raíz nominativa) o por carpeta incidental (`user/`, `feedback/`, `project/`, `reference/`).
3. Leer ese archivo con `Read`.
4. Si la respuesta no está en ese archivo, ejecutar `Grep -ri "<keyword>" .claude/memory/` para barrer la memoria.
5. Componer respuesta citando el archivo: "Según `business-context.md`...". Razón: el operador puede auditar la fuente abriendo el archivo.
6. Si tras el barrido nada matchea, responder honestamente "no tengo eso en memoria" — jamás inventar. Esto es la regla cardinal: la memoria es source of truth, no espejo de imaginación.

### Registro de info (trigger "guarda esto", "anota", "registra", "recuerda que")

1. **Clasificar el riesgo**:
   - **Bajo riesgo** (procede sin preguntar):
     - Append a `decisiones.md` o `errores-aprendidos.md` (siempre se agrega bloque al final).
     - Crear archivo nuevo en `user/`, `feedback/`, `project/`, `reference/`.
     - Crear archivo nuevo en `proyectos-activos/`.
   - **Alto riesgo** (mostrar diff y confirmar 1-vez antes):
     - Sobreescribir un archivo nominativo existente (`business-context.md`, `preferencias.md`, `tech-stack.md`, `people.md`, `proyectos-activos/<existente>.md`).
2. **Determinar archivo destino**:
   - Decisión estratégica → `decisiones.md` (append).
   - Error técnico resuelto + fix → `errores-aprendidos.md` (append).
   - Hecho nuevo sobre una persona → editar `people.md` o crear archivo en `user/`/`reference/` según correspondencia.
   - Cambio de preferencia técnica/voz/formato → `preferencias.md` (alto riesgo si pisa preferencia previa).
   - Decisión sobre el negocio (pricing, modelo, audiencia) → `business-context.md` o `decisiones.md` (append).
3. **Escribir** con `Edit` (preferido) si es append, o con `Write` si es archivo nuevo. Nunca usar `Write` sobre `decisiones.md` o `errores-aprendidos.md` — se pisa el contenido (ver `references/append-only-policy.md`).
4. **Actualizar el frontmatter `last_updated: YYYY-MM-DD`** del archivo modificado, salvo en `decisiones.md` y `errores-aprendidos.md` (append-only, frontmatter solo se toca si cambia el `volatility`).
5. **Disparar auto-commit + auto-push** ejecutando `bash .claude/skills/memory-manager/scripts/memory-commit.sh "memoria: <accion> <archivo>"` (formato canónico: `memoria: append decisiones.md`, `memoria: actualizar tech-stack.md`, `memoria: nuevo proyectos-activos/cutflow.md`).
6. **Confirmar al operador** en una línea: "Anoté en `decisiones.md`."

### Snapshot mensual (trigger: cron `monthly-memory-snapshot` invoca la skill)

1. Calcular el mes anterior al día actual: si hoy es 1 de junio 2026, el snapshot cubre `2026-05`.
2. Ejecutar `bash .claude/skills/memory-manager/scripts/snapshot-month.sh`.
3. El script arma `.claude/memory/historial/<YYYY-MM>.md` con: bloques de `decisiones.md` y `errores-aprendidos.md` con fecha en el rango del mes, títulos de archivos en `user/`/`feedback/`/`project/`/`reference/` con `last_updated` en el mes, y commit+push.
4. Si el snapshot del mes ya existe, el script es no-op (idempotente). Documentar el resultado en la respuesta.

Ver `references/snapshots.md` para detalles del formato del archivo histórico y política de retención (no hay — append solo).

---

## Reglas de oro

1. **Consultar es gratis, escribir es caro.** Lee memoria seguido. Escribe solo cuando el conocimiento sobrevive a la sesión actual.
2. **Fechas absolutas siempre.** "Jueves" → "2026-05-07". Las memorias se leen semanas o meses después.
3. **Un archivo por tema.** No mezclar. Si un archivo crece > 300 líneas, dividir y agregar Table of Contents al inicio.
4. **El operador es el dueño.** Puede borrar, editar, revertir cualquier memoria a mano. La skill no borra sin que el operador lo pida.
5. **Sin duplicados con `CLAUDE.md`.** Si algo ya está en `CLAUDE.md` raíz del proyecto, no repetirlo en memoria — referenciarlo.
6. **Honestidad sobre límites.** Si la memoria no tiene el dato, decirlo. Inventar erosiona la confianza del operador en todo el sistema.
7. **Append-only inviolable** en `decisiones.md` y `errores-aprendidos.md`. Solo `Edit` que agrega bloque al final. Ver `references/append-only-policy.md`.
8. **Auto-commit + auto-push tras cada escritura.** Sin excepciones. Si push falla, log WARN y sigue (fail-soft — ver `references/git-policy.md`).
9. **Cero inyección al prompt del SDK.** La skill se activa por trigger explícito. Sin trigger, el agente responde sin memoria. La tabla SQLite `memories` y FTS5 del template Daniel siguen ausentes del schema (FIX 4 de AIOS, decisión cardinal).

---

## Cross-references con skills hermanas

- [`@.claude/skills/bucle-agentico/SKILL.md`](../bucle-agentico/SKILL.md) — al cerrar cada PRP, el bucle propaga aprendizajes a `CLAUDE.md`. Si el aprendizaje también merece vivir en memoria operativa del operador (ej. una preferencia descubierta), la skill `memory-manager` lo escribe en `errores-aprendidos.md` o `preferencias.md`.
- [`@.claude/skills/prp/SKILL.md`](../prp/SKILL.md) — al generar un PRP, el agente puede consultar `business-context.md` y `decisiones.md` para alinear el plan con el contexto operativo (ej. el pricing real de YOUR_COMMUNITY, la prioridad del trimestre).
- [`@.claude/skills/brief/SKILL.md`](../brief/SKILL.md) — al articular un brief nuevo, el agente puede leer `business-context.md` para sembrar la sección "Mi Vision" sin re-preguntar al operador info ya conocida.

---

## Archivos lazy-loaded (`references/`)

- [`references/memory-anatomy.md`](references/memory-anatomy.md) — semántica de cada archivo de memoria, frontmatter, regla de naming, umbral de tamaño. Leer al crear un archivo nuevo o al dudar dónde escribir algo.
- [`references/git-policy.md`](references/git-policy.md) — detalles del auto-commit + auto-push, formato del mensaje, fail-soft cuando push falla, comportamiento ante divergencia con remoto. Leer al revisar logs de `memory-commit.sh` o si el operador reporta que un cambio no llegó a la otra máquina.
- [`references/append-only-policy.md`](references/append-only-policy.md) — reglas inviolables para `decisiones.md` y `errores-aprendidos.md`. Leer antes de editar cualquiera de los dos.
- [`references/snapshots.md`](references/snapshots.md) — formato y semántica de los archivos en `historial/`, contrato del cron mensual, qué hacer si dos snapshots se solapan. Leer al ejecutar el snapshot manual desde `/cron`.
- [`references/seed-business-context.md`](references/seed-business-context.md) — contenido seed para `business-context.md` extraído del brief master. `init-memory.sh` lo usa al sembrar.

## Scripts ejecutables (`scripts/`)

- `scripts/init-memory.sh` — idempotente. Crea `.claude/memory/` con la estructura completa. Re-correrlo no rompe nada.
- `scripts/memory-commit.sh "<msg>"` — `git add .claude/memory && git commit -m "<msg>" && git push origin main`, con fail-soft en push. Llamar después de cada `Write`/`Edit` exitoso a `.claude/memory/`.
- `scripts/snapshot-month.sh` — arma `historial/<YYYY-MM-anterior>.md` y commitea+pushea. Llamado por el cron `monthly-memory-snapshot` o manualmente desde `/cron`.

## Evals (`evals/evals.json`)

3 escenarios mínimos validan que la skill cumple los 3 workflows: lectura dirigida, registro de decisión, snapshot mensual. Ejecutar manualmente — Skills 2.0 no tiene runner built-in. Útiles como contrato reproducible al iterar la skill.

---

## Auto-memory de Claude Code

La auto-memory nativa de Claude Code (en `~/.claude/projects/<encoded-cwd>/memory/`) está **desactivada** vía `"autoMemoryEnabled": false` en `.claude/settings.json`. Razón: vive local a la máquina, no se versiona, no se sincroniza varias máquinas del operador, y duplica con esta skill. Si el operador la reactivó a propósito (`true`), la skill loguea WARN y coexiste — el operador decide.

---

## Validación al cerrar (smoke tests manuales)

```bash
# Workflow 1: lectura dirigida
# (en MC /chat o Telegram, escribir "¿qué sabes de Daniel Carreón?" y ver que cita people.md)

# Workflow 2: registro de decisión
# (en MC /chat, escribir "anota que voy a cambiar el lifetime a $497")
tail -10 .claude/memory/decisiones.md          # bloque nuevo al final
git log -1 --oneline -- .claude/memory          # commit "memoria: append decisiones.md"
git status                                      # clean

# Workflow 3: snapshot manual
# (en MC /cron, click "Run now" en monthly-memory-snapshot)
ls .claude/memory/historial/                   # <YYYY-MM-anterior>.md aparece
git log -1 --oneline                            # commit "memoria: snapshot mensual <YYYY-MM>"
```

Y la auditoría estructural del bundle Skills 2.0:

```bash
wc -l .claude/skills/memory-manager/SKILL.md   # ≤ 500
ls .claude/skills/memory-manager/references/   # 5 archivos
find .claude/skills/memory-manager/references -mindepth 2 -type f  # vacío (one-level-deep)
node -e "JSON.parse(require('fs').readFileSync('.claude/skills/memory-manager/evals/evals.json','utf-8'))"  # parsea
```
