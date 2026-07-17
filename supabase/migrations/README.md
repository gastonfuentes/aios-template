# Supabase Migrations

**TL;DR**: cómo aplicar las migrations del chassis del template a tu Supabase project. El archivo `20260101000000_initial_schema.sql` es lo MÍNIMO obligatorio — cubre helper `is_owner()`, 20 tablas core, `chat_*`, `ops_events`, `push_subscriptions`, `agent_memories` con HNSW + 4 RPCs, `draw_canvases`, `agent_notifications`, Storage bucket `chat_attachments`. Las migrations BI viven en `examples/bi-tables/` y son opt-in.

## Pre-requisitos

1. Supabase project creado (Cloud free tier suficiente para empezar).
2. Anótate los 3 datos del project:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **Service role key** (settings → API)
   - **Project ref** (los 20 chars de la URL)

## Caminos para aplicar

### Camino A — Supabase CLI (recomendado)

Más limpio si tienes la CLI instalada y vas a iterar sobre el schema.

```bash
# Una sola vez: instalar la CLI y autenticarse
brew install supabase/tap/supabase
supabase login

# Link a tu project
cd <tu-proyecto>
supabase link --project-ref <ref>

# Aplicar las migrations pendientes
supabase db push
```

La CLI lee `supabase/migrations/*.sql` ordenados alfabéticamente y aplica los faltantes. Mantiene un `schema_migrations` tracking interno para no re-correr.

### Camino B — MCP Supabase

Si tu agente Claude Code tiene la integración MCP de Supabase conectada (botón "Add integration" en el sidebar de claude.ai, o `.mcp.json` local), pídele literalmente:

> "Aplica las migrations de `supabase/migrations/` a mi project"

El agente invoca `mcp__supabase__apply_migration` por archivo (`list_migrations` primero para skipear los ya aplicados). Útil cuando no quieres tipear shell.

### Camino C — Manual dashboard

Si no tienes CLI ni MCP a mano:

1. Abre tu Supabase project en https://supabase.com.
2. Sidebar → **SQL Editor** → **New query**.
3. Pega el contenido completo de `20260101000000_initial_schema.sql` → **Run**.
4. Repite para cada archivo nuevo de `supabase/migrations/`, en orden alfabético.

Más laborioso pero no requiere CLI ni MCP. Útil para una primera vez.

## Reminders

- `20260101000000_initial_schema.sql` es lo MÍNIMO obligatorio del chassis. Aplícalo siempre primero.
- `examples/bi-tables/` son **opt-in** — ver el README de esa carpeta para criterios.
- Si vas a sembrar datos demo: aplicar `20260101000000_initial_schema.sql` PRIMERO + hacer tu primer signup (para que el trigger `handle_new_user` cree tu profile con `role='owner'`) + DESPUÉS aplicar `supabase/seed-demo.sql`. El seed depende de que exista un profile owner para anclar los `owner_id` FKs.
- Todas las RLS policies usan `public.is_owner()`. Si necesitas que un segundo usuario lea datos, ajustá `handle_new_user()` o sumá una policy adicional (`FOR SELECT TO authenticated USING (…)`).
