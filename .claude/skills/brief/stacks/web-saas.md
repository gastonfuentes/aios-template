# Stack Recipe: web-saas

> **Compatibilidad Praxis**: `MATCH`
> **Plataforma objetivo**: Web (dashboards responsive)

## KEEP
- Next.js 16 + React 19 + TypeScript (full-stack)
- Tailwind CSS 3.4
- Supabase (Auth + Postgres + Storage + Realtime + RLS)
- Zod (validacion server actions + client forms)
- Zustand (estado cliente global)
- Vercel AI SDK v5 (si el SaaS incluye IA)

## ADD
- `@tanstack/react-query` ^5 (cache de server state)
- `stripe` + `@stripe/stripe-js` + `@stripe/react-stripe-js` (pagos, suscripciones)
- `@supabase/ssr` (session management server-side)
- `react-hook-form` + `@hookform/resolvers` (forms complejos)
- `date-fns` (utilidades de fecha)
- Opcional: `posthog-js` / `@vercel/analytics` (product analytics)

## REPLACE
- Ninguno.

## REMOVE
- Ninguno.

## CONFIG
- Tablas Supabase: `profiles`, `subscriptions`, `usage_limits` (segun el SaaS)
- RLS habilitada en todas las tablas (critico)
- Webhook Stripe en `app/api/webhooks/stripe/route.ts`
- Middleware de auth en `middleware.ts`
- Variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Archivos Praxis a eliminar
- Ninguno (el scaffold ya apunta a SaaS).

## Archivos nuevos a crear
- `src/features/billing/` (Stripe integration)
- `src/features/<producto>/` (feature core del SaaS)
- `supabase/migrations/*.sql`
- `middleware.ts` (si no existe)

## IDE / Toolchain externo requerido
- Supabase CLI (migraciones locales)
- Stripe CLI (webhook forwarding en dev)
