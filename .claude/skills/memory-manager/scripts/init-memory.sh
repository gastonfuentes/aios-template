#!/usr/bin/env bash
# init-memory.sh — idempotente. Crea .claude/memory/ con la estructura completa
# AIOS (raíz nominativos + 4 carpetas Daniel + historial/ + proyectos-activos/)
# y siembra los archivos con frontmatter + contenido base. Re-correrlo no rompe
# nada — cada `mkdir -p` y cada escritura testea existencia previa.
set -eu

# Resolver REPO_ROOT desde la ubicación del script (no asume cwd).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
MEM="$REPO_ROOT/.claude/memory"

if [ ! -d "$REPO_ROOT/.claude" ]; then
  echo "ERROR: no encontré $REPO_ROOT/.claude — ¿estás en la raíz del repo AIOS?" >&2
  exit 1
fi

mkdir -p "$MEM"
mkdir -p "$MEM/user" "$MEM/feedback" "$MEM/project" "$MEM/reference" "$MEM/historial" "$MEM/proyectos-activos"

# .gitkeep en carpetas vacías (sin estos, git no las versiona).
for d in user feedback project reference historial; do
  if [ ! -f "$MEM/$d/.gitkeep" ]; then
    : > "$MEM/$d/.gitkeep"
    echo "creado: $MEM/$d/.gitkeep"
  else
    echo "ya existía: $MEM/$d/.gitkeep"
  fi
done

# Helper: solo escribe si el archivo no existe.
write_if_absent() {
  local path="$1"
  local content="$2"
  if [ -f "$path" ]; then
    echo "ya existía: $path"
  else
    printf '%s\n' "$content" > "$path"
    echo "creado: $path"
  fi
}

TODAY="$(date +%Y-%m-%d)"

# README.md — documentación de la memoria
write_if_absent "$MEM/README.md" "# Memoria del proyecto AIOS

