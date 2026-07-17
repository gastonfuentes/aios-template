# Changelog

Todos los cambios notables del template AIOS quedan documentados aquí. Formato basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + versionado [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Pendiente

- Validación E2E cronometrada (<5 min hasta MC vivo en localhost) con alumno fresh externo.
- Distribución a beta-testers (link copy-paste-ready al repo privado).
- v0.2.0 — feedback de beta-testers + iteración del flujo de entrevista.

---

## [0.1.0] — 2026-05-18

### Added

- **Chassis universal Mission Control PWA**: Next.js 16.2.6 + React 19.2.4 + Tailwind 3.4 + design system macOS 26 (Liquid Glass + SF Pro) + AI Elements Vercel vendored + chat productivo con streaming/branching/reasoning/tools/sources + scheduled jobs CRUD + Excalidraw whiteboards + ops stream SSE + search federado + PWA push notifications.
- **Daemon agent-server**: Node 20+ + Claude Agent SDK 0.2.128 (pin exact) + adapter LLM cross-provider (3 implementaciones: claude-code-sdk, anthropic-api, openrouter) + scheduler de crons + Telegram bot grammY opcional + voice STT/TTS opcional (Groq Whisper + ElevenLabs) + memoria semántica pgvector + always-push receiver pattern + multipart parser zero-dep. **190 tests verdes baseline**.
- **Supabase schema canónico portable**: `supabase/migrations/<timestamp>__aios_schema_canonical.sql` con 23 tablas core MC + extension vector en schema extensions + helper `is_owner()` SECURITY DEFINER clase B + RLS owner-only via DO $$ loop dinámico aplicado a todas las tablas + storage bucket `chat_attachments` con 4 policies per-folder uid check + 6 RPCs canónicas (`is_owner`, `handle_new_user`, `match_agent_memories`, `touch_agent_memory`, `decay_agent_memories`, `compact_agent_memories`). Adapter env-driven via `MEMORY_TABLE_PREFIX` (default `agent`).
- **`CLAUDE.md` interview-driven**: instruye al agente Claude Code a leer `BOOT.md` al primer turn, ejecutar la entrevista de `INTERVIEW.md`, mapear con `MATRIX.md`, y aplicar los scripts de `setup/` hasta dejar el MC vivo en ≤ 20 min cross-OS (macOS / Linux / Windows-WSL2). Doctrina recursiva Praxis canónica + Trust Stack + 18 skills activas + router de skills.
- **`BOOT.md` + `INTERVIEW.md` + `MATRIX.md`**: contrato de ejecución del agente initializer + cuestionario estructurado 7-8 preguntas + matriz decisión cuadrante → scripts.
- **`setup/` scripts modulares cross-OS**: 13 scripts (`install-deps-{macos,linux,windows-wsl2}.sh`, `seed-supabase.sh`, `generate-vapid.sh`, `install-service-manager.sh`, `start-daemon-local.sh`, `start-cloudflare-tunnel.sh`, `start-ngrok-tunnel.sh`, `start-tailscale-funnel.sh`, `smoke-test.sh`, `deploy-vercel.sh`, `cleanup.sh`) + templates de service managers (launchd macOS + systemd Linux).
- **18 skills agnósticas activas en `.claude/skills/`**: las 11 Praxis universales (brief, prp, bucle-agentico, build-with-agent-team, frontend-design, playwright-cli, skill-creator, auth-stack, ai-sdk-kit, pwa-mobile, image-kit) + las 3 Praxis hereditarias del template (excalidraw-diagram, google-workspace, macos-26-design) + las 3 reescritas canónicas del template (operator-context, supabase-bi, recall) + memory-manager.
- **6 skills hand-tailored en `examples/skills/`**: aios-supabase, content-pipeline, funnel-tracking, image-generation, juan-business-context, sinergia-ops. No-cargadas por default — referencia inspiracional para skills custom del operador.
- **Sistema de memoria de 3 capas**: operador curada `.claude/memory/*.md` (versionada en Git, opt-in vía `memory-manager` skill) + activa nativa SDK `.claude/agent-memory/<agent>/*.md` (escrita por el agente cuando el operador dice "recuerda") + semántica indexada Supabase `agent_memories` (pgvector + RPCs canónicas, retrieval por significado vía `recall` skill).
- **5 docs en `docs/`**: architecture, customization, doctrine, manual-setup, troubleshooting.
- **2 docs nuevos**: `SKILLS-CATALOG.md` (catálogo 18 skills activas + 6 examples) + `DEPLOY-LOCAL.md` (path canónico local + Cloudflare Tunnel cross-OS).
- **`examples/PRPs/`**: 6 PRPs reales curados como casos de estudio pedagógicos.
- **`examples/bi-tables/` + `examples/scheduled-jobs/`**: migraciones BI ejemplo + cron jobs ejemplo (descomentables).
- **Adapter LLM cross-provider documentado** en `setup/llm-providers/`: Claude Code SDK + Anthropic API + OpenRouter.
- **`.gitignore` canónico Praxis**: incluye `*.mcp.json` con excepción `!example.mcp.json` + `.env*` excepto `.env.example` + identity files materializados gitignored (los `.template` SÍ versionados).
- **`BRIEF-TEMPLATE.md`**: plantilla canónica del brief master para que el operador arranque su primer proyecto.
- **`CLAUDE.md` con doctrina Praxis canónica completa** + sección "Aprendizajes acumulados" vacía para que el operador la pueble.

### Compatibility

- **OS soportados**: macOS (Apple Silicon + Intel) / Linux (Ubuntu, Debian, Arch) / Windows 11 + WSL2.
- **Node**: 20+ obligatorio.
- **Cuentas externas opcionales**: Supabase (Free Tier basta), Anthropic / OpenAI / OpenRouter, Cloudflare, Telegram BotFather, Groq, ElevenLabs, Vercel, Resend.
- **Hardware**: laptop, mini-PC always-on, o VPS Linux.

### Security

- RLS owner-only por default en todas las tablas Supabase via `is_owner()` clase B.
- Bearer `OPENCLAW_GATEWAY_TOKEN` validado con `crypto.timingSafeEqual` server-to-server.
- CORS multi-origin echo-back exact + `Vary: Origin`.
- Storage bucket privado con per-folder uid check defense-in-depth.
- `.mcp.json` con tokens reales gitignored canónicamente.
- VAPID keys generadas con `npx web-push generate-vapid-keys`, sembradas byte-exact en ambos `.env`.

### Known Limitations

- Validación E2E cronometrada con alumno fresh externo queda PENDIENTE-OPERADOR (requiere acción humana fuera del scope del bootstrap automatizado).
- Multi-tenant NO soportado — el template es single-operator por design.
- i18n: español + inglés mixto. Otras lenguas quedan para v0.x.

---

[Unreleased]: https://github.com/juanlara-aidev/aios-template/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/juanlara-aidev/aios-template/releases/tag/v0.1.0
