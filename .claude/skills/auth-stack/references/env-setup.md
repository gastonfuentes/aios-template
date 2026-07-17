# Variables de entorno — Supabase Auth

Tres variables son necesarias. Las primeras dos son publicas (exposed al browser); la tercera es secreta (solo server).

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Como conseguir cada una

1. Login en `https://supabase.com/dashboard`.
2. Selecciona el proyecto → Settings → API.
3. `Project URL` → va en `NEXT_PUBLIC_SUPABASE_URL`.
4. `Project API keys → anon public` → va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. `Project API keys → service_role secret` → va en `SUPABASE_SERVICE_ROLE_KEY`. **Nunca commitear esta**.

## Donde pegarlas

- Desarrollo local: `.env.local` (gitignored por default en Next.js).
- Produccion: panel de Vercel → Settings → Environment Variables.

## Verificacion

```bash
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

Si imprime la URL, las variables se cargan correcto. Si imprime `undefined`, revisar que el archivo se llame exactamente `.env.local` (no `.env` ni `env.local`).
