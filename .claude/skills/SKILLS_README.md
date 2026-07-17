# Skills

> Sistema modular de skills que Claude descubre solo. Formato oficial: [Anthropic Agent Skills Specification](https://docs.anthropic.com/en/docs/agents/skills).

Cada skill vive en `.claude/skills/<id>/` como una carpeta con un `SKILL.md` (frontmatter YAML + instrucciones). Claude Code las descubre por el frontmatter al iniciar. Se activan y desactivan desde el panel de Praxis (pestaña **Skills**).

---

## Inventario (15 disponibles)

| Skill | Comando | Rol |
|-------|---------|-----|
| `brief` | `/brief <idea>` | Investigar + entrevistar + redactar brief en primera persona. Auto-detecta modo master/single y tipo de proyecto entre 28 categorias. Emite Directiva de Stack para la siguiente skill. |
| `prp` | `/prp [feature]` | Generar PRP (Product Requirements Prompt) a partir de un brief o descripcion. |
| `bucle-agentico` | `/bucle-agentico` | Correr el PRP por fases con mapeo de contexto por fase. |
| `build-with-agent-team` | `/build-with-agent-team` | Orquestar equipos de agentes especializados para planes complejos. |
| `auth-stack` | `/auth-stack` | Auth completo Supabase (login, signup, reset, OAuth, profiles, RLS). |
| `payments-polar` | `/payments-polar` | Pagos Polar: checkout, webhooks, suscripciones. |
| `emails-transactional` | `/emails-transactional` | Emails transaccionales con Resend + React Email + unsubscribe. |
| `pwa-mobile` | `/pwa-mobile` | PWA instalable + push notifications (iOS compatible). |
| `supabase-admin` | `/supabase-admin` | Todo BD: tablas, RLS, migraciones, queries, metricas. |
| `ai-sdk-kit` | `/ai-sdk-kit [bloque]` | Bloques IA con Vercel AI SDK v5 + OpenRouter. |
| `frontend-design` | `/frontend-design` | UI premium con shadcn/ui, dark mode, micro-interacciones. |
| `web-3d` | `/web-3d` | Landings scroll-driven con copy AIDA/PAS. |
| `image-kit` | `/image-kit` | Generar/editar imagenes con OpenRouter + Gemini. |
| `playwright-cli` | `/playwright-cli` | QA automatizado con Playwright CLI (MCP opcional). |
| `skill-creator` | `/skill-creator` | Crear nuevas skills siguiendo la Agent Skills Specification. |

---

## Skills multi-archivo

Las skills con mucho contenido usan `SKILL.md` orquestador + subcarpetas con archivos cargados bajo demanda (progressive disclosure):

- **`brief`**: `SKILL.md` + `catalog.md` (28 tipos de proyecto, con TOC) + `stacks/` (30 recetas con decisiones KEEP/ADD/REPLACE/REMOVE/CONFIG) + `playbooks/` (30 playbooks de investigacion 1:1 con stacks) + `references/templates.md` (plantillas master/single) + `references/examples.md` (2 briefs ejemplo) + `evals/evals.json`.
- **`prp`**: `SKILL.md` + `references/prp-template.md` (fuente de verdad del template, fallback en `.claude/PRPs/prp-base.md`) + `references/examples.md` (2 PRPs ejemplo) + `evals/evals.json`.
- **`bucle-agentico`**: `SKILL.md` (doctrina + flujo PASO 0-5 cohesivo) + `references/anti-patterns.md` (3 anti-patrones del bucle por fases) + `references/examples.md` (caso completo de ciclo) + `evals/evals.json`.
- **`ai-sdk-kit`**: `SKILL.md` + `references/` con bloques por caso de uso (chat, RAG, vision, tools, etc.).
- **`frontend-design`**: `SKILL.md` + `references/` + guias separadas por categoria (animations, component-patterns, layout-patterns, etc.).

La extension inyecta/elimina la carpeta completa al activar/desactivar una skill.

---

## Anatomia de una skill

```
skill-name/
|-- SKILL.md              # Obligatorio: frontmatter YAML + instrucciones
|-- scripts/              # Opcional: codigo ejecutable (.py, .sh, .js)
|-- references/           # Opcional: docs de referencia largos
`-- assets/               # Opcional: templates, imagenes, fonts
```

### Frontmatter minimo

```yaml
---
name: skill-name
description: "Que hace. Cuando activar. Que NO cubre."
---
```

Campos extendidos: `allowed-tools`, `context`, `model`, `agent`, `user-invocable`, `disable-model-invocation`, `argument-hint`.

### Progressive disclosure (recomendado por Anthropic)

1. **Discovery** (~100 palabras): frontmatter — Claude decide si activarla.
2. **Body** (<5k palabras): `SKILL.md` — se lee al activarla.
3. **References** (sin limite): archivos en `scripts/`, `references/`, `assets/` — se abren bajo demanda.

### Variables de sustitucion

| Variable | Rol |
|----------|-----|
| `$ARGUMENTS` | Todos los argumentos del usuario |
| `$ARGUMENTS[N]` o `$N` | Argumento por indice (0-based) |
| `${CLAUDE_SESSION_ID}` | ID de sesion actual |
| `${CLAUDE_SKILL_DIR}` | Directorio del skill |
| `` !`comando` `` | Inyeccion de contexto dinamico (ejecuta shell) |

---

## Recursos compartidos

| Recurso | Path | Usado por |
|---------|------|-----------|
| STYLE-GUIDE foundational | `.claude/skills/STYLE-GUIDE.md` | Todas las skills (contrato Skills 2.0) |
| PRP template (canonico) | `.claude/skills/prp/references/prp-template.md` | `prp` |
| PRP template (fallback compat) | `.claude/PRPs/prp-base.md` | PRPs historicos que lo referencian directo |
| Bloques AI SDK | `.claude/skills/ai-sdk-kit/references/` | `ai-sdk-kit` |
| Design systems | `.claude/design-systems/` | `frontend-design`, `web-3d` |

---

## Crear una skill nueva

```bash
/skill-creator
```

Checklist manual:

- [ ] `SKILL.md` con frontmatter válido (`name` + `description`).
- [ ] Body en forma imperativa, < 5 000 palabras.
- [ ] Scripts (si hay) con `--help` y manejo de errores.
- [ ] References (si hay) para material largo o lazy-load.
- [ ] Triggers del usuario mencionados en `description`.

<!-- px:63243dd685c4144b -->
