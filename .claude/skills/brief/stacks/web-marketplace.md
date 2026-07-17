# Stack Recipe: web-marketplace

> **Compatibilidad Praxis**: `EXTEND`
> **Plataforma objetivo**: Web (desktop + mobile)

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4
- Supabase (Auth + DB + Storage + RLS)
- Zod + Zustand

## ADD
- `stripe` con **Stripe Connect** (splits a vendedores) + webhooks
- `@tanstack/react-query` ^5
- `react-hook-form` + `@hookform/resolvers`
- `uploadthing` o Supabase Storage con presigned URLs (imagenes de productos)
- `@googlemaps/react-wrapper` o Mapbox GL JS (si hay geo-busqueda)
- `meilisearch` / `typesense` (busqueda full-text + facetas)
- `react-email` + `@resend/node` (emails transaccionales)

## REPLACE
- Ninguno.

## REMOVE
- Ninguno.

## CONFIG
- Tablas: `vendors`, `listings`, `orders`, `reviews`, `disputes`
- RLS: vendors ven sus listings; buyers ven sus orders; admin ve todo
- Stripe Connect Express (onboarding de vendedores)
- Webhook Stripe: `payment_intent.succeeded` → split transfer a vendor
- Geo: PostGIS en Supabase si hay mapa

## Archivos Praxis a eliminar
- Ninguno.

## Archivos nuevos a crear
- `src/features/vendors/` (onboarding Stripe Connect)
- `src/features/listings/`
- `src/features/orders/`
- `src/app/api/webhooks/stripe/route.ts`
- `supabase/migrations/**_postgis.sql` (si hay geo)

## IDE / Toolchain externo requerido
- Stripe CLI (webhook forwarding)
- Supabase CLI
