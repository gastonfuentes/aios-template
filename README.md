# AIOS Template

> Mission Control single-operator agent-driven. Clona, abre tu agente favorito, déjalo entrevistarte sobre tu cuadrante de deploy, y ten tu MC vivo en menos de 20 minutos sin tipear comandos shell.

Construido sobre **Next.js 16 + React 19 + Supabase + daemon Node 20 + design system macOS 26** con adapter LLM cross-provider (Claude Code CLI / Anthropic API / OpenRouter) y prompt maestro `BOOT.md` que cualquier agente Praxis-compatible (Claude Code, Codex CLI, Aider, Cursor agent mode) consume para guiarte en el deploy.

---

## Quick start (3 minutos hasta dispararle al agente)

**1. Clona el template (acceso al repo privado vía `gh auth login`):**

```bash
gh repo clone juanlara-aidev/aios-template my-mission-control
cd my-mission-control
```

O con `git clone` directo si tienes SSH key configurada en GitHub:

```bash
git clone https://github.com/juanlara-aidev/aios-template.git my-mission-control
cd my-mission-control
```

**2. Opcional pero recomendado — desvincula el remote del template para que tus commits no vayan al original:**

```bash
git remote remove origin
gh repo create my-mission-control --private --source=. --push  # crea TU repo privado y pushea
```

**3. Abre tu agente favorito en el directorio:**

```bash
# Claude Code CLI (recomendado si tienes Max plan)
claude

# o Codex CLI
codex

# o Aider, Cursor, Windsurf, cualquier agente MCP-compliant
```

**4. Dile al agente:**

> Lee `BOOT.md` y arráncame esto.

El agente te entrevistará en 7-8 preguntas (qué proveedor LLM tienes a la mano, dónde quieres correr tu MC, qué tunneling usar si quieres mobile, etc.) y ejecutará los scripts correctos del template hasta dejarte el MC vivo con tu sesión propia.

---

## Cuadrantes de deploy oficialmente soportados

| Cuadrante | Mobile | Crons 24/7 | Voice STT/TTS | Telegram | Setup time | Costo infra |
|---|---|---|---|---|---|---|
| **Local-only** (laptop sin tunnel) | ❌ | ✅ si laptop encendida | ⚠ con keys | ⚠ con keys | ~5 min | $0 |
| **Local + Tunnel** (Cloudflare / Tailscale / ngrok) | ✅ | ✅ si laptop encendida | ✅ | ✅ | ~15 min | $0-10/mes |
| **VPS Linux** (Hetzner, Contabo, DigitalOcean) | ✅ | ✅ 24/7 | ✅ | ✅ | ~30 min | $5-20/mes |
| **PWA-only Cloud** (Vercel + Supabase, sin daemon) | ✅ | ❌ | ❌ | ❌ | ~5 min | $0-20/mes |

El agente del alumno detecta tu OS (macOS / Linux / Windows-WSL2), inventaria qué tienes instalado, y elige el path óptimo. Si tienes Claude Max plan + dominio en Cloudflare, sugiere local-tunnel-cloudflare. Si quieres cero infra, sugiere pwa-only-cloud.

---

## Stack distribuido

- **Mission Control PWA**: Next.js 16 + React 19 + Tailwind 3.4 + design system macOS 26 (Liquid Glass + SF Pro) + AI Elements de Vercel + chat productivo con branching/reasoning/tools/sources + scheduled + draw whiteboard + ops stream SSE + search federado + notifications PWA push.
- **Daemon agent-server**: Node 20 + adapter LLM cross-provider (3 implementaciones) + scheduler de crons + opcional Telegram bot grammY + opcional voice STT/TTS (Groq Whisper + ElevenLabs) + memoria semántica pgvector + always-push receiver pattern.
- **Supabase Cloud**: 26 tablas + RLS owner-only via helper `is_owner()` clase B + 4 RPCs canónicas para memoria semántica + storage bucket privado con per-folder uid check.

---

## Doctrina Praxis recursiva

El template hereda la doctrina canónica **brief → PRP → bucle-agentico** que cualquier feature compleja sigue:

1. Articulas la idea con la skill `brief` → genera `BRIEF[-MASTER]-{tema}.md` con Directiva de Stack.
2. Pides plan con la skill `prp` → genera `PRP-XXX-{feature}.md` con sub-fases por nombre.
3. Apruebas el plan presionando ⚡ Run → la skill `bucle-agentico` ejecuta sub-fases con mapeo de contexto fresco antes de cada una + auto-refuerzo cuando algo falla.

Las 18 skills universales viven en `.claude/skills/` y se cargan automáticamente. Adicionalmente 6 skills hand-tailored viven en `examples/skills/` como referencia inspiracional. Lee [docs/doctrine.md](docs/doctrine.md) para la doctrina completa y [docs/SKILLS-CATALOG.md](docs/SKILLS-CATALOG.md) para el catálogo de skills activas.

---

## Customización post-deploy

- **Identidad de tu agente**: edita `.claude/identity/SOUL.md` + `USER.md` + `HEARTBEAT.md` (rellenados por el agente durante el setup). Cambia el nombre de tu agente, tu perfil, tus cron jobs.
- **Branding**: reemplaza `mission-control/public/brand-mark-source.png` con tu logo y corre `npm run icons:generate` en `mission-control/`. Pipeline canónico macOS 26 squircle clip.
- **Wallpapers**: reemplaza `mission-control/public/wallpaper-aurora.png` con tu wallpaper preferido (sugerido 1920×1080+ con feel de tu marca).
- **Skills custom**: copia desde `examples/skills/` las que te sirvan como inspiración o usa la skill `skill-creator` para escribir las tuyas siguiendo Skills 2.0 de Anthropic.
- **Tablas BI**: si tu negocio necesita métricas custom (funnel, comunidad, revenue, pipeline), copia migraciones desde `examples/bi-tables/` a `supabase/migrations/` y aplícalas.
- **PRPs de referencia**: `examples/PRPs/` tiene 5-6 PRPs reales curados como casos de estudio pedagógicos (cómo se construyeron features complejas del MC).

---

## Licencia

MIT. Eres libre de usar, modificar, distribuir, y vender forks de este template para tus propios clientes sin restricción.
