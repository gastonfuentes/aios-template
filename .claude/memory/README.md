# `.claude/memory/` — Convenciones de la memoria curada del operador

> Este directorio es la **memoria viva curada a mano por el operador**, complementaria a la memoria activa del Memory Tool del SDK (`.claude/agent-memory/<agent>/`) y a la memoria semántica indexada en Supabase (`agent_memories`).

---

## Las 3 capas de memoria del template

| Capa | Path | Naturaleza | Versionada en Git | Auto-injection |
|---|---|---|---|---|
| **1. Operador curada** | `.claude/memory/*.md` | Curada a mano por el operador, append-only en decisiones/errores | ✅ Sí | ❌ Cero (lee on-demand via `memory-manager` skill) |
| **2. Activa nativa SDK** | `.claude/agent-memory/<agent>/*.md` | Escrita por el agente cuando el operador dice "recuerda", semantic-based naming | ✅ Sí (scope `project` del Memory Tool) | ❌ Cero (recall via Bash+Read proactivo) |
| **3. Semántica indexada** | Supabase `agent_memories` tabla + pgvector | Indexer one-shot + cron nocturno extraen hechos atómicos del chat, embedding 1536d, retrieval por similaridad coseno | ❌ No (vive en BD) | ❌ Cero (retrieval via `recall` skill on-demand) |

Las 3 capas son **disjuntas y complementarias**. NO duplican el mismo dato:

- **Curada**: contexto estratégico de alto nivel (modelo de negocio, stack canónico, preferencias estructurales). Cambia raras veces.
- **Activa**: hechos atómicos que el operador menciona en chat. Plain markdown legible por humanos. Convención semantic-based (ej. `operator-pet-name.md`).
- **Semántica**: espejo indexable de la activa + extracts del chat. Retrieval por significado en vez de búsqueda literal. Decae con tiempo (RPCs `decay_*` + `compact_*`).

---

## Convenciones de escritura

### Archivos top-level (`MEMORY.md` index)

- `business-context.md` — modelo de negocio del operador. ¿Qué hace? ¿Para quién? ¿Cómo monetiza?
- `tech-stack.md` — stack tecnológico canónico. ¿Qué framework usa? ¿Qué BD? ¿Qué deploy target?
- `preferencias.md` — preferencias de comunicación del agente + estilo de trabajo.
- `people.md` — personas relevantes del operador + relaciones.

Estos son **opcionales**: el operador los siembra solo si los necesita. El agente los lee bajo demanda.

### Bitácoras (APPEND-ONLY)

- `decisiones.md` — decisiones tomadas con fecha + razón. Formato:

  ```markdown
  ## [YYYY-MM-DD]: <titulo decisión>

  **Contexto**: <qué motivó la decisión>
  **Decisión**: <qué se decidió>
  **Razón**: <por qué>
  **Alternativas descartadas**: <opcional>
  ```

- `errores-aprendidos.md` — errores + fix + lección. Formato:

  ```markdown
  ## [YYYY-MM-DD]: <título error>

  **Error**: <qué falló>
  **Fix**: <cómo se arregló>
  **Lección**: <qué patrón evitar/aplicar en futuro>
  ```

NUNCA reescribir entradas viejas. Si la decisión cambió, append una nueva entrada citando la previa.

### Carpetas por dominio

- `proyectos-activos/` — un `.md` por proyecto activo del operador. Cuando un proyecto se cierra, se mueve a `historial/<año>-<proyecto>.md`.
- `historial/` — snapshots mensuales generados por el cron `monthly-memory-snapshot` (si está activo) + proyectos cerrados.
- `feedback/` — feedback del operador a sí mismo o al agente.
- `project/` — notas técnicas por proyecto.
- `reference/` — refs de lectura (URLs, docs, conceptos relevantes para el operador).
- `user/` — datos personales del operador (cuidado con privacidad — gitignored si el operador prefiere).

---

## Cómo se versiona

La regla canónica del template: **`.claude/memory/` SÍ va al repo** (commits incrementales con el operador), MIENTRAS QUE **`.claude/identity/SOUL.md|USER.md|HEARTBEAT.md` están gitignored** (solo los `.template` van versionados; las versiones rellenadas con datos del alumno no).

Esta asimetría es deliberada:

- Identity files contienen datos personales del operador (nombre, email, audiencias, claves de personalidad). Cero exposición pública si el repo se vuelve público o se comparte.
- Memory files son contexto estratégico que el operador decide qué versionar. Si el operador trabaja con un team, la memoria curada de equipo va al repo. Si es solo, también — la versión privada le permite navegarla desde otra máquina via `git pull`.

El operador puede sobrescribir esta regla editando `.gitignore` a su gusto.

---

## Referencias

- `.claude/memory/MEMORY.md` — índice operativo.
- `.claude/skills/memory-manager/SKILL.md` — operador canónico.
- `.claude/skills/recall/SKILL.md` — skill hermana para retrieval semántico.
- `.claude/skills/operator-context/SKILL.md` — skill que sintetiza snapshot del operador.
