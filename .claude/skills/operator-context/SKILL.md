---
name: operator-context
description: "Carga el contexto del operador del template (nombre + ocupación + modelo de negocio + stack tecnológico + prioridades estratégicas) leyendo bajo demanda los archivos canónicos en .claude/identity/USER.md y .claude/memory/business-context.md (cuando exista). Sintetiza un párrafo en español para que el agente principal entienda quién es el operador y qué busca antes de proponer cualquier acción. Cero auto-injection — la skill se invoca on-demand. Activar en sesiones nuevas cuando el operador menciona quién soy, qué hago, cuál es mi negocio, cuál es mi modelo, cuál es mi stack, cuáles son mis prioridades, dame contexto, recuérdame qué hago, refresca quién soy."
allowed-tools: Read, Glob
---

# operator-context — Snapshot del operador on-demand

> Lookup canónico del contexto del operador. Lee `.claude/identity/USER.md` + opcionalmente `.claude/memory/business-context.md` y sintetiza un párrafo en español para que el agente principal entienda quién es el operador. NO duplica esos archivos — apunta. Cero auto-injection (la skill se invoca on-demand cuando el operador lo pide o el agente lo necesita).

---

## Cuándo activar

Triggers explícitos del operador:

- "¿quién soy?" / "recuérdame quién soy" / "refresca quién soy"
- "¿qué hago?" / "¿cuál es mi ocupación?"
- "¿cuál es mi negocio?" / "¿cuál es mi modelo?"
- "¿cuál es mi stack?" / "¿qué tecnologías uso?"
- "¿cuáles son mis prioridades?" / "¿qué tengo que hacer esta semana?"
- "dame contexto" / "carga mi contexto"

Triggers implícitos (el agente decide invocarla):

- Sesión nueva donde el agente necesita entender al operador antes de proponer acciones.
- Primera interacción tras `INTERVIEW.md` (los placeholders ya están rellenados).
- Cualquier momento donde el agente esté por inferir contexto del operador y prefiera leer la fuente de verdad.

## Cuándo NO activar

- Preguntas sobre código, doctrina del proyecto, o estructura técnica (CLAUDE.md + skills hacen el trabajo).
- Preguntas sobre datos concretos vivos (memoria semántica, BI, funnel) — `recall`, `supabase-bi` cubren esos casos.
- Conversación abierta sin trigger explícito ni implícito — la skill es soporte, no orquestador.

## Antes de empezar

Verificar empíricamente que los archivos canónicos existen y NO están en estado placeholder bruto:

```bash
test -f .claude/identity/USER.md && head -5 .claude/identity/USER.md
test -f .claude/memory/business-context.md && head -5 .claude/memory/business-context.md
```

- Si `USER.md` no existe o sigue con texto `<placeholder>` literal sin rellenar → escalar al operador: *"Tu identidad todavía no está sembrada. Ejecuta el flujo de `INTERVIEW.md` o pídeme que te haga las preguntas y la lleno."*.
- Si `USER.md` existe rellenado pero `business-context.md` no → operar con solo `USER.md` (el contexto adicional es opcional).

---

## Cómo opera

### 1. Leer las fuentes

Lee en paralelo:

- `.claude/identity/USER.md` — secciones canónicas: Quién eres, A qué te dedicas, Audiencias, Modus operandi, Preferencias.
- `.claude/memory/business-context.md` (si existe) — modelo de negocio detallado del operador, ingresos, productos, audiencia, prioridades estratégicas.

Si solo existe `USER.md`, la skill usa solo eso. Si existen ambos, prioriza `business-context.md` para detalle de negocio y `USER.md` para identidad + preferencias.

### 2. Sintetizar el snapshot

Construye un párrafo en español de 100-200 palabras siguiendo este shape:

```
{{OPERATOR_NAME}} es {{OCCUPATION}} con {{N_BUSINESS_FRONTS}} frentes activos:
{{FRONT_1}}, {{FRONT_2}}, {{FRONT_N}}. Su modus operandi es {{SOLO|TEAM|MIXED}}
con prioridad en {{TOP_PRIORITY_THIS_PERIOD}}. Stack canónico: {{STACK_SUMMARY}}.
Audiencia principal: {{AUDIENCE}}. Preferencias de comunicación: {{COMM_STYLE}}.
```

### 3. Devolver al agente principal

El agente principal recibe el snapshot como contexto operativo. Lo usa para:

- Calibrar el tono de las respuestas (formal vs cercano, español vs inglés).
- Filtrar propuestas inviables (ej. no proponer hire un team si el operador es solo).
- Priorizar features alineadas con las prioridades activas del operador.
- Recordar el caso de uso para no repetir preguntas que ya están resueltas.

NO escribe a memoria. NO modifica ningún archivo. Pure read-only.

---

## Casos borde

- **`.claude/identity/USER.md` con placeholders sin rellenar** (`<your-name>`, `<your-occupation>`, etc.) → escalar al operador: *"Tu identidad todavía no está sembrada. ¿Quieres que ejecute la entrevista de `INTERVIEW.md` ahora?"*.
- **`USER.md` existe pero está vacío o es solo el frontmatter** → idem escalación.
- **El operador pide contexto pero `business-context.md` no existe** → operar con solo `USER.md`, mencionar que el contexto detallado de negocio se puede sumar más tarde (al escribir `.claude/memory/business-context.md` manualmente o vía Memory Tool).
- **Hay drift entre `USER.md` (identity declarativa) y `business-context.md` (memoria curada)** → priorizar `business-context.md` (suele estar más actualizada) y mencionar el drift al operador para que lo resuelva en su tiempo.

---

## Referencias

- `.claude/identity/USER.md` — fuente canónica de identidad declarativa.
- `.claude/identity/SOUL.md` — voz, valores, communication style del agente (complementario, NO duplicar contenido aquí).
- `.claude/memory/business-context.md` — memoria curada extendida (opcional).
- `.claude/skills/recall/SKILL.md` — skill hermana para retrieval semántico sobre hechos concretos.
- `.claude/skills/memory-manager/SKILL.md` — skill hermana para escribir/leer la memoria curada del operador.

---

## Aprendizajes propagables

- **Cero auto-injection.** La skill se invoca on-demand por trigger explícito del operador o decisión del agente. NO se inyecta automáticamente en cada turn — eso poluciona el contexto y aumenta latencia/costo innecesariamente.
- **Synthesize, don't dump.** El snapshot es un párrafo curado, no un copia-pega de los archivos fuente. El agente principal recibe el resumen útil, no el doc entero.
- **Refresh tras INTERVIEW.md.** Cuando el operador completa la entrevista de `INTERVIEW.md` (post-clone del template), `USER.md` se llena con sus respuestas. La primera invocación de `operator-context` tras la entrevista valida que el snapshot refleje exactamente lo que el operador dijo.
