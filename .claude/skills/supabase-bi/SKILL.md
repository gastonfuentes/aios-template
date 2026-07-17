---
name: supabase-bi
description: "Opera el Supabase del operador con foco en BI y métricas sobre las 22 tablas core del chassis Mission Control (profiles + agents + tasks + conversations + messages + chat_sessions + chat_messages + ops_events + push_subscriptions + notifications + drawings + draw_canvases + agent_notifications + scheduled_tasks + labels + documents + saved_views + agent_memories). Ejecuta queries SQL canónicas vía MCP supabase (recomendado) o SDK supabase-js con service_role. Cubre casos de uso del template: snapshot operacional, top conversaciones del mes, errores recientes, scheduled_tasks pendientes, agent_memories indexadas, RLS audit. Activar cuando el operador menciona métricas, BI, snapshot, query Supabase, cuántas tareas, cuántas conversaciones, errores recientes, scheduled jobs, memoria semántica."
allowed-tools: Bash, mcp__supabase-prod__list_tables, mcp__supabase-prod__execute_sql, mcp__supabase-prod__get_advisors, mcp__supabase-prod__get_logs
---

# supabase-bi — Queries BI canónicas sobre el chassis MC

> Skill canónica para operar el Supabase del operador con foco en BI y métricas. Trabaja sobre las 22 tablas core del chassis MC heredadas del template `business-os-template`. NO presupone tablas BI custom — esas las suma el operador en su propia personalización y la skill se extiende ad-hoc.

---

## Cuándo activar

- "¿cuántas conversaciones tuve esta semana?" / "snapshot del mes"
- "¿qué errores recientes hay?" / "ops_events de las últimas 24h"
- "¿qué scheduled jobs están pendientes?" / "muestra mis crons"
- "¿cuántas memorias semánticas tengo indexadas?" / "tamaño de agent_memories"
- "audit RLS" / "validar policies activas"
- "métricas BI" / "snapshot operacional" / "dame los números"

## Cuándo NO activar

- Pregunta semántica sobre el operador (`recall` cubre eso vía pgvector).
- Pregunta sobre estructura del código o doctrina (`CLAUDE.md` + skills lo hacen).
- Operaciones destructivas (DROP TABLE, DELETE masivo) sin confirmación explícita del operador.
- Creación de tablas custom (Sub-fase del operador con su propio brief/PRP).

## Antes de empezar

Verificar que el MCP `supabase-prod` está conectado o que el operador tiene `MC_SUPABASE_URL` + `MC_SUPABASE_KEY` (service_role) en `agent-server/.env`:

```bash
# Opción A: MCP supabase-prod (recomendado, evita riesgo de exponer service_role)
# El agente lo detecta automáticamente si está en .mcp.json del proyecto.

# Opción B: CLI directa (fallback)
test -f agent-server/.env && grep -E "^MC_SUPABASE_(URL|KEY)=" agent-server/.env | head -2
```

Si ninguna opción está disponible → escalar al operador: *"Necesito acceso a tu Supabase. Tienes dos caminos: (A) conectar el MCP `supabase-prod` desde Claude Desktop / Claude Code; (B) sembrar `MC_SUPABASE_URL` + `MC_SUPABASE_KEY` (service_role) en `agent-server/.env`. ¿Cuál prefieres?"*.

---

## Queries canónicas

Las queries siguen el shape `mcp__supabase-prod__execute_sql({ query: "..." })`. Si el MCP no está disponible, el agente usa `curl` directo al endpoint `/rest/v1/rpc/...` o `psql` con `MC_SUPABASE_URL`.

### 1. Snapshot operacional último día

```sql
SELECT
  (SELECT COUNT(*) FROM public.chat_sessions WHERE created_at >= now() - interval '24 hours') AS conversations_24h,
  (SELECT COUNT(*) FROM public.chat_messages WHERE created_at >= now() - interval '24 hours') AS messages_24h,
  (SELECT COUNT(*) FROM public.ops_events WHERE created_at >= now() - interval '24 hours') AS ops_events_24h,
  (SELECT COUNT(*) FROM public.scheduled_tasks WHERE schedule IS NOT NULL) AS active_crons,
  (SELECT COUNT(*) FROM public.agent_memories) AS indexed_memories;
```

### 2. Top conversaciones del mes (por mensaje count)

```sql
SELECT
  cs.id,
  cs.title,
  cs.created_at,
  COUNT(cm.id) AS message_count
FROM public.chat_sessions cs
LEFT JOIN public.chat_messages cm ON cm.session_id = cs.id
WHERE cs.created_at >= now() - interval '30 days'
GROUP BY cs.id, cs.title, cs.created_at
ORDER BY message_count DESC
LIMIT 10;
```