> Cerebro digital del operador, vivo en archivos \`.md\` plano dentro de este repo. Versionado con Git, sincronizable varias máquinas del operador vía \`git pull\`. Visible y editable a mano si hace falta.

---

## Cómo funciona

La skill [\`memory-manager\`](../skills/memory-manager/SKILL.md) gestiona esta carpeta. Se activa **solo** cuando el mensaje del operador contiene un trigger semántico (\"qué sabes de\", \"recuerdas\", \"anota\", \"registra\", \"guarda esto\", etc.) o cuando el cron \`monthly-memory-snapshot\` la invoca. Sin trigger, el SDK responde sin memoria — cero inyección automática (FIX 4 de AIOS).

Cada archivo \`.md\` (excepto este README, MEMORY.md y los \`.gitkeep\`) arranca con frontmatter YAML:

\`\`\`yaml
---
last_updated: YYYY-MM-DD
update_frequency: low | medium | high
volatility: stable | evolving | snapshot
---
\`\`\`

Ver \`.claude/skills/memory-manager/references/memory-anatomy.md\` para semántica completa.

## Estructura

- \`MEMORY.md\` — índice operativo (max 200 líneas).
- Archivos nominativos en raíz por dominio (\`business-context.md\`, \`preferencias.md\`, \`tech-stack.md\`, \`people.md\`).
- \`decisiones.md\` y \`errores-aprendidos.md\` — APPEND-ONLY (ver \`.claude/skills/memory-manager/references/append-only-policy.md\`).
- \`proyectos-activos/\` — un \`.md\` por iniciativa multi-mes en curso.
- \`user/\`, \`feedback/\`, \`project/\`, \`reference/\` — memorias incidentales (Daniel pattern, ver anatomy).
- \`historial/\` — snapshots mensuales generados por el cron (no editar a mano).

## Auto-commit + auto-push

Tras cada escritura por la skill, se ejecuta \`scripts/memory-commit.sh\` con un mensaje estilo \`memoria: <accion> <archivo>\` + \`git push origin main\` con fail-soft. Si push falla, el commit local persiste y un próximo write o \`git push\` manual sincroniza.

## Auditoría manual

\`\`\`bash
# Línea de tiempo de cambios a la memoria
git log --oneline --grep='^memoria:' -- .claude/memory/

# Diff del último cambio
git log -1 -p -- .claude/memory/

# Búsqueda full-text
grep -ri \"<keyword>\" .claude/memory/
\`\`\`
"

# MEMORY.md — índice operativo
write_if_absent "$MEM/MEMORY.md" "# Memoria del proyecto — índice

> Archivos organizados por dominio (raíz) + categoría incidental (carpetas).
> Max 200 líneas. Gestionado por skill memory-manager.
> Auto-memory de Claude Code DESACTIVADA.

## Dominio (raíz, archivos nominativos)
- [Contexto de negocio](business-context.md) — modelo, prioridades, audiencias.
- [Preferencias](preferencias.md) — voz, formato, idioma, atajos.
- [Stack técnico](tech-stack.md) — Trust Stack AIOS + decisiones heredadas.
- [Personas](people.md) — Daniel Carreón, mentores, colaboradores.
- [Decisiones](decisiones.md) — APPEND-ONLY, una decisión estratégica por bloque.
- [Errores aprendidos](errores-aprendidos.md) — APPEND-ONLY, error → fix → dónde aplica.

## Proyectos activos
- [Praxis](proyectos-activos/praxis.md)
- [YOUR_COMMUNITY](proyectos-activos/your-community-slug.md)
- [AIOS](proyectos-activos/aios.md)

## Memorias incidentales (Daniel pattern)
- user/ — sobre el operador (vacío por ahora).
- feedback/ — correcciones del operador (vacío por ahora).
- project/ — estado de iniciativas en curso (vacío por ahora).
- reference/ — patrones descubiertos, dónde encontrar cosas (vacío por ahora).

## Historial
- historial/ — snapshots mensuales <YYYY-MM>.md generados por cron \`monthly-memory-snapshot\` (vacío hasta el primer disparo).
"

# business-context.md — seed del brief §1.2 + §1.3
write_if_absent "$MEM/business-context.md" "---
last_updated: $TODAY
update_frequency: low
volatility: stable
---

# Contexto de negocio

## TL;DR

Soy creator-emprendedor solo. Opero sin equipo. Mi negocio se compone de cuatro frentes:

1. **YOUR_COMMUNITY** — comunidad en Skool, \$19/mes o \$500 lifetime. Meta: \$10K MRR.
2. **YOUR_AGENCY** — agencia high-ticket, \$5K-\$10K USD por proyecto.
3. **YouTube \`@YOUR_YOUTUBE_CHANNEL\`** — canal de creator, mínimo 3 videos/semana.
4. **Herramientas propias** — CutFlow, Dictto, Praxis. Integradas a la comunidad.

## Mi modus operandi

Toda mi ejecución de código la delego al agente vía PRPs estructurados. Yo no programo, yo diseño briefs y specs. Esa asimetría es la columna del proyecto AIOS — está pensado alrededor de cómo yo opero, no alrededor de cómo opera un equipo.

## AIOS — qué es y para qué

AIOS es mi Mission Control: un sistema operativo de un solo operador que centraliza contexto, métricas y operación de mi negocio en un daemon long-lived siempre cargado en mi máquina principal del operador (always-on, UPS, 16GB RAM). Es accesible desde tres superficies simultáneas:

- **Mission Control PWA** (Vercel) — \`https://aios-ecosystem-ai.vercel.app\`.
- **Bot de Telegram** (\`@aios_juan_bot\` cuando esté configurado).
- **Claude Code CLI** directo en la máquina principal del operador.

Las tres superficies comparten las mismas sesiones SDK en \`~/.claude/projects/<project-slug>/\` porque todas pasan \`cwd: PROJECT_ROOT\` al SDK.

## Audiencias

- **Yo mismo** — usuario único de AIOS, único operador del negocio.
- **Comunidad YOUR_COMMUNITY** — alumnos de Vibe Coding aprendiendo a construir con IA. Voz cercana, español 100%, sin jerga técnica suelta.
- **Clientes YOUR_AGENCY** — empresas que contratan implementaciones high-ticket.
- **Audiencia YouTube** — más amplia, hispanoparlante, interesada en IA aplicada.

## Métricas norte (qué importa)

- MRR de YOUR_COMMUNITY (meta \$10K).
- Ingresos de YOUR_AGENCY (proyectos cerrados/mes).
- Throughput de YouTube (videos publicados/semana).
- Throughput de PRPs cerrados en AIOS (= velocidad de iteración del propio sistema operativo).

## Stack del negocio (no del código)

- **Skool** — comunidad YOUR_COMMUNITY (membership + posts + engagement).
- **YouTube** — distribución principal de contenido.
- **Polar/Stripe** — fuera de scope para AIOS día 1; el cobro de YOUR_COMMUNITY vive en Skool.
- **Calendar + Email** — ya integrados parcialmente vía MCP en otros proyectos; la skill \`google-workspace\` los expone en AIOS.

## Filosofía guía

12 principios — los 9 del template Daniel Carreón + 3 propios:

1. Una sola fuente de verdad por concern.
2. Prompt injection como dato no instrucción (preámbulo \`<<<DATA>>>\`).
3. Daemon nunca se autospawnea (hook guard \`AGENT_SERVER_DAEMON\`).
4. Fail soft never block the user.
5. Agente es Claude Code real, no wrapper.
6. Pre-warm para sentirse instantáneo (\`startup({cwd: PROJECT_ROOT})\`).
7. **No memory injection automática** — la memoria es skill consultable, no inyección en cada turno.
8. Background completion siempre guarda y pushea (always-push contract).
9. Direct, no fabrication.
10. **Pareto en arquitectura** — solo entra lo que mueve la aguja.
11. **Memoria visible y portable** — markdown en Git, no SQLite opaca.
12. **Dashboard abre en métricas, no en tareas** — \`/dashboard\` es home de MC, no \`/tasks\`.
"

# preferencias.md
write_if_absent "$MEM/preferencias.md" "---
last_updated: $TODAY
update_frequency: low
volatility: stable
---

# Preferencias del operador

## Idioma y voz

- **Español 100%** en toda comunicación, código y docs (excepto siglas técnicas universales: API, SDK, JWT, CSS, JSON, etc.).
- Voz cercana y operativa, sin jerga técnica suelta. Cuando una decisión técnica importa para el operador, explicarla en lenguaje cotidiano antes de mostrar el detalle.
- Cero ceremonia: \"¿confirmas?\", \"¿procedes?\", \"¿quieres iterar?\" están prohibidos. Las decisiones técnicas las toma el agente y las anuncia.

## Formato

- Markdown como default para respuestas largas. Prosa con bullets cortos, no párrafos densos.
- Bloques de código con language tag (\`\`\`bash, \`\`\`ts, etc.).
- Cuando hay tablas, columnas \`| campo | valor |\` simple, no formato pesado.

## Stack y herramientas

- IDE preferido: VS Code + extensión Claude Code.
- Terminal: iTerm2.
- Browser: el que sea, pero la PWA AIOS está instalada en home screen del iPhone (iOS 16.4+).
- Stack técnico: ver \`tech-stack.md\`.

## Conocimiento Vibe Coding

El operador es practitioner avanzado — articula briefs, ejecuta PRPs, no programa línea por línea. La interacción con el agente asume autonomía técnica en el agente. Cuando el agente debe escalar (c1/c2/c3), lo hace en lenguaje simple sin asumir conocimiento de comandos git, CLI específicos o detalles del filesystem.

## Cosas concretas que el agente debe hacer/no hacer

- **Hacer**: paralelizar tool calls cuando son independientes; usar TodoWrite para trabajos multi-paso; commit + push autónomo (regla 6e bucle-agentico).
- **No hacer**: pedir al operador que corra comandos shell; pedir que edite archivos; mostrar rutas internas en respuestas; usar emojis sin que el operador lo pida.
"

# tech-stack.md
write_if_absent "$MEM/tech-stack.md" "---
last_updated: $TODAY
update_frequency: medium
volatility: evolving
---

# Stack técnico AIOS

## Mission Control (PWA)

- Next.js 16 + React 19 + TypeScript (jsx → react-jsx).
- Tailwind CSS 4 + shadcn/ui.
- Supabase (Auth + DB + RLS + Realtime + Storage).
- Vercel (hosting). Project \`prj_ThozTfSnZaXnIh3X6UFiP5upDebe\` en team Ecosystem AI. Auto-deploy desde \`main\`.
- Zod (schemas), Zustand (estado cliente), Playwright (validación visual).
- ESLint 9 flat config en \`eslint.config.mjs\`. \`npm run lint\` corre \`eslint . --max-warnings=0\`. \`next lint\` deprecated.
- Convención Next.js 16: \`mission-control/src/proxy.ts\` (no \`middleware.ts\`).

## Agent Server (daemon)

- Node ≥ 20 (probado en 25.2.1) — type module.
- \`@anthropic-ai/claude-agent-sdk\` (latest).
- \`grammy ^1.30.0\` (Telegram, opcional, fail-soft).
- \`better-sqlite3 ^12.9.0\` (bumpeo desde \`^9.4.3\` original — Node 25 incompat).
- \`cron-parser ^4.9.0\` (CJS, importar via \`createRequire\`).
- \`pino\` + \`pino-pretty\`.
- \`date-fns\` (\`getISOWeek\` + \`getISOWeekYear\` para weekly key — FIX 3).
- HTTP server bind \`127.0.0.1:3099\`. Bearer \`OPENCLAW_GATEWAY_TOKEN\` con \`timingSafeEqual\`. CORS restringido a \`MISSION_CONTROL_ORIGIN\`.

## Supabase

- Proyecto canónico ref \`<your-project-ref>\` (org \`cptxkuxnyiqzfjjdypnr\`, región \`us-west-2\`, Postgres 17).
- 25 tablas en \`public\`. RLS owner-only con helper \`is_owner()\` (SECURITY DEFINER STABLE + REVOKE EXECUTE FROM PUBLIC, anon, authenticated).
- 7 tablas en publicación Realtime: \`activities, chat_messages, community_metrics, funnel_events, ops_events, revenue_snapshot, tasks\`.
- Auth user owner UUID \`00008db3-c0a6-4313-a853-5163a64e41aa\` (\`your-email@example.com\`).

## 7 fixes obligatorios sobre el template

1. RLS owner-only día 1 en TODAS las tablas (FIX 1).
2. Modelos dinámicos del SDK, no hardcoded (FIX 2 — \`ModelInfo.value\` no \`id\`).
3. Weekly key con ISO-8601 (\`getISOWeek\` + \`getISOWeekYear\`) — FIX 3.
4. **Cero memory injection automática** en ningún path (FIX 4) — la skill \`memory-manager\` reemplaza por completo el modelo del template.
5. \`MC_SUPABASE_URL/KEY\` validadas al boot del daemon (FIX 5).
6. Cleanup automático de \`.jsonl\` (FIX 6) — Fase 10.
7. Borrar dead code: \`Mission-Control/proxy.ts\` raíz, endpoints \`/chat\` legacy, \`createSender\`, hardcoded models (FIX 7).

## Filesystem & convenciones

- \`PROJECT_ROOT\` = \`<PROJECT_ROOT>\`. \`cwd: PROJECT_ROOT\` en cada \`query()\` del SDK unifica sesiones CLI ↔ Web ↔ Telegram.
- Hook guard \`~/.claude/hooks/agent-server-guard.sh\` con \`exit 0\` cuando \`AGENT_SERVER_DAEMON='1'\`.
- \`.mcp.json\` raíz gitignored (contiene PAT \`sbp_*\`); excepción \`!example.mcp.json\`.
- \`.env\` gitignored en ambos subdirs.
- \`.claude/memory/\` SÍ versionado (memoria es portable).
"

# people.md
write_if_absent "$MEM/people.md" "---
last_updated: $TODAY
update_frequency: low
volatility: evolving
---

# Personas relevantes

## Daniel Carreón

- **Rol**: autor del template \`business-os-template\`, mentor del operador, fuente original de la skill \`memory-manager\` (la compartió personalmente).
- **Cómo aparece en mi vida**: referencia técnica del modelo de tres pilares (Mission Control PWA + Agent Server daemon + Skills/Memory en \`.claude/\`). AIOS hereda verbatim sus decisiones de arquitectura load-bearing (hook guard \`AGENT_SERVER_DAEMON\`, \`hooks: {}\` override, weekly category rotation, \`cwd: PROJECT_ROOT\` para sesiones unificadas, fail-soft en webhooks, prompt injection wrappeada como \`<<<DATA>>>\`).
- **Diferencia con AIOS**: la versión Daniel inyecta memoria automáticamente en cada turno del SDK. AIOS lo cierra como **FIX 4** y reemplaza con esta skill (\`memory-manager\`) consultable por trigger semántico, sin polución del prompt.
- **Template ubicación**: \`<HOME>/Desktop/business-os-template\` en el filesystem del operador.

## Operador (YOUR_OPERATOR_NAME)

- **Email**: \`your-email@example.com\` (auth user owner UUID \`00008db3-c0a6-4313-a853-5163a64e41aa\` en Supabase).
- **GitHub**: \`YOUR_GITHUB_ORG\`. Repo canónico AIOS: \`YOUR_GITHUB_ORG/aios\` (privado).
- **Ubicación**: Guadalajara, México (TZ \`America/Mexico_City\`).
- **Hardware operativo**: máquina principal del operador 16GB RAM always-on con UPS (host del daemon AIOS); segunda máquina del operador para movilidad.
- **Bot Telegram**: \`@aios_juan_bot\` (cuando esté configurado — pendiente c1 de Fase 6).

<!-- Agregar más personas aquí cuando aparezcan en la operación: clientes YOUR_AGENCY, mentores externos, colaboradores ad hoc, etc. -->
"

# decisiones.md (APPEND-ONLY)
write_if_absent "$MEM/decisiones.md" "---
last_updated: $TODAY
update_frequency: high
volatility: snapshot
---

# Decisiones estratégicas

> APPEND-ONLY. Cada decisión va al final con fecha. Ver \`.claude/skills/memory-manager/references/append-only-policy.md\`.

## $TODAY: bootstrap de la memoria AIOS

**Decisión**: arrancar el sistema de memoria como skill \`.md\` en Git (Fase 8 del brief master AIOS), reemplazando la auto-memory de Claude Code.

**Por qué**: la auto-memory nativa vive local a la máquina (\`~/.claude/projects/\`), no se versiona, no se sincroniza varias máquinas del operador, y la versión inyectada del template Daniel polutaba el prompt del SDK en cada turno (FIX 4 de AIOS).

**Implicaciones**: la memoria viaja con \`git pull\`; el agente la consulta solo por trigger semántico (\"qué sabes de\", \"anota\", \"registra\", etc.); la tabla SQLite \`memories\` + FTS5 sigue ausente del schema del daemon.

**Vigente hasta**: indefinido. Si en el futuro necesito búsqueda vectorial sobre memoria, otro brief.

<!-- nuevo bloque de decisión va aquí -->
"

# errores-aprendidos.md (APPEND-ONLY)
write_if_absent "$MEM/errores-aprendidos.md" "---
last_updated: $TODAY
update_frequency: high
volatility: snapshot
---

# Errores aprendidos

> APPEND-ONLY. Cada error resuelto va al final con fecha. Análogo al formato de la sección \"Aprendizajes\" de los PRPs y \`CLAUDE.md\`, pero con contexto operativo (no técnico-de-PRP). Ver \`.claude/skills/memory-manager/references/append-only-policy.md\`.

<!-- nuevo bloque de aprendizaje va aquí -->
"

# proyectos-activos/praxis.md
write_if_absent "$MEM/proyectos-activos/praxis.md" "---
last_updated: $TODAY
update_frequency: medium
volatility: evolving
---

# Praxis

Extension de VS Code que orquesta el pipeline brief → PRP → bucle-agentico para alumnos de Vibe Coding. Corre como herramienta para producir SaaS factibles desde una idea sin que el alumno toque comandos.

## Estado actual

(esqueleto — el operador puebla cuando el proyecto Praxis tenga novedad relevante para AIOS).
"

# proyectos-activos/your-community-slug.md
write_if_absent "$MEM/proyectos-activos/your-community-slug.md" "---
last_updated: $TODAY
update_frequency: medium
volatility: evolving
---

# YOUR_COMMUNITY (comunidad Skool)

Comunidad de membership en Skool.com. Pricing: \$19/mes o \$500 lifetime. Meta MRR: \$10K. Audiencia: alumnos hispanoparlantes aprendiendo a construir con IA + Vibe Coding.

## Estado actual

(esqueleto — el operador puebla cuando haya métricas o decisiones que registrar acá. Las métricas en vivo viven en \`community_metrics\` de Supabase y se leen vía cron \`nightly-community-pulse\`).
"

# proyectos-activos/aios.md
write_if_absent "$MEM/proyectos-activos/aios.md" "---
last_updated: $TODAY
update_frequency: high
volatility: evolving
---

# AIOS

Mi Mission Control como creator-emprendedor solo. Sistema operativo de un solo operador con tres pilares: Mission Control PWA + Agent Server daemon + Skills/Memory.

## Estado actual

7 fases completadas (PRPs 001-007), Fase 8 en curso (memoria como skill .md en Git). Próximas:

- Fase 9: skills custom propias + reescritura \`aios-supabase\`.
- Fase 10: despliegue producción + observabilidad + dashboard BI + Cloudflare Tunnel + launchd plist.

## Repo

- GitHub: \`YOUR_GITHUB_ORG/aios\` (privado).
- Vercel: \`prj_ThozTfSnZaXnIh3X6UFiP5upDebe\` (team Ecosystem AI), root dir \`mission-control/\`, auto-deploy a \`main\`.
- Supabase: ref \`<your-project-ref>\`.
- máquina principal del operador: host del daemon (puerto local \`127.0.0.1:3099\`).
"

echo ""
echo "init-memory.sh: estructura .claude/memory/ lista. Siguientes pasos automáticos los hace la skill cuando reciba triggers."
