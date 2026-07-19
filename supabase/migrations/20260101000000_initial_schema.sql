-- AIOS Template — Initial schema migration
-- Aplica sobre un Supabase project nuevo. Idempotente vía IF NOT EXISTS donde aplica.
--
-- Cubre:
--   * Extensiones canónicas (vector, pgcrypto, uuid-ossp, pg_stat_statements) en schema `extensions`.
--   * Helper SECURITY DEFINER clase B `public.is_owner()` + trigger `handle_new_user`.
--   * 20 tablas core del chassis MC heredadas del template `business-os-template`.
--   * chat_sessions + chat_messages con branching (PRP-032).
--   * ops_events SSE stream + push_subscriptions PWA.
--   * agent_memories (memoria semántica indexada con HNSW) + 4 RPCs canónicas.
--   * draw_canvases (Excalidraw whiteboards) + agent_notifications (PWA push center).
--   * Storage bucket `chat_attachments` con 4 RLS policies per-folder uid check.
--   * RLS owner-only via `is_owner()` en TODAS las tablas (default deny).
--
-- NOTA: el nombre de tabla `agent_memories` + las 4 RPCs `match_/touch_/decay_/compact_`
-- son env-driven via `MEMORY_TABLE_PREFIX` (default `agent`). Deployments productivos
-- que migren desde un schema preexistente con otro prefix overridan el env y el código
-- los resuelve dinámicamente — cero cambio destructivo en BD.

BEGIN;

-- Defer validation of SQL function bodies: helpers like public.is_owner() are
-- defined before the tables they reference (e.g. public.profiles). This is the
-- canonical Supabase approach for self-contained schema dumps.
SET LOCAL check_function_bodies = false;

-- ============================================================================
-- EXTENSIONES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto       SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"    SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector         SCHEMA extensions;

-- ============================================================================
-- HELPER is_owner() — SECURITY DEFINER clase B
-- Body filtra por auth.uid() internamente; GRANT EXECUTE TO authenticated es seguro.
-- Advisor WARN `authenticated_security_definer_function_executable` es falso positivo.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated, service_role;

