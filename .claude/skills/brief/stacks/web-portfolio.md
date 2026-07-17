# Stack Recipe: web-portfolio

> **Compatibilidad Praxis**: `EXTEND`
> **Plataforma objetivo**: Web (desktop + mobile)

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4
- Zod (si hay form de contacto)

## ADD
- `framer-motion` (animaciones de showcase)
- `three` + `@react-three/fiber` + `@react-three/drei` (si hay escenas 3D de impacto)
- `mdx-bundler` o `contentlayer2` (si los proyectos se escriben en MDX)
- `next/font` local con fuentes variables (tipografia como diferenciador)

## REPLACE
- Ninguno.

## REMOVE
- `src/features/auth/` (portfolio suele ser publico)
- `src/features/dashboard/`
- `src/core/adapters/supabase/` (a menos que haya CMS)

## CONFIG
- Rutas estaticas: `/`, `/proyectos`, `/proyectos/[slug]`, `/contacto`
- SEO completo con `generateMetadata` por proyecto
- Sitemap con los proyectos

## Archivos Praxis a eliminar
- `src/features/auth/`, `src/features/dashboard/`
- `src/core/adapters/supabase/` si no hay backend

## Archivos nuevos a crear
- `src/features/portfolio/components/ProjectCard.tsx`
- `src/features/portfolio/data/projects.ts` (MDX o array tipado)
- `src/features/portfolio/components/Hero.tsx`
- `src/app/proyectos/[slug]/page.tsx`

## IDE / Toolchain externo requerido
- Ninguno.
