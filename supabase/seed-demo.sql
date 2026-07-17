-- seed-demo.sql — datos demo opt-in.
--
-- Inserta:
--   * 1 chat session de bienvenida + 1 assistant message inicial
--   * 3 notifications de onboarding ancladas al owner
--   * 1 canvas Draw placeholder anclado al owner
--
-- Idempotente vía ON CONFLICT DO NOTHING — correr 2x no duplica nada.
--
-- IMPORTANTE: requiere que el operador haya hecho su primer signup ANTES de
-- aplicar este seed. El trigger handle_new_user() crea automáticamente un
-- profile con role='member'; tienes que UPDATE manual ese profile a
-- role='owner' (1 query desde el dashboard) para que las inserts de
-- notifications + draw_canvases encuentren el profile owner y aniclen los
-- owner_id FKs correctamente. Sin un profile owner las inserts se omiten
-- silenciosamente (cero rows insertadas, NO error).
--
-- Cómo aplicar:
--   1. supabase db push     (aplica migrations del chassis)
--   2. (signup desde la PWA con tu email)
--   3. UPDATE public.profiles SET role = 'owner' WHERE email = '<tu-email>';
--   4. Aplicar este archivo via psql / SQL Editor / supabase CLI.

BEGIN;

-- 1 chat session de bienvenida
INSERT INTO public.chat_sessions (id, title, is_favorite)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Bienvenido a tu Mission Control',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 1 assistant message inicial
INSERT INTO public.chat_messages (id, session_id, role, content, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'assistant',
  E'Hola, soy tu agente principal. Estoy listo para ayudarte a operar tu Mission Control 24/7.\n\nAlgunas cosas que puedes pedirme:\n- "Articula esta idea como brief" (skill brief)\n- "Genera el PRP de esta feature" (skill prp)\n- "Implementa el plan" (skill bucle-agentico)\n- "Recuerda que..." (memoria activa nativa)\n- "¿Qué dije sobre X?" (recall semántico)\n\nCuando estés listo, dispárame el primer turn.',
  '{"source":"seed-demo"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3 notifications de onboarding (anclan owner_id desde profiles donde role='owner').
-- Si no hay profile owner aún, el SELECT retorna 0 rows y el INSERT no hace nada.
INSERT INTO public.agent_notifications (id, title, body, severity, link, owner_id)
SELECT
  ids.id, ids.title, ids.body, ids.severity, ids.link, p.id
FROM public.profiles p
CROSS JOIN (VALUES
  ('00000000-0000-0000-0000-000000000010'::uuid, 'Tu MC está vivo',                'Setup completo. Empieza por el chat o explora /dashboard.', 'success', '/dashboard'),
  ('00000000-0000-0000-0000-000000000011'::uuid, 'Personaliza tu identidad',       'Edita .claude/identity/SOUL.md + USER.md + HEARTBEAT.md.', 'info',    '/settings'),
  ('00000000-0000-0000-0000-000000000012'::uuid, 'Cambia tu wallpaper + brand',    'Reemplaza public/brand-mark-source.png y corre npm run icons:generate.', 'info', '/settings')
) AS ids(id, title, body, severity, link)
WHERE p.role = 'owner'
ON CONFLICT (id) DO NOTHING;

-- 1 canvas Draw con diagrama de arquitectura placeholder
INSERT INTO public.draw_canvases (id, title, elements, app_state, owner_id)
SELECT
  '00000000-0000-0000-0000-000000000020'::uuid,
  'Tu arquitectura',
  '[]'::jsonb,
  '{"viewBackgroundColor":"#ffffff"}'::jsonb,
  p.id
FROM public.profiles p
WHERE p.role = 'owner'
ON CONFLICT (id) DO NOTHING;

COMMIT;
