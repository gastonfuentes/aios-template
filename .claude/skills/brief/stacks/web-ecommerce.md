# Stack Recipe: web-ecommerce

> **Compatibilidad Praxis**: `EXTEND`
> **Plataforma objetivo**: Web (mobile-first, checkout optimizado)

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4
- Supabase (catalogo de productos + inventario + pedidos)
- Zod + Zustand (carrito persistente en localStorage)

## ADD
- `stripe` + `@stripe/stripe-js` + `@stripe/react-stripe-js`
  - Alternativa: Stripe Checkout (hosted) si se quiere simplicidad
- `@tanstack/react-query`
- `react-hook-form` + `@hookform/resolvers`
- `react-email` + `@resend/node` (confirmacion pedido)
- `@vercel/og` (imagenes dinamicas de producto para OG)
- Opcional: `algoliasearch` o `typesense` (busqueda + facetas)

## REPLACE
- Ninguno.

## REMOVE
- `src/features/dashboard/` si no hay admin CMS

## CONFIG
- Tablas: `products`, `inventory`, `cart_items`, `orders`, `order_items`, `customers`
- RLS: customers ven sus orders; admin ve todo
- Stripe: productos + precios sincronizados desde Supabase (webhook `product.updated`)
- Webhooks: `checkout.session.completed` → crear order + decrementar inventory
- SEO: schema.org `Product` + `Offer` por producto

## Archivos Praxis a eliminar
- Ninguno critico.

## Archivos nuevos a crear
- `src/features/catalog/` (listado + detalle)
- `src/features/cart/` (Zustand store + UI)
- `src/features/checkout/` (Stripe Elements o Checkout)
- `src/app/api/webhooks/stripe/route.ts`
- `supabase/migrations/**_ecommerce.sql`

## IDE / Toolchain externo requerido
- Stripe CLI
- Supabase CLI
