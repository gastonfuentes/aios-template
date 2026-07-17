# Stack Recipe: web-blog

> **Compatibilidad Praxis**: `EXTEND`
> **Plataforma objetivo**: Web

## KEEP
- Next.js 16 + React 19 + TypeScript (MDX nativo, SSG/ISR)
- Tailwind CSS 3.4
- Zod (validacion de contacto/newsletter)
- Supabase (si hay suscripciones de newsletter almacenadas)

## ADD
- `contentlayer2` o `@next/mdx` + `mdx-bundler`
- `remark-gfm` + `rehype-pretty-code` + `shiki`
- `gray-matter` (frontmatter)
- `reading-time` (calcular tiempo de lectura)
- Opcional: `@resend/node` (newsletter) + Supabase para subscribers
- Opcional: `feed` para RSS/Atom

## REPLACE
- Ninguno.

## REMOVE
- `src/features/dashboard/` (a menos que haya panel admin)
- `src/features/auth/` (si el blog es publico sin editores web)

## CONFIG
- Rutas: `/`, `/blog`, `/blog/[slug]`, `/tags/[tag]`, `/rss.xml`
- `generateStaticParams` para articulos
- OpenGraph por articulo con `generateMetadata`
- Sitemap + RSS feed auto-generado

## Archivos Praxis a eliminar
- `src/features/dashboard/` si no hay admin
- `src/features/auth/` si no hay editores

## Archivos nuevos a crear
- `content/blog/*.mdx`
- `src/app/blog/[slug]/page.tsx`
- `src/app/rss.xml/route.ts`
- `src/features/blog/components/PostCard.tsx`
- `src/features/blog/utils/posts.ts` (reader de MDX)

## IDE / Toolchain externo requerido
- Ninguno. Opcional: Resend (newsletter) o Buttondown.