### 3. Errores recientes (últimas 24h)

```sql
SELECT
  type,
  source,
  payload,
  created_at
FROM public.ops_events
WHERE type LIKE '%error%' OR type LIKE '%fail%'
  AND created_at >= now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

### 4. Scheduled jobs activos + próxima ejecución

```sql
SELECT
  id,
  name,
  schedule,
  category,
  last_run_at,
  enabled
FROM public.scheduled_tasks
WHERE enabled = true
ORDER BY name;
```

### 5. Tamaño de `agent_memories` + distribución por entity

```sql
SELECT
  entity,
  COUNT(*) AS row_count,
  AVG(importance) AS avg_importance,
  SUM(accessed_count) AS total_accesses
FROM public.agent_memories
GROUP BY entity
ORDER BY row_count DESC;
```

### 6. Audit RLS — tablas sin política

```sql
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policy WHERE polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY rls_enabled, table_name;
```

Tablas con `rls_enabled = false` o `policy_count = 0` son risk — escalar al operador.

### 7. Audit `is_owner()` SECURITY DEFINER funcional

```sql
SELECT public.is_owner();
-- Debe retornar `true` si el caller authenticated es owner; `false` si no.
-- Falso positivo del advisor `authenticated_security_definer_function_executable`:
-- body filtra por auth.uid() internamente.
```

---

## Casos borde

- **Advisor `extension_in_public`** post-aplicar migración → `ALTER EXTENSION vector SET SCHEMA extensions` (lección heredada del bundle). Las migrations del template ya lo declaran correctamente con `SCHEMA extensions`.
- **Advisor `authenticated_security_definer_function_executable`** sobre `is_owner()` → falso positivo consciente clase B. Body filtra por `auth.uid()`. NO silenciar cambiando a INVOKER (rompe el frontend). Documentar en `docs/SECURITY-ADVISORS-FALSE-POSITIVES.md`.
- **Service role JWT expuesto accidentalmente** → rotar inmediatamente desde Supabase Dashboard → Settings → API → Reset service_role secret + re-sembrar en `agent-server/.env`.
- **MCP supabase-prod no conectado** → usar Bash `curl` directo o `psql` con `MC_SUPABASE_URL` (extraer host + db ref).
- **Tabla custom del operador que no es heredada del template** → la skill no presupone shape, pero puede ejecutar queries ad-hoc si el operador lo solicita explícitamente.

---

## Extender la skill con tablas custom

Cuando el operador suma tablas BI propias (caso típico: `funnel_events`, `revenue_snapshot`, `community_metrics` — todas tablas BI custom hand-tailored), la skill se extiende sumando queries adicionales en este SKILL.md o creando skills hermanas (`funnel-tracking`, `revenue-tracking`, etc.) siguiendo el patrón Praxis canónico:

1. Brief del nuevo dominio BI.
2. PRP de la skill custom.
3. Bucle-agentico ejecuta + escribe la nueva skill en `.claude/skills/<nombre>/SKILL.md`.

`examples/skills/funnel-tracking/` + `examples/skills/aios-supabase/` + `examples/skills/sinergia-ops/` son referencias inspiracionales de skills custom BI hand-tailored.

---

## Referencias

- `supabase/migrations/<timestamp>__aios_schema_canonical.sql` — schema canónico aplicado al project del operador.
- `.claude/skills/aios-supabase/SKILL.md` (en `examples/skills/`) — referencia inspiracional del operador del template.
- `.claude/skills/recall/SKILL.md` — skill hermana para retrieval semántico sobre `agent_memories`.
- `.claude/skills/memory-manager/SKILL.md` — skill hermana para memoria curada `.md`.
- `docs/SKILLS-CATALOG.md` — catálogo de las 18 skills activas.

---

## Aprendizajes propagables

- **MCP > SDK directo.** El MCP `supabase-prod` evita exponer service_role en logs/contexto del agente. Cuando el MCP está disponible, es preferido.
- **`list_tables verbose:true` antes de `apply_migration`.** Verificar shape existente para no chocar con tablas heredadas del template (caso típico: el template tiene `notifications` con shape agente-a-agente que choca con `notifications` BI custom).
- **Advisors WARN vs ERROR.** El template hereda 2 falsos positivos conscientes documentados (clase B SECURITY DEFINER + extension vector schema). Cualquier nuevo advisor ERROR es signal real.