-- ============================================================================
-- profiles + trigger handle_new_user
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  email       text,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_owner_full_access ON public.profiles;
CREATE POLICY profiles_owner_full_access ON public.profiles FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- CORE TABLES heredadas del template business-os-template
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agents (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name            text NOT NULL,
  role            text NOT NULL DEFAULT 'assistant',
  status          text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','active','blocked')),
  level           text NOT NULL DEFAULT 'INT' CHECK (level IN ('LEAD','INT','SPC')),
  avatar          text DEFAULT '/avatar.png',
  current_task_id uuid,
  session_key     text,
  system_prompt   text,
  character       text,
  lore            text,
  tenant_id       uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  sequence_number   integer NOT NULL GENERATED BY DEFAULT AS IDENTITY,
  title             text NOT NULL,
  description       text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'inbox'
                      CHECK (status IN ('inbox','assigned','in_progress','review','done','archived')),
  priority          integer NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 4),
  tags              text[],
  border_color      text,
  session_key       text,
  openclaw_run_id   text,
  started_at        timestamptz,
  due_at            timestamptz,
  estimate          real,
  parent_task_id    uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  position          integer NOT NULL DEFAULT 0,
  used_coding_tools boolean,
  tenant_id         uuid,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_agents_current_task') THEN
    ALTER TABLE public.agents
      ADD CONSTRAINT fk_agents_current_task
      FOREIGN KEY (current_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_assignees (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id                   uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  title                text NOT NULL,
  content              text NOT NULL DEFAULT '',
  type                 text NOT NULL CHECK (type IN ('markdown','code','image','note','link','spec')),
  path                 text,
  task_id              uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by_agent_id  uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  tenant_id            uuid,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id             uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  task_id        uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_agent_id  uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  content        text NOT NULL,
  tenant_id      uuid,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  message_id   uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.activities (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  type        text NOT NULL CHECK (type IN ('status_update','assignees_update','task_update','message','document_created')),
  agent_id    uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  message     text NOT NULL,
  target_id   uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  tenant_id   uuid,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  mentioned_agent_id  uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  content             text NOT NULL,
  delivered           boolean DEFAULT false,
  tenant_id           uuid,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.labels (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#6366f1',
  tenant_id   uuid,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_labels (
  task_id   uuid NOT NULL REFERENCES public.tasks(id)  ON DELETE CASCADE,
  label_id  uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS public.saved_views (
  id                    uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name                  text NOT NULL,
  filters               jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_by               text,
  sort_dir              text,
  created_by_agent_id   uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  tenant_id             uuid,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_relations (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  source_task_id  uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  target_task_id  uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  relation_type   text NOT NULL CHECK (relation_type IN ('blocks','blocked_by','related','duplicate')),
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drawings (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  title       text NOT NULL DEFAULT 'Untitled',
  elements    jsonb NOT NULL DEFAULT '[]'::jsonb,
  app_state   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  run_id       text NOT NULL,
  agent_id     uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  prompt       text NOT NULL,
  response     text,
  source       text NOT NULL DEFAULT 'web',
  error        text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','error')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  google_event_id text UNIQUE NOT NULL,
  title           text NOT NULL,
  description     text,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  all_day         boolean NOT NULL DEFAULT false,
  account_type    text NOT NULL CHECK (account_type IN ('personal','business')),
  location        text,
  calendar_name   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- chat_sessions + chat_messages con branching (PRP-032)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  title       text NOT NULL DEFAULT 'New Chat',
  is_favorite boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  session_id          uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role                text NOT NULL CHECK (role IN ('user','assistant')),
  content             text NOT NULL,
  metadata            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  parent_message_id   uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  branch_index        integer NOT NULL DEFAULT 0
);
COMMENT ON COLUMN public.chat_messages.parent_message_id IS
  'PRP-032: branches del assistant — apunta al USER message que disparó la rama.';
COMMENT ON COLUMN public.chat_messages.branch_index IS
  'PRP-032: ordena cronológicamente las branches hermanas. 0 = primera; +1 cada regenerate.';

CREATE INDEX IF NOT EXISTS chat_messages_parent_idx
  ON public.chat_messages (parent_message_id)
  WHERE parent_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_messages_session_branch_idx
  ON public.chat_messages (session_id, parent_message_id, branch_index)
  WHERE parent_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
  ON public.chat_messages (session_id, created_at);

-- ============================================================================
-- ops_events SSE stream
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ops_events (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id    text NOT NULL,
  type        text NOT NULL,
  source      text NOT NULL
                CHECK (source IN ('web','mc-web','cron','system','telegram','manual','housekeeping')),
  session_id  text,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_events_created_at_idx ON public.ops_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ops_events_type_idx ON public.ops_events (type);
CREATE INDEX IF NOT EXISTS ops_events_source_idx ON public.ops_events (source);

-- Publica ops_events para Realtime
DO $$ BEGIN
  PERFORM 1 FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_events;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- push_subscriptions PWA (multi-device)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  keys_p256dh text NOT NULL,
  keys_auth   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- agent_memories (memoria semántica indexada con HNSW)
-- Naming neutral; el daemon resuelve via env MEMORY_TABLE_PREFIX (default `agent`).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_memories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content           text NOT NULL,
  embedding         extensions.vector(1536) NOT NULL,
  tags              text[] DEFAULT '{}'::text[],
  entity            text,
  importance        numeric DEFAULT 1.0 CHECK (importance >= 0 AND importance <= 10),
  accessed_count    integer DEFAULT 0,
  last_accessed_at  timestamptz,
  created_at        timestamptz DEFAULT now(),
  source            text NOT NULL,
  content_hash      text NOT NULL,
  chat_session_id   text,
  metadata          jsonb DEFAULT '{}'::jsonb,
  UNIQUE (source, content_hash)
);

CREATE INDEX IF NOT EXISTS agent_memories_embedding_hnsw_idx
  ON public.agent_memories
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS agent_memories_source_idx     ON public.agent_memories (source);
CREATE INDEX IF NOT EXISTS agent_memories_entity_idx     ON public.agent_memories (entity);
CREATE INDEX IF NOT EXISTS agent_memories_importance_idx ON public.agent_memories (importance DESC);

-- match_agent_memories: top-K por similitud coseno descendente
CREATE OR REPLACE FUNCTION public.match_agent_memories(
  query_embedding extensions.vector,
  match_limit     integer DEFAULT 5
)
RETURNS TABLE (
  id                uuid,
  content           text,
  tags              text[],
  entity            text,
  importance        numeric,
  accessed_count    integer,
  last_accessed_at  timestamptz,
  created_at        timestamptz,
  source            text,
  similarity        double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    m.id, m.content, m.tags, m.entity, m.importance, m.accessed_count,
    m.last_accessed_at, m.created_at, m.source,
    1.0 - (m.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.agent_memories AS m
  ORDER BY m.embedding OPERATOR(extensions.<=>) query_embedding ASC
  LIMIT GREATEST(1, LEAST(match_limit, 50));
$$;

-- touch_agent_memory: bumpea accessed_count + last_accessed_at (fire-and-forget)
CREATE OR REPLACE FUNCTION public.touch_agent_memory(memory_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.agent_memories
     SET accessed_count   = accessed_count + 1,
         last_accessed_at = now()
   WHERE id = memory_id;
$$;

-- decay_agent_memories: aplica decay multiplicativo a memorias viejas no accedidas (cron nocturno)
CREATE OR REPLACE FUNCTION public.decay_agent_memories(
  decay_factor    numeric,
  age_days        integer,
  hits_threshold  integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE affected integer;
BEGIN
  IF decay_factor IS NULL OR decay_factor <= 0 OR decay_factor > 1 THEN
    RAISE EXCEPTION 'decay_factor must be in (0, 1]';
  END IF;
  IF age_days IS NULL OR age_days < 0 THEN
    RAISE EXCEPTION 'age_days must be >= 0';
  END IF;
  IF hits_threshold IS NULL OR hits_threshold < 0 THEN
    RAISE EXCEPTION 'hits_threshold must be >= 0';
  END IF;

  WITH updated AS (
    UPDATE public.agent_memories
       SET importance = GREATEST(importance * decay_factor, 0)
     WHERE accessed_count < hits_threshold
       AND (
         (last_accessed_at IS NULL AND created_at < now() - make_interval(days => age_days))
         OR last_accessed_at < now() - make_interval(days => age_days)
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO affected FROM updated;
  RETURN COALESCE(affected, 0);
END;
$$;

-- compact_agent_memories: DELETE de memorias con importance < threshold (post-decay)
CREATE OR REPLACE FUNCTION public.compact_agent_memories(threshold numeric)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE affected integer;
BEGIN
  IF threshold IS NULL OR threshold < 0 THEN
    RAISE EXCEPTION 'threshold must be >= 0';
  END IF;
  IF threshold > 1.0 THEN
    RAISE EXCEPTION 'threshold > 1.0 would delete most rows; aborting';
  END IF;

  WITH deleted AS (
    DELETE FROM public.agent_memories WHERE importance < threshold RETURNING 1
  )
  SELECT COUNT(*) INTO affected FROM deleted;
  RETURN COALESCE(affected, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.match_agent_memories(extensions.vector, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.touch_agent_memory(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decay_agent_memories(numeric, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compact_agent_memories(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_agent_memories(extensions.vector, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.touch_agent_memory(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decay_agent_memories(numeric, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compact_agent_memories(numeric) TO authenticated, service_role;

-- ============================================================================
-- draw_canvases (Excalidraw whiteboards owner-scoped)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.draw_canvases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL DEFAULT 'Untitled',
  elements       jsonb NOT NULL DEFAULT '[]'::jsonb,
  app_state      jsonb NOT NULL DEFAULT '{}'::jsonb,
  files          jsonb NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url  text,
  owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS draw_canvases_owner_updated_idx
  ON public.draw_canvases (owner_id, updated_at DESC);

-- ============================================================================
-- agent_notifications (PWA notification center, parametrizable por agente)
-- Renombrada de aios_notifications para neutralidad.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text,
  severity    text NOT NULL CHECK (severity IN ('info','warn','error','success')),
  link        text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS agent_notifications_owner_created_idx
  ON public.agent_notifications (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_notifications_unread_idx
  ON public.agent_notifications (owner_id, read_at)
  WHERE read_at IS NULL;

-- ============================================================================
-- RLS owner-only en TODAS las tablas restantes (default deny)
-- Helper canónico: FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (...)
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'agents','tasks','task_assignees','documents','messages','message_attachments',
      'activities','notifications','labels','task_labels','saved_views','task_relations',
      'drawings','conversations','calendar_events','chat_sessions','chat_messages',
      'ops_events','push_subscriptions','agent_memories','draw_canvases','agent_notifications'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_owner_full_access ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY %I_owner_full_access ON public.%I FOR ALL TO authenticated
         USING (public.is_owner()) WITH CHECK (public.is_owner());',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================================
-- Storage bucket `chat_attachments` (privado, owner-scoped per-folder uid check)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat_attachments',
  'chat_attachments',
  false,
  26214400, -- 25 MB
  ARRAY[
    'image/png','image/jpeg','image/webp','image/gif',
    'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav',
    'application/pdf','text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS chat_attachments_owner_select ON storage.objects;
CREATE POLICY chat_attachments_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat_attachments' AND public.is_owner()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS chat_attachments_owner_insert ON storage.objects;
CREATE POLICY chat_attachments_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat_attachments' AND public.is_owner()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS chat_attachments_owner_update ON storage.objects;
CREATE POLICY chat_attachments_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat_attachments' AND public.is_owner()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS chat_attachments_owner_delete ON storage.objects;
CREATE POLICY chat_attachments_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat_attachments' AND public.is_owner()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
