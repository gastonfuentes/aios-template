---
name: auth-stack
description: "Configura autenticacion con Supabase Auth + magic-link como camino primario, tabla profiles con RLS, middleware de proteccion de rutas, y multi-rol opcional para apps Next.js. Activar cuando el usuario menciona login, signup, autenticacion, sesion de usuario, magic-link, profiles, RLS, proteger rutas, multi-rol, o flujos como 'que mis alumnos puedan entrar', 'crear cuenta', 'recuperar contraseña'."
allowed-tools: Read, Write, Edit, Bash, mcp__claude_ai_Supabase__apply_migration, mcp__claude_ai_Supabase__execute_sql, mcp__claude_ai_Supabase__list_tables
---

# auth-stack — autenticacion lista para alumnos

> Encadena en una sola corrida: tabla `profiles` con RLS, magic-link, middleware de rutas protegidas, y los hooks que el resto de skills (emails, payments, pwa) consumen.

---

## Cuando activar

- "Necesito login para mis alumnos."
- "Que el usuario pueda entrar con su email."
- "Quiero que solo los registrados vean el dashboard."
- "Agrega magic-link / signup / password reset."
- "Necesito profiles / multi-rol / admin vs alumno."
- "Proteger rutas privadas."

## Cuando NO activar

- El proyecto ya tiene auth funcional y solo necesita un campo nuevo en `profiles`. Edita la tabla directo con `supabase-admin`.
- El usuario quiere SSO empresarial con SAML/SCIM. Eso queda fuera del scope de Supabase Auth basico — escalar a docs oficiales.

## Antes de empezar — verifica empiricamente

Ejecuta los chequeos en orden y resuelve cada faltante autonomamente (Regla 6 PRP-029, sub-regla b — investiga y resuelve, no preguntes):

- [ ] Variables de entorno presentes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Faltante → escalar c1 con instrucciones simples (ver `references/env-setup.md`).
- [ ] Dependencias instaladas: `@supabase/supabase-js`, `@supabase/ssr`. Faltantes → `npm install` autonomo.
- [ ] Existe `src/lib/supabase/browser.ts` y `src/lib/supabase/server.ts` (scaffold base de Praxis). Si faltan, generarlos con el patron de `references/clients.md`.
- [ ] El proyecto Supabase no tiene aun la tabla `profiles` (verificable con `mcp__claude_ai_Supabase__list_tables`). Si existe y la owna otra skill/proyecto, NO sobrescribir — escalar c2.

## Flujo principal

### Paso 1: tabla `profiles` con RLS habilitada

Crea la tabla `profiles` con RLS activada **antes del primer write**. Razon: Supabase no permite re-aplicar RLS retroactivamente sin migracion compleja, y cualquier insert previo queda accesible publico.

Migracion canonica:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'admin', 'creator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

-- Insert via trigger desde auth.users — ningun cliente inserta directo.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Aplicar via `mcp__claude_ai_Supabase__apply_migration` con nombre `0001_profiles_with_rls`. Verificar con `list_tables` que la tabla aparezca con RLS = true.

### Paso 2: magic-link como camino primario

Praxis prefiere magic-link sobre password porque (a) elimina la friccion del "olvide mi contraseña" para el alumno, (b) reduce surface de phishing, (c) Supabase lo trae built-in sin SMTP propio gracias a su servicio default.

Componente de signin: `assets/signin-form.tsx` (copy paste-able). Despachas `signInWithOtp` y rediriges a `/auth/callback` que cambia el codigo OTP por la sesion.

Si el alumno explicitamente pide password como opcion, agregar despues del magic-link como secundaria — no como primaria. Ver `references/password-flow.md`.

### Paso 3: middleware de proteccion de rutas

`src/middleware.ts` intercepta cada request, lee la sesion del cookie, y redirige a `/signin` cuando una ruta privada se accede sin autenticacion. Plantilla en `assets/middleware.ts`.

Convencion de rutas:

