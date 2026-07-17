# Catálogo de Skills del Template AIOS

> **18 skills activas en `.claude/skills/`** que el agente principal carga automáticamente vía el frontmatter `memory: project`. **6 skills hand-tailored en `examples/skills/`** como referencia inspiracional, no-cargadas por default.

Cada skill cumple el [STYLE-GUIDE de skills Praxis](.claude/skills/STYLE-GUIDE.md) (Skills 2.0 spec de Anthropic + frontmatter validado + body imperativa + bundle canónico references/scripts/assets).

---

## Skills Praxis universales (11)

Skills core del framework Praxis. Funcionan en CUALQUIER proyecto Praxis-compatible.

| # | Skill | Cuándo activarla |
|---|-------|------------------|
| 1 | [`brief`](.claude/skills/brief/SKILL.md) | "Necesito un brief", "quiero articular una idea", "quiero construir X" |
| 2 | [`prp`](.claude/skills/prp/SKILL.md) | "Planea esto", "dame un PRP", "blueprint para X" |
| 3 | [`bucle-agentico`](.claude/skills/bucle-agentico/SKILL.md) | El operador presiona ⚡ Run sobre un PRP aprobado |
| 4 | [`build-with-agent-team`](.claude/skills/build-with-agent-team/SKILL.md) | "Orquesta agentes en paralelo", "equipo de IA", "multi-agent" |
| 5 | [`frontend-design`](.claude/skills/frontend-design/SKILL.md) | "Construir UI", "dashboard", "landing", "que se vea premium" |
| 6 | [`playwright-cli`](.claude/skills/playwright-cli/SKILL.md) | "Testea esto", "validar el flujo", "e2e", "regression visual" |
| 7 | [`skill-creator`](.claude/skills/skill-creator/SKILL.md) | "Crear nueva skill", "agregar capacidad al agente" |
| 8 | [`auth-stack`](.claude/skills/auth-stack/SKILL.md) | "Login", "magic-link", "autenticación", "proteger rutas" |
| 9 | [`ai-sdk-kit`](.claude/skills/ai-sdk-kit/SKILL.md) | "Chatbot", "agente que busca", "RAG", "agregar IA" |
| 10 | [`pwa-mobile`](.claude/skills/pwa-mobile/SKILL.md) | "PWA", "notificaciones push", "instalar en celular" |
| 11 | [`image-kit`](.claude/skills/image-kit/SKILL.md) | "Generar imagen", "thumbnail", "banner", "logo" |

## Skills Praxis hereditarias del template (3)

Heredadas del template original, agnósticas y útiles cross-proyecto.

| # | Skill | Cuándo activarla |
|---|-------|------------------|
| 12 | [`excalidraw-diagram`](.claude/skills/excalidraw-diagram/SKILL.md) | "Diagrama", "flowchart", "arquitectura visual", "process map" |
| 13 | [`google-workspace`](.claude/skills/google-workspace/SKILL.md) | "Email", "calendar", "agendar evento", "archivar inbox" |
| 14 | [`macos-26-design`](.claude/skills/macos-26-design/SKILL.md) | "Look macOS", "Liquid Glass", "sidebar Finder", "app nativa Mac" |

## Skills canónicas del template (3 reescritas)

Originales hand-tailored del template, reescritas como canónicas agnósticas en este release.

| # | Skill | Cuándo activarla |
|---|-------|------------------|
| 15 | [`memory-manager`](.claude/skills/memory-manager/SKILL.md) | "Recuerda", "qué sabes de", "guarda esto", "en qué quedamos" |
| 16 | [`recall`](.claude/skills/recall/SKILL.md) | Pregunta semántica sobre dato concreto del operador |
| 17 | [`operator-context`](.claude/skills/operator-context/SKILL.md) | "Quién soy", "mi negocio", "mi stack", "dame contexto" |
| 18 | [`supabase-bi`](.claude/skills/supabase-bi/SKILL.md) | "Métricas", "snapshot Supabase", "audit RLS", "queries operacionales" |

---

## Skills hand-tailored de referencia (6 en `examples/skills/`)

Estas skills NO se cargan por default. Son ejemplos del template original, curados como inspiración para que el operador construya las suyas siguiendo Skills 2.0.

| # | Skill | Caso de uso ejemplo |
|---|-------|---------------------|
| 1 | [`aios-supabase`](examples/skills/aios-supabase/) | Queries BI custom sobre tablas hand-tailored del operador original |
| 2 | [`content-pipeline`](examples/skills/content-pipeline/) | Backlog YouTube con stages (idea, scripting, recording, editing, scheduled, published) |
| 3 | [`funnel-tracking`](examples/skills/funnel-tracking/) | Funnel BI 7d/30d con drill-down por source y event_type |
| 4 | [`image-generation`](examples/skills/image-generation/) | Generación de imágenes vía OpenRouter + Gemini con upload a Supabase Storage |
| 5 | [`juan-business-context`](examples/skills/juan-business-context/) | Snapshot contexto del operador original (modelo de negocio + audiencias + stack) |
| 6 | [`sinergia-ops`](examples/skills/sinergia-ops/) | Operación de comunidad Skool con UPSERT a `community_metrics` |

**Activar una skill ejemplo**: el operador la mueve desde `examples/skills/<nombre>/` a `.claude/skills/<nombre>/` y el agente la detecta al siguiente reload. Las skills ejemplo pueden tener refs hand-tailored del operador original — adaptarlas al contexto propio es trabajo del operador (o invocar `skill-creator` para reescribirlas).

---

## Cómo se cargan

Las skills activas viven en `.claude/skills/<nombre>/` y se descubren automáticamente vía el frontmatter del subagente principal (`.claude/agents/agent.md` o el nombre que el operador eligió durante la entrevista). Cada `SKILL.md` declara:

```yaml
---
name: <skill-name>
description: "<frase de 1024 chars máx que describe WHEN + WHAT + 5-7 triggers>"
allowed-tools: Read, Bash, ...   # Tools que la skill puede invocar
effort: max | high | medium | low   # Opcional, default depende del SDK
---
```

El agente lee el `description` al iniciar y decide cuándo invocar cada skill basado en triggers semánticos en la conversación del operador.

---

## Crear tu propia skill

Usa la skill `skill-creator` para generar una nueva skill cumpliendo Skills 2.0:

```
Activación: "crea una nueva skill para X"
```

`skill-creator` lee el [STYLE-GUIDE.md](.claude/skills/STYLE-GUIDE.md) como contrato obligatorio, genera frontmatter validado, body imperativa < 500 líneas, bundle canónico (references/, scripts/, assets/), cross-references con skills hermanas, y registra la nueva skill en `.claude/skills/<nombre>/`.

Cualquier skill bien escrita puede luego promoverse de `examples/skills/` (referencia) a `.claude/skills/` (activa) según el operador lo necesite.

---

## Referencias

- [`SKILLS_README.md`](.claude/skills/SKILLS_README.md) — overview del framework de skills Praxis.
- [`STYLE-GUIDE.md`](.claude/skills/STYLE-GUIDE.md) — contrato obligatorio para crear nuevas skills.
- [Anthropic Skills 2.0 docs](https://docs.anthropic.com/en/docs/build-with-claude/agents-and-tools/skills) — spec oficial.
