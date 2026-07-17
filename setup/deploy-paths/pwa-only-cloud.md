# Deploy path — `pwa-only-cloud`

> **TL;DR**: 100% Vercel + Supabase. Cero daemon. MC funciona como dashboard + chat directo al provider LLM via Vercel AI SDK route. Pierdes crons 24/7, Telegram, voice, always-push. Ganas cero infra para mantener. Setup ≤5 min.

---

## Cuándo elegirlo

✓ No quieres mantener nada always-on (ni laptop, ni VPS).
✓ Solo necesitas MC PWA como dashboard + chat.
✓ Aceptas perder crons 24/7 y Telegram bot.
✓ Setup ultra-rápido para validación de concepto.

✗ Necesitas Telegram bot → usa [local-tunnel](local-tunnel.md) o [vps-linux](vps-linux.md).
✗ Necesitas crons que corran sin tu intervención → daemon requerido.
✗ Voice STT/TTS → daemon requerido.

---

## Capabilities (recap de MATRIX.md)

| Capability | Estado |
|---|:-:|
| MC PWA + chat | ✓ (chat directo al provider LLM via Vercel AI SDK route) |
| Auth magic-link | ✓ |
| Scheduled tasks UI | ⚠ readonly (no execution) |
| Draw whiteboard | ✓ |
| Ops events stream | ⚠ static (no SSE en vivo) |
| Search federado | ⚠ Supabase only (no daemon endpoints) |
| Notifications PWA push | ✓ |
| Crons 24/7 | ✗ |
| Telegram bot | ✗ |
| Voice STT/TTS | ✗ |
| Memory Tool nativo SDK | ✗ |
| Memoria semántica indexada | ✗ |
| Always-push receiver | ✗ |
| Acceso móvil | ✓ |

---

## Arquitectura

```
                ┌──────────────────┐
                │  Vercel (PWA MC) │
                │  mc.dominio.com  │
                │                  │
                │  Chat directo via│
                │  Vercel AI SDK   │
                │  → Provider LLM  │
                └────────┬─────────┘
                         │
                         ▼
              ┌────────────────────┐
              │  Supabase Cloud    │
              │  (auth + DB + RLS) │
              └────────────────────┘
```

Sin daemon, el MC consume el LLM provider directamente desde rutas serverless de Vercel (`/api/chat`). Pierde features que el daemon proveía (crons, Telegram, voice, etc.) pero gana cero infra.

---

## Pasos resumidos

```bash
# 1. Install deps (solo para build local)
bash setup/scripts/install-deps-macos.sh

# 2. Seed Supabase (migrations subset PWA-only — sin tablas daemon-specific)
bash setup/scripts/seed-supabase.sh --pwa-only

# 3. Generate VAPID keys (opcional, push notifications PWA siguen funcionando)
bash setup/scripts/generate-vapid.sh

# 4. Deploy a Vercel
bash setup/scripts/deploy-vercel.sh

# 5. Smoke test
bash setup/scripts/smoke-test.sh
```

---

## Env vars críticas (todas en Vercel project, NO local)

```bash
# Vercel project env vars
LLM_PROVIDER=<openrouter | anthropic-api>  # claude-code-sdk NO funciona sin daemon
OPENROUTER_API_KEY=sk-or-...               # o ANTHROPIC_API_KEY

NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # para server actions

ALLOWED_EMAILS=<tu-email>@gmail.com

NEXT_PUBLIC_VAPID_PUBLIC_KEY=<de generate-vapid.sh>
VAPID_PRIVATE_KEY=<de generate-vapid.sh>
VAPID_SUBJECT=mailto:<tu-email>
```

---

## Migración a daemon en el futuro

Si decides agregar daemon más adelante (para crons, Telegram, voice), no perderás data:

1. Aprovisiona laptop con tunnel o VPS Linux.
2. Copia env vars del Vercel project al `agent-server/.env` nuevo.
3. Migra a cuadrante `local-tunnel` o `vps-linux`.

La data en Supabase (chats, settings, notifications, draw canvases) persiste sin migración. El operador solo agrega capabilities sin migrar nada.

---

## Costos típicos

| Componente | Costo |
|---|---|
| Vercel Hobby plan | $0 (suficiente single-operator) |
| Supabase Free tier | $0 (hasta 500 MB DB + 1 GB file storage) |
| LLM provider | $5-30/mes según uso (OpenRouter pay-per-token o Anthropic API) |
| **Total** | **$5-30/mes** |
