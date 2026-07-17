# Playbook: web-blog

## Targets obligatorios
- **MDX vs markdown plano**: MDX permite componentes; mas poder pero mas complejo para editores.
- **Comments**: Giscus (GitHub Discussions), Disqus, self-hosted (Remark42).
- **SEO + Open Graph por articulo**: og image dinamica con `@vercel/og` o similar.
- **Newsletter pipeline**: Resend / ConvertKit / Mailchimp, double opt-in.

## Targets opcionales
- **Feed RSS** + JSON feed (algunos agregadores usan JSON).
- **Search**: pagefind (post-build static search sin servidor).
- **Tags / categorias** con paginas dinamicas.

## Busquedas sugeridas
- "MDX vs markdown blog Next.js 2026"
- "blog SEO best practices 2026"
- "Giscus vs Disqus comments"

## Fuentes primarias
- https://github.com/apps/giscus
- https://pagefind.app
- https://resend.com/docs

## Riesgos a investigar activamente
- Editores no tecnicos no manejan MDX → considerar CMS headless.
- Articulos largos → table of contents + reading progress bar.
