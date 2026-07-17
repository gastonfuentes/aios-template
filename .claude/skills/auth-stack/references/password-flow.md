# Password flow — opcion secundaria

Magic-link es el camino primario de Praxis. Password se ofrece **solo si el alumno explicitamente lo pide** (caso: enterprise users que no quieren recibir emails, o nicho que asume password como default).

## Activar password en Supabase

Por default ya esta activado. Si fue deshabilitado:

1. Dashboard → Authentication → Providers → Email.
2. Habilitar "Email + Password".
3. Confirmar email opcional (recomendado: ON, salvo onboarding agresivo).

## Componente signup con password

```tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

export function SignupPasswordForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      <button type="submit">Crear cuenta</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

## Reset password

`/forgot-password` despacha `resetPasswordForEmail`, que envia link a `/auth/reset-password` donde el usuario ingresa la nueva.

```ts
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/reset-password`,
});
```

## Cuando NO ofrecer password

- Apps consumer-grade donde el alumno no quiere "olvide mi contraseña" en su soporte.
- MVPs con onboarding rapido — magic-link reduce friccion del 30% al ~5%.
- Nichos con riesgo de phishing (financiero, salud) — magic-link reduce surface.

Si dudas, default a magic-link y agregar password despues si los usuarios lo piden.
