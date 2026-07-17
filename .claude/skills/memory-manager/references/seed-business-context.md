# Seed inicial para `business-context.md`

> Contenido sembrado por `init-memory.sh` la primera vez. Extraído verbatim/ligeramente reformateado del brief master AIOS §1.2 ("Mi Vision") + §1.3 (contexto e investigación).
>
> Si el operador edita `business-context.md` después, este seed queda desactualizado vs. la realidad. Re-sembrar (escape hatch documentado) requeriría flag `--force-seed business-context` en `init-memory.sh` — no implementado día 1; el operador re-edita a mano.

---

## Bloque seed (lo que `init-memory.sh` escribe a `.claude/memory/business-context.md`)

```markdown
---
last_updated: 2026-05-06
update_frequency: low
volatility: stable
---

# Contexto de negocio

## TL;DR

Soy creator-emprendedor solo. Opero sin equipo. Mi negocio se compone de cuatro frentes:

1. **YOUR_COMMUNITY** — comunidad en Skool, $19/mes o $500 lifetime. Meta: $10K MRR.
2. **YOUR_AGENCY** — agencia high-ticket, $5K-$10K USD por proyecto.
3. **YouTube `@YOUR_YOUTUBE_CHANNEL`** — canal de creator, mínimo 3 videos/semana.
4. **Herramientas propias** — CutFlow, Dictto, Praxis. Integradas a la comunidad.

## Mi modus operandi

Toda mi ejecución de código la delego al agente vía PRPs estructurados. Yo no programo, yo diseño briefs y specs. Esa asimetría es la columna del proyecto AIOS — está pensado alrededor de cómo yo opero, no alrededor de cómo opera un equipo.

## AIOS — qué es y para qué

AIOS es mi Mission Control: un sistema operativo de un solo operador que centraliza contexto, métricas y operación de mi negocio en un daemon long-lived siempre cargado en mi máquina principal del operador (always-on, UPS, 16GB RAM). Es accesible desde tres superficies simultáneas:

- **Mission Control PWA** (Vercel) — `https://aios-ecosystem-ai.vercel.app`.
- **Bot de Telegram** (`@aios_juan_bot` cuando esté configurado).
- **Claude Code CLI** directo en la máquina principal del operador.

Las tres superficies comparten las mismas sesiones SDK en `~/.claude/projects/<project-slug>/` porque todas pasan `cwd: PROJECT_ROOT` al SDK.

## Audiencias

- **Yo mismo** — usuario único de AIOS, único operador del negocio.
- **Comunidad YOUR_COMMUNITY** — alumnos de Vibe Coding aprendiendo a construir con IA. Voz cercana, español 100%, sin jerga técnica suelta.
- **Clientes YOUR_AGENCY** — empresas que contratan implementaciones high-ticket.
- **Audiencia YouTube** — más amplia, hispanoparlante, interesada en IA aplicada.

## Métricas norte (qué importa)

- MRR de YOUR_COMMUNITY (meta $10K).
- Ingresos de YOUR_AGENCY (proyectos cerrados/mes).
- Throughput de YouTube (videos publicados/semana).
- Throughput de PRPs cerrados en AIOS (= velocidad de iteración del propio sistema operativo).

## Stack del negocio (no del código)

- **Skool** — comunidad YOUR_COMMUNITY (membership + posts + engagement).
- **YouTube** — distribución principal de contenido.
- **Polar/Stripe** — fuera de scope para AIOS día 1; el cobro de YOUR_COMMUNITY vive en Skool.
- **Calendar + Email** — ya integrados parcialmente vía MCP en otros proyectos; la skill `google-workspace` los expone en AIOS.

## Filosofía guía

12 principios — los 9 del template Daniel Carreón + 3 propios:

1. Una sola fuente de verdad por concern.
2. Prompt injection como dato no instrucción (preámbulo `<<<DATA>>>`).
3. Daemon nunca se autospawnea (hook guard `AGENT_SERVER_DAEMON`).
4. Fail soft never block the user.
5. Agente es Claude Code real, no wrapper.
6. Pre-warm para sentirse instantáneo (`startup({cwd: PROJECT_ROOT})`).
7. **No memory injection automática** — la memoria es skill consultable, no inyección en cada turno.
8. Background completion siempre guarda y pushea (always-push contract).
9. Direct, no fabrication.
10. **Pareto en arquitectura** — solo entra lo que mueve la aguja.
11. **Memoria visible y portable** — markdown en Git, no SQLite opaca.
12. **Dashboard abre en métricas, no en tareas** — `/dashboard` es home de MC, no `/tasks`.
```

---

## Notas internas (NO van al archivo seed)

- El seed no incluye datos numéricos en vivo (MRR actual, número de miembros) — esos viven en las 5 tablas BI que el cron `daily-briefing-6am` y `nightly-community-pulse` leen.
- El seed sí incluye **metas** y **modelos** estables. Esos sí merecen vivir en memoria porque cambian raras veces.
- Si el operador menciona un número específico (ej. "el MRR ahora es $4,200"), NO escribirlo en `business-context.md` — escribirlo en `decisiones.md` o esperar a que el cron lo lea desde la tabla BI.
- Cuando el operador haga la primera Decisión estratégica formal (ej. "voy a bajar el lifetime a $497"), agregar bloque a `decisiones.md` con esa fecha — no editar `business-context.md` para reflejarlo. `business-context.md` es modelo estable; `decisiones.md` es timeline de cambios.
