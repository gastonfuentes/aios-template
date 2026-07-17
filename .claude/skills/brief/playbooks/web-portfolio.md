# Playbook: web-portfolio

## Targets obligatorios
- **Portfolios referencia del nicho** (diseno / desarrollo / product / arte): 5+ ejemplos actuales.
- **Estructura de case studies**: problema → proceso → solucion → impacto medible.
- **Performance con assets pesados**: imagenes optimizadas (next/image + AVIF), videos lazy, fonts sub-setted.

## Targets opcionales
- **CMS headless** si hay muchos proyectos: Sanity, Contentlayer, Payload.
- **Analytics privados**: Plausible, Umami (sin cookies, sin banner).

## Busquedas sugeridas
- "developer portfolio 2026 examples"
- "case study template personal website"
- "AVIF vs WebP support 2026"

## Fuentes primarias
- https://nextjs.org/docs/app/api-reference/components/image
- https://web.dev/articles/serve-images-with-correct-dimensions

## Riesgos a investigar activamente
- Portfolios con 3D/animacion cargan pesado en movil — LOD y lazy load obligatorio.
- Copyright de assets mostrados (clientes) — verificar permisos.
