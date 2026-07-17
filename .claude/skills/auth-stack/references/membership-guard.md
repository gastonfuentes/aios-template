# Membership guard — integrar con `praxis_members`

Si el alumno construye una app que extiende la membresia your-community-slug (ej. herramienta exclusiva para miembros activos), el guard verifica el estado de membresia antes de permitir acceso a `/(app)/*`.

## Helper

```ts
// src/features/auth/lib/require-active-member.ts
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function requireActiveMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/signin');

  const { data: membership } = await supabase
    .from('praxis_members')
    .select('status, expires_at')
    .eq('email', user.email!)
    .maybeSingle();

  const isActive =
    membership?.status === 'active' ||
    membership?.status === 'lifetime' ||
    (membership?.expires_at && new Date(membership.expires_at) > new Date());

  if (!isActive) redirect('/membership-expired');

  return { user, membership };
}
```

## Uso

```tsx
export default async function PrivateTool() {
  const { user, membership } = await requireActiveMember();
  return <div>Hola miembro {membership.status}</div>;
}
```

## Pagina `/membership-expired`

Plantilla minima en `assets/membership-expired.tsx`. Mensaje canonico your-community-slug:

> Tu membresia expiro. Vuelve a your-community-slug.com para renovar y desbloquear esta herramienta.

CTA principal: link directo a la pagina de renovacion. CTA secundario: "Volver al login" (por si fue confusion).

## Si no tienes acceso a `praxis_members`

Esa tabla pertenece al proyecto Supabase de Praxis (mantenido por el owner del meta-system), no al del alumno. Solo aplica si:

1. El alumno esta construyendo una herramienta interna autorizada por el owner de Praxis.
2. El alumno usa la Edge Function `verify-member` publica de Praxis para gate.

Default: el alumno hace su propia tabla `subscriptions` o equivalente. Cross-ref `@.claude/skills/payments-polar/SKILL.md` para el patron canonico.