- `/(public)/*` → publicas (landing, signin, signup, signup-callback).
- `/(app)/*` → protegidas (dashboard, settings, etc).
- Adicional matcher `/api/protected/*` para endpoints.

### Paso 4: multi-rol opcional

Si el alumno necesita distinguir admin vs alumno (caso comun para creadores que venden cursos):

1. La columna `role` ya existe en `profiles` (Paso 1).
2. Helper `requireRole(role: 'admin' | 'creator')` en `references/multi-role.md`.
3. RLS adicional para tablas que solo admin lee/escribe:

   ```sql
   create policy "admin_only_read" on public.<tabla>
     for select using (
       exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
     );
   ```

### Paso 5: integracion con membresia your-community-slug (si aplica)

Si el proyecto del alumno consume la membresia de Praxis (verifiable porque tiene `praxis_members` en su Supabase via `list_tables`), agregar el guard que verifica activo antes de permitir acceso a `/(app)/*`. Plantilla en `references/membership-guard.md`.

## Si tu Directiva no es Next.js/Supabase

Ver `references/<framework>-non-next.md`:

- React Native + Expo → `references/expo-non-next.md`
- SvelteKit → `references/sveltekit-non-next.md`
- Remix → `references/remix-non-next.md`
- Backend-only (sin frontend) → `references/api-only-non-next.md`

## Cross-references con skills hermanas

- `@.claude/skills/emails-transactional/SKILL.md` — encadenar despues de signup para enviar welcome al alumno. Hand-off: el trigger `handle_new_user` puede llamar una funcion edge que despache `sendEmail({ template: 'welcome', to: new.email })`.
- `@.claude/skills/payments-polar/SKILL.md` — vincular `purchases.user_id` con `profiles.id` para que el dashboard del alumno muestre sus pagos. Hand-off: el webhook de Polar lee `profiles` por email para asociar el customer.
- `@.claude/skills/pwa-mobile/SKILL.md` — guardar la suscripcion push en `profiles.push_subscription` (jsonb) para enviar notificaciones segmentadas. Hand-off: tras `enableNotifications()` UPSERT en profiles.
- `@.claude/skills/supabase-admin/SKILL.md` — reusa el patron de RLS de Paso 1 para cualquier tabla nueva. La regla "RLS antes del primer write" es transversal.
- `@.claude/skills/ai-sdk-kit/SKILL.md` — agente con memoria persistente lee `profiles.full_name` para personalizar el system prompt.

## Archivos lazy-loaded

- `references/clients.md` — patron de creacion de clients browser/server (SSR + cookies + middleware).
- `references/password-flow.md` — flujo password como opcion secundaria si el alumno lo pide.
- `references/multi-role.md` — helpers de role-based access + RLS por rol.
- `references/membership-guard.md` — integracion con `praxis_members` para gates condicionales.
- `references/env-setup.md` — checklist de variables de entorno + como conseguir cada una.
- `references/<framework>-non-next.md` — adaptaciones para stacks no-Next.js (expo, sveltekit, remix, api-only).
- `assets/signin-form.tsx` — componente magic-link copy-paste.
- `assets/middleware.ts` — middleware de proteccion de rutas copy-paste.
- `assets/auth-callback.tsx` — handler `/auth/callback` que canjea OTP por sesion.
- `scripts/seed-test-users.sh` — crea 2 usuarios de prueba (admin + student) para QA local.

## Validacion al cerrar

```bash
# Tabla con RLS
echo "select tablename, rowsecurity from pg_tables where tablename = 'profiles';" | psql ...

# Cliente puede signin
npm run dev
# Navega a /signin, ingresa tu email, recibe magic-link en correo, click, llega a /(app)/dashboard.

# RLS bloquea writes ajenos
# Como user A intenta UPDATE profiles where id = <user B id>. Debe fallar con 403.
```

Si los 3 pasan, la skill cerro correcto. Si alguno falla, leer el error completo + `mcp__claude_ai_Supabase__get_logs` antes de iterar.
