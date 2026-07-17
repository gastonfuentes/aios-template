# Multi-rol — admin vs alumno

Caso comun para creadores your-community-slug: el dashboard tiene una vista para alumnos (consumir contenido) y otra para el creador (administrar contenido). Tres roles canonicos:

- `student` (default) — consume.
- `creator` — administra contenido propio.
- `admin` — administra todo (raro, casi solo Juan).

La columna `role` ya existe en `profiles` (creada en Paso 1 de SKILL.md).

## Helper de proteccion server-side

```ts
// src/features/auth/lib/require-role.ts
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function requireRole(
  role: 'admin' | 'creator' | 'student' | Array<'admin' | 'creator' | 'student'>,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/signin');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const allowed = Array.isArray(role) ? role : [role];
  if (!profile || !allowed.includes(profile.role)) redirect('/(app)/dashboard');

  return { user, profile };
}
```

Uso:

```tsx
// src/app/(app)/admin/page.tsx
import { requireRole } from '@/features/auth/lib/require-role';

export default async function AdminPage() {
  const { user, profile } = await requireRole('admin');
  return <div>Hola {profile.role}</div>;
}
```

## RLS por rol — patron canonico

```sql
create policy "creators_manage_own_content" on public.contents
  for all using (
    exists(
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'creator')
        and id = contents.creator_id
    )
  );
```

La RLS en BD es la defensa ultima. El helper TypeScript es UX (redirect amable). **No confiar solo en el client** — un atacante salta el client y la BD lo bloquea igual.

## Cambio de rol

Manual via SQL (admin) o panel admin propio:

```sql
update public.profiles set role = 'creator' where email = 'alumno@ejemplo.com';
```

Publico (alumno se auto-promueve a creator pagando): el webhook de `payments-polar` cambia el rol al recibir `checkout.completed`. Cross-ref `@.claude/skills/payments-polar/SKILL.md`.
