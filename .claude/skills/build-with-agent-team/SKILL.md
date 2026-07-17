---
name: build-with-agent-team
description: "Orquesta un equipo de agentes especializados para construir un proyecto en paralelo desde un brief. Diseña roles, asigna fases del PRP a cada agente, sincroniza checkpoints, y agrega entregas. Usa las herramientas nativas de Claude Code TeamCreate, SendMessage, Task. Activar cuando el usuario menciona orquestar agentes, equipo de IA, dividir trabajo en paralelo, agentic team, multi-agent, sub-agente, o pide 'construye esto con varios agentes a la vez'."
allowed-tools: Read, Write, Edit, Bash, Agent, TeamCreate, SendMessage, TodoWrite
---

# build-with-agent-team — orquestador multi-agente

> Activar solo cuando el alumno tiene un brief grande (5+ fases en el Alcance por Fases) que se beneficia de paralelizar el trabajo de implementacion. Para tareas simples, basta con `bucle-agentico` solo.

---

## Cuando activar

- "Tengo un brief grande, quiero construir esto en paralelo con varios agentes."
- "Coordina un equipo para hacer estas fases."
- "Diseña la arquitectura agentica para mi proyecto."

## Cuando NO activar

- Tarea unitaria (un PRP de una feature, una migracion, un bug fix). Eso es `bucle-agentico` solo.
- Brief muy chico (1-2 fases). Overhead de coordinacion no se paga.
- Casos donde la paralelizacion introduce conflictos de merge dificiles (mismo archivo editado por varios agentes). Mejor secuencial.

## Antes de empezar — verifica empiricamente

- [ ] Brief existe en `docs/BRIEF-*.md` con `## Alcance por Fases` poblado.
- [ ] Cada fase del brief tiene PRP generado o claramente identificable.
- [ ] Las fases son razonablemente desacopladas (sin dependencias circulares apretadas).

## Patron canonico recursivo

Esta skill opera en escala superproyecto: orquesta varios `bucle-agentico` corriendo en paralelo, cada uno ejecutando un PRP distinto. La doctrina recursiva del PRP-029 sigue:

```
ESCALA SUPERPROYECTO  ──► build-with-agent-team   (esta skill)
                          Mapea: brief + estado de fases
                          Planea: asignacion de fases a agentes + checkpoints
                          Ejecuta: TeamCreate -> Agent x N -> coordina
                                ↓
ESCALA FEATURE        ──► prp                      (cada agente genera su PRP)
                                ↓
ESCALA SUBTAREA       ──► bucle-agentico           (cada agente ejecuta su PRP)
```

Cross-references obligatorias:

- `@.claude/skills/brief/SKILL.md` — fuente del brief que esta skill consume.
- `@.claude/skills/prp/SKILL.md` — formato del contrato entre agentes.
- `@.claude/skills/bucle-agentico/SKILL.md` — doctrina canonica del patron recursivo. Cada agente del equipo ejecuta su PRP siguiendo bucle-agentico.

## Flujo principal

### Paso 1: mapear el brief

Leer `## Alcance por Fases` del brief y extraer:

- Lista de fases con su `Estado:` (PENDIENTE / APROBADO / EN PROGRESO / COMPLETADO).
- Dependencias declaradas en `Depende de:` de cada fase.
- Aprendizajes acumulados de fases COMPLETADO.

### Paso 2: agrupar fases por independencia

Construir grafo de dependencias. Identificar:

- **Capa 0 (sin deps)**: fases que pueden empezar inmediato. Suelen ser foundational (auth, BD base).
- **Capa 1 (deps de capa 0)**: empiezan cuando capa 0 completa.
- **Capa N**: cada capa siguiente espera la anterior.

Dentro de cada capa, las fases son paralelizables.

### Paso 3: TeamCreate con roles especializados

Para cada capa, crear team con un agente por fase:

```
TeamCreate({
  name: 'capa-0-foundational',
  agents: [
    { role: 'auth-engineer', subagent_type: 'general-purpose' },
    { role: 'db-engineer', subagent_type: 'general-purpose' },
  ],
})
```

Cada `role` es descripcion semantica para humanos. El `subagent_type` es el agente real que se invoca.

### Paso 4: asignar PRPs

Para cada agente del team, generar/asignar un PRP:

```
SendMessage({
  to: 'auth-engineer',
  prompt: `Ejecuta @.claude/PRPs/PRP-XXX-auth-base.md siguiendo bucle-agentico.
  Al terminar, reporta: estado final, archivos modificados, aprendizajes propagables al brief origen.`,
})
```

### Paso 5: monitor + sync checkpoint

Cuando todos los agentes de la capa reportaron COMPLETADO:

1. Leer cada PRP cerrado, extraer aprendizajes.
2. Propagar al brief (campos `Aprendizajes para fases siguientes` y `Ajustes a la Directiva` de cada fase).
3. Verificar que no hay conflictos de merge.
4. Pasar a la siguiente capa.

### Paso 6: cierre integral

Cuando todas las capas completaron:

1. Brief pasa a COMPLETADO.
2. CLAUDE.md raiz se actualiza con aprendizajes transversales.
3. README + docs publicos reflejan el nuevo estado.
4. Commit + push final.

## Casos donde paralelizar es contraproducente

- **Dependencia oculta**: dos fases que parecen independientes editan el mismo archivo (ej. ambas modifican `package.json`). Mejor secuencial.
- **Decision pendiente**: una fase necesita feedback humano antes de empezar la otra. No paralelizar si el bloqueo es probable.
- **Recursos limitados**: si la paralelizacion satura tu cuenta de Claude (rate limits) o tu BD (transactions abiertas), serializar.

## Cuando hibridar

Caso comun: fase A es paralelizable con B, pero ambas dependen de C.

Plan: ejecutar C secuencial (un agente solo, sin equipo). Cuando C termina, lanzar team con A y B. Cuando A y B terminan, sintetizar.

## Cross-references con skills hermanas

- `@.claude/skills/brief/SKILL.md` — fuente del brief.
- `@.claude/skills/prp/SKILL.md` — formato del contrato entre agentes.
- `@.claude/skills/bucle-agentico/SKILL.md` — doctrina canonica del patron recursivo.

## Archivos lazy-loaded

- `references/team-design.md` — patrones de roles especializados (auth-engineer, db-engineer, frontend-engineer, qa-engineer).
- `references/dependencies-graph.md` — como construir el grafo desde el brief y validar no-circulares.
- `references/sync-checkpoints.md` — como agregar entregas + propagar aprendizajes hacia el brief.
- `references/conflict-resolution.md` — cuando dos agentes editaron archivos solapados.

## Validacion al cerrar

- [ ] Todas las fases del brief en COMPLETADO.
- [ ] Aprendizajes propagados a los campos del brief.
- [ ] CLAUDE.md raiz actualizado con aprendizajes transversales.
- [ ] Commit + push hechos.
- [ ] Tests de cada PRP pasan; tests de integracion cross-PRP tambien.
