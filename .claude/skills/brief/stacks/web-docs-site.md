# Stack Recipe: web-docs-site

> **Compatibilidad Praxis**: `EXTEND`
> **Plataforma objetivo**: Web (con lectura optima en movil)

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4

## ADD
- `fumadocs-ui` + `fumadocs-core` + `fumadocs-mdx` (framework moderno Next.js-nativo)
  - Alternativa: `nextra` (simple) o `@astrojs/starlight` (si migran a Astro)
- `shiki` (syntax highlighting server-side, cero JS)
- `rehype-pretty-code` + `remark-gfm`
- Opcional: `algoliasearch` / `flexsearch` (busqueda full-text)
- Opcional: `next-mdx-remote` si no usan Fumadocs

## REPLACE
- Ninguno.

## REMOVE
- `src/features/auth/`, `src/features/dashboard/`
- `src/core/adapters/supabase/` (sitio estatico, no DB)

## CONFIG
- `contentlayer.config.ts` o `source.config.ts` (Fumadocs)
- Navegacion lateral auto-generada desde frontmatter
- Versionado de docs en sub-rutas `/docs/v1`, `/docs/v2`
- Sitemap + robots.txt
- Analytics de docs (pageviews por articulo)

## Archivos Praxis a eliminar
- `src/features/auth/`, `src/features/dashboard/`
- `src/core/adapters/supabase/`

## Archivos nuevos a crear
- `content/docs/**/*.mdx` (estructura de articulos)
- `src/app/docs/[[...slug]]/page.tsx`
- `src/components/docs/Sidebar.tsx`, `TableOfContents.tsx`, `Search.tsx`
- `source.config.ts` (Fumadocs)

## IDE / Toolchain externo requerido
- Ninguno (Algolia es opcional, via API key).
