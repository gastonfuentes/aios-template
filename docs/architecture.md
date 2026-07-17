# Arquitectura — chassis del template AIOS

> **TL;DR**: 4 piezas distribuidas (MC PWA + daemon agent-server + Supabase + tunneling opcional) + adapter LLM cross-provider que abstrae los 3 providers oficiales. Diseñado para single-operator con superficie pequeña y mantenibilidad alta.

---

## Vista general

```
┌─────────────────────────────────────────────────────────────────┐
│                        Operador (tú)                            │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │ MC PWA   │    │ Telegram │    │  CLI     │    │  Voice   │   │
│  │ desktop  │    │   bot    │    │ Claude   │    │  notas   │   │
│  │ + mobile │    │          │    │  Code    │    │          │   │
│  └─────┬────┘    └─────┬────┘    └─────┬────┘    └─────┬────┘   │
└────────┼───────────────┼───────────────┼───────────────┼────────┘
         │               │               │               │
         │ HTTPS         │ Long-poll     │ Direct cwd    │ HTTPS
         │ SSE           │ grammY        │ session       │ multipart
         │               │               │               │
         ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Daemon agent-server (Node 20)                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Adapter LLM cross-provider                             │    │
│  │  ├─ claude-code-sdk (Claude Code CLI)                   │    │
│  │  ├─ anthropic-api  (API directa)                        │    │
│  │  └─ openrouter     (300+ modelos)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Scheduler   │  │  Voice STT/  │  │  Always-push         │   │
│  │  cron jobs   │  │  TTS Groq +  │  │  receiver pattern    │   │
│  │  (SQLite)    │  │  ElevenLabs  │  │  (webhook MC)        │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS (Supabase JS client)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase Cloud                           │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐   │
│  │   Auth          │  │   DB Postgres   │  │  Storage       │   │
│  │   magic-link    │  │   26 tablas     │  │  bucket priv.  │   │
│  │   ALLOWED_EMAILS│  │   RLS owner-only│  │  per-folder uid│   │
│  └─────────────────┘  └─────────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Capas del stack

### 1. Mission Control PWA (`mission-control/`)

**Stack**: Next.js 16 + React 19 + TypeScript strict + Tailwind 3.4 + design system macOS 26 (Liquid Glass + SF Pro) + Vercel AI Elements + Streamdown.

**Responsabilidades**:
- Auth gate magic-link Supabase SSR.
- Chat productivo con branching/reasoning/tools/sources/regenerate.
- Scheduled tasks UI + CRUD.
- Draw whiteboard (Excalidraw embebido).
- Ops events stream SSE en vivo.
- Search federado cross-source (7 fuentes con `Promise.allSettled`).
- Notifications PWA push (web-push + service worker).
- Settings consolidado.

**Routes principales**:
- `/(public)/login` + `/check-email` — auth flow.
- `/(app)/dashboard` — placeholder operador.
- `/(app)/ai-agent` — chat productivo.
- `/(app)/scheduled` — cron jobs UI.
- `/(app)/ops` — events stream.
- `/(app)/draw` + `/draw/[id]` — whiteboards.
- `/(app)/settings` — preferences.
- `/api/chat/*` — proxy routes al daemon + always-push receiver.
- `/api/notifications/*` — push subscriptions + notification list.

---

### 2. Daemon agent-server (`agent-server/`)

**Stack**: Node 20 + TypeScript + better-sqlite3 + grammY + pino + adapter LLM cross-provider.

**Responsabilidades**:
- HTTP server con ~15 endpoints (`/chat/stream`, `/embed`, `/recall`, `/schedule/*`, `/open-url`, `/healthz`, etc.).
- Scheduler cron poller (60s tick) con claim race-safe sobre SQLite + reuse session por semana ISO.
- Telegram bot grammY long-polling con `ALLOWED_CHAT_ID` guard (single-chat).
- Voice STT (Groq Whisper-large-v3) + TTS (ElevenLabs Flash v2.5).
- Always-push receiver pattern: emite webhooks fire-and-forget al MC backend tras query completions.
- Adapter LLM cross-provider: 3 implementaciones con contract común `query()`.
- Memoria semántica indexada via pgvector (cuando OpenAI key sembrada).
- Ops logger writer → tabla `ops_events` Supabase.

---

### 3. Supabase Cloud

**26 tablas**: 20 operacionales (chat_sessions, chat_messages, scheduled_tasks, ops_events, draw_canvases, notifications, push_subscriptions, profiles, etc.) + 5 BI opcionales (funnel_events, community_metrics, youtube_metrics, revenue_snapshot, agencia_pipeline) + 1 memoria semántica (`agent_memories` renombrable).

**RLS owner-only**: helper `is_owner()` clase B (`SECURITY DEFINER` + `GRANT EXECUTE authenticated`) + política `owner_full_access FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner())`.

**Storage**: bucket privado con per-folder uid check (`(storage.foldername(name))[1] = auth.uid()::text`).

**4 RPCs canónicas**: `match_agent_memories`, `touch_agent_memory`, `decay_agent_memories`, `compact_agent_memories` (memoria semántica).

---

### 4. Tunneling (opcional)

**3 providers oficiales**: Cloudflare Tunnel / Tailscale Funnel / ngrok. Ver [setup/tunneling/README.md](../setup/tunneling/README.md) para decisión.

**Cuándo necesario**: cuadrantes `local-tunnel` + `vps-linux` con dominio. Cuadrante `local-only` no requiere; `pwa-only-cloud` lo evita 100%.

---

## Flow de datos: ejemplo chat

1. Operador escribe mensaje en MC PWA (`/ai-agent`).
2. MC `POST /api/chat/stream` (proxy Node runtime) → daemon `POST /chat/stream` con bearer.
3. Daemon valida bearer + invoca `adapter.query()` cross-provider.
4. Provider responde streaming (SSE: thinking_delta, text_delta, tool_input, tool_output).
5. Daemon traduce a SSE custom + pipea al MC.
6. MC `useMarleyChat` hook consume el SSE y renderea progressivo.
7. Al `[DONE]`, daemon `POST` fire-and-forget al webhook MC `/api/chat/complete` con payload final.
8. MC receiver valida bearer + INSERT bi-row `chat_messages` (user + assistant) via service-role bypass RLS.
9. Sesiones cross-superficie: el mismo `chat_session_id` está accesible desde CLI / Telegram / MC.

---

## Trade-offs explícitos

- **Single-operator deliberadamente**: cero multi-tenant, cero billing, RLS owner-only — minimiza surface y mantenimiento.
- **No queue-based scheduler**: cron poller SQLite cada 60s es suficiente single-operator; agregar Redis/Celery sería over-engineering.
- **Webhooks fire-and-forget**: el receiver MC es idempotente (dedup-check) y la pérdida ocasional es aceptable; el daemon NO retry-loops complicados.
- **Adapter LLM unified contract**: cambiar provider = cambiar env var, cero refactor. Trade-off: features provider-specific (Memory Tool nativo SDK) solo viven en `claude-code-sdk` branch.
