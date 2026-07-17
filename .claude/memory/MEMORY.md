# MEMORY.md — Índice operativo de la memoria del operador

> Este archivo es el mapa de la memoria curada del operador. Vive en `.claude/memory/`, versionada en Git, sin auto-injection. La skill `memory-manager` la consulta bajo demanda cuando el operador menciona triggers como *"recuerda"*, *"qué sabes de"*, *"en qué quedamos"*.

---

## Estructura

```
.claude/memory/
├── MEMORY.md                # Este archivo — índice operativo
├── README.md                # Convenciones de escritura/append-only
├── business-context.md      # (Opcional) Modelo de negocio del operador
├── tech-stack.md            # (Opcional) Stack tecnológico canónico
├── preferencias.md          # (Opcional) Preferencias de comunicación + estilo
├── people.md                # (Opcional) Personas + relaciones del operador
├── decisiones.md            # (APPEND-ONLY) Decisiones tomadas con fecha + razón
├── errores-aprendidos.md    # (APPEND-ONLY) Errores + fixes + lección
├── proyectos-activos/       # Carpeta — un .md por proyecto activo
├── historial/               # Carpeta — snapshots mensuales (cron monthly-memory-snapshot)
├── feedback/                # Carpeta — feedback del operador a sí mismo o al agente
├── project/                 # Carpeta — notas técnicas por proyecto
├── reference/               # Carpeta — refs de lectura (URLs, docs, conceptos)
└── user/                    # Carpeta — datos personales del operador (cuidado con privacidad)
```

---

## Cómo se popula

**Camino 1 — Entrevista inicial (`INTERVIEW.md`)**: tras clonar el template, el agente entrevista al operador y siembra `business-context.md` + `tech-stack.md` + `preferencias.md` automáticamente.

**Camino 2 — Bajo demanda (`memory-manager` skill)**: cuando el operador dice *"recuerda que…"*, *"anota que…"*, *"no olvides…"*, el agente decide:
- Si es un hecho atómico semántico (preferencia, decisión, dato del operador) → escribe a `.claude/agent-memory/<agent>/` (Memory Tool nativo SDK 0.2.128).
- Si es contexto curado de alto nivel (modelo de negocio, stack, preferencias estructurales) → escribe a `.claude/memory/*.md` apropiado vía la skill `memory-manager`.

**Camino 3 — Crons de consolidación**: el cron `nightly-memory-consolidation` (3am TZ del operador) extrae hechos atómicos del chat del día y los persiste a `marley_memories`/`agent_memories` (Supabase pgvector) — son retrieval por significado, NO escritura a `.claude/memory/`.

---

## Reglas

1. **APPEND-ONLY** para `decisiones.md` y `errores-aprendidos.md` — son bitácoras históricas, NO se reescriben.
2. **Cero auto-injection** — el agente NO inyecta esta memoria en cada turn. Solo la lee cuando el trigger semántico lo justifica.
3. **Versionada en Git** — `.claude/memory/` SÍ va al repo (a diferencia de `.claude/identity/SOUL.md|USER.md|HEARTBEAT.md` que están gitignored para que el alumno los rellene en su propia checkout).
4. **Operador es el dueño** — el agente sugiere escribir pero el operador decide qué se queda.
5. **Convención semántico-temporal** — naming de archivos por dominio + fecha cuando aplique (ej. `historial/2026-05.md`).

---

## Referencias

- `.claude/skills/memory-manager/SKILL.md` — operador canónico de esta memoria.
- `.claude/skills/recall/SKILL.md` — skill hermana para retrieval semántico via pgvector.
- `.claude/skills/operator-context/SKILL.md` — skill que sintetiza snapshot del operador leyendo `USER.md` + `business-context.md` (opcional).
- `.claude/identity/USER.md` — perfil declarativo del operador (entry point del agente al primer turn).
