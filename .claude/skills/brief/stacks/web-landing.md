# Stack Recipe: web-landing

> **Compatibilidad Praxis**: `EXTEND`
> **Plataforma objetivo**: Web (desktop + mobile responsive)

## KEEP
- Next.js 16 + React 19 + TypeScript (ideal para landings con SSG/ISR y Core Web Vitals)
- Tailwind CSS 3.4 (utility-first)
- Zod (validacion de formularios contacto/leads)

## ADD
- `framer-motion` ^12 (animaciones de entrada / scroll)
- `next-themes` (dark mode toggle)
- `@vercel/analytics` + `@vercel/speed-insights` (metricas de conversion)
- `lucide-react` (iconografia)
- Opcional: `contentlayer2` o MDX para secciones ricas / blog embebido
- Opcional: headless CMS ligero (Sanity / Payload) si hay editores no tecnicos

## REPLACE
- Ninguno (stack Praxis encaja).

## REMOVE
- `src/features/auth/` (a menos que la landing incluya login)
- `src/core/adapters/supabase/server.ts` (si no hay backend dinamico)
- `src/features/dashboard/` (irrelevante)

## CONFIG
- Anadir `sitemap.xml` + `robots.txt` para SEO
- Configurar Open Graph / Twitter Card en `app/layout.tsx`
- Habilitar ISR con `revalidate: 3600` en paginas de contenido

## Archivos Praxis a eliminar
- `src/features/dashboard/`
- `src/features/auth/` si no hay login
- `src/core/adapters/supabase/server.ts` si no hay DB

## Archivos nuevos a crear
- `src/features/landing/components/Hero.tsx`
- `src/features/landing/components/Features.tsx`
- `src/features/landing/components/Pricing.tsx`
- `src/features/landing/components/FAQ.tsx`
- `src/features/landing/components/CTA.tsx`
- `src/features/landing/components/Testimonials.tsx`
- `public/og-image.png`

## IDE / Toolchain externo requerido
- Ninguno adicional. VS Code / Cursor funciona directo.
- Opcional: Vercel CLI para preview deployments.
