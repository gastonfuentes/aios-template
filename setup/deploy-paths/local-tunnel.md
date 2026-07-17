# Deploy path — `local-tunnel`

> **TL;DR**: Laptop + tunnel (Cloudflare / Tailscale / ngrok). MC y daemon accesibles desde móvil y cualquier red. Crons 24/7 mientras la laptop esté encendida. Setup ≤15 min. Costo $0-10/mes.

---

## Cuándo elegirlo

✓ Quieres acceder al MC desde iPhone/Android cuando salgas.
✓ Quieres Telegram bot real con webhook persistente.
✓ Crons 24/7 con laptop encendida es aceptable (no necesitas always-on cuando laptop apagada).
✓ Es tu setup preferido antes de migrar a VPS.

✗ Necesitas always-on con laptop apagada → usa [vps-linux](vps-linux.md).
✗ No quieres nada infra-related → usa [pwa-only-cloud](pwa-only-cloud.md).

---

## Capabilities (recap de MATRIX.md)

| Capability | Estado |
|---|:-:|
| MC PWA + chat (desktop + mobile) | ✓ |
| Auth magic-link | ✓ |
| Scheduled tasks 24/7 | ⚠ si laptop encendida |
| Draw whiteboard | ✓ |
| Ops events stream | ✓ |
| Notifications PWA push | ✓ |
| Telegram bot | ✓ |
| Voice STT/TTS | ✓ |
| Always-push receiver | ✓ |
| Memory Tool nativo (si Claude Code CLI) | ✓ |
| Memoria semántica indexada | ✓ con OpenAI key |
| Acceso móvil | ✓ |

---

## Cuál tunneling elegir

| Opción | Costo | Dominio propio | URL estable | Voto |
|---|---|---|---|---|
| **Cloudflare Tunnel** | Gratis | Requerido | ✓ | Voto template para production seria con dominio |
| **Tailscale Funnel** | Gratis (< 100 devices) | No requerido | ✓ MagicDNS | Voto template sin dominio (sweet spot) |
| **ngrok paid** | $8/mes | Custom domain opcional | ✓ | Solo si quieres ngrok ecosystem |
| **ngrok free** | Gratis | No | ⚠ URL random | Solo demos descartables |

Docs por provider: [cloudflare](../tunneling/cloudflare.md) / [tailscale](../tunneling/tailscale.md) / [ngrok](../tunneling/ngrok.md).

---

## Pasos resumidos

```bash
# 1. Install deps según OS
bash setup/scripts/install-deps-macos.sh

# 2. Seed Supabase
bash setup/scripts/seed-supabase.sh

# 3. Generate VAPID keys
bash setup/scripts/generate-vapid.sh

# 4. Start tunnel según elección
bash setup/scripts/start-cloudflare-tunnel.sh    # o tailscale-funnel.sh / ngrok-tunnel.sh

# 5. Install service manager (launchd/systemd) para persistencia cross-restart
bash setup/scripts/install-service-manager.sh

# 6. Smoke test end-to-end
bash setup/scripts/smoke-test.sh

# Opcional: deploy MC PWA a Vercel
bash setup/scripts/deploy-vercel.sh
```

---

## Env vars críticas

Todo lo de `local-only` +:

```bash
# agent-server/.env
MC_BASE_URL=https://<tunnel-domain>           # según provider
MISSION_CONTROL_ORIGIN=https://<mc-domain>,http://localhost:3000

# mission-control/.env.local
AGENT_URL=https://<tunnel-domain>
```

---

## Telegram bot setup

Si elegiste opt-in para Telegram + voice durante la entrevista:

```bash
# agent-server/.env
TELEGRAM_BOT_TOKEN=<bot-token-de-@BotFather>
ALLOWED_CHAT_ID=<tu-chat-id-from-userinfobot>
GROQ_API_KEY=<groq.com>           # voice STT Whisper-large-v3
ELEVENLABS_API_KEY=<elevenlabs.io> # voice TTS Flash v2.5
```

El daemon arranca fail-soft sin estas keys (log WARN, daemon vivo). Las llenas después si las olvidaste durante setup.

---

## Operación diaria

```bash
# El daemon corre via service manager (launchd/systemd) — arranca al login automáticamente.
# Para verificar status:
launchctl print gui/$UID/com.<agent>.agent     # macOS
systemctl --user status <agent>-agent          # Linux

# Logs
tail -f ~/Library/Logs/<agent>/agent.log

# Dev server MC manual cuando trabajas
cd mission-control && npm run dev
```
