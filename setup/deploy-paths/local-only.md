# Deploy path — `local-only`

> **TL;DR**: Laptop sin tunnel. MC accesible solo en `localhost:3000`. Daemon en `localhost:3099`. Cero exposición pública. Setup ≤5 min. Costo $0.

---

## Cuándo elegirlo

✓ Laptop personal sin necesidad de acceso móvil.
✓ Quieres cero superficie de ataque.
✓ Aprendizaje inicial del template.
✓ Trabajos sensibles que NO deben salir de tu máquina.

✗ Necesitas Telegram bot — requiere webhook público.
✗ Quieres acceso desde iPhone/Android.
✗ Crons 24/7 con laptop apagada → usa [vps-linux](vps-linux.md).

---

## Capabilities (recap de MATRIX.md)

| Capability | Estado |
|---|:-:|
| MC PWA + chat | ✓ |
| Auth magic-link | ✓ |
| Scheduled tasks UI | ✓ |
| Draw whiteboard | ✓ |
| Ops events stream | ✓ |
| Notifications PWA push | ✓ |
| Crons 24/7 | ⚠ solo con laptop encendida |
| Telegram bot | ⚠ con keys + tunneling temporal (ngrok ad-hoc) |
| Voice STT/TTS | ⚠ con keys |
| Acceso móvil | ✗ |

---

## Pasos resumidos

El agente del template ejecuta automáticamente:

```bash
# 1. Install deps según OS
bash setup/scripts/install-deps-macos.sh           # o install-deps-linux.sh / install-deps-windows-wsl2.sh

# 2. Seed Supabase (migrations + opcional seed-demo)
bash setup/scripts/seed-supabase.sh

# 3. Generate VAPID keys (para PWA push)
bash setup/scripts/generate-vapid.sh

# 4. Start daemon background
bash setup/scripts/start-daemon-local.sh

# 5. Smoke test
bash setup/scripts/smoke-test.sh
```

---

## Env vars críticas

```bash
# agent-server/.env
LLM_PROVIDER=<claude-code-sdk | anthropic-api | openrouter>
# + provider key correspondiente

SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

ALLOWED_EMAILS=<tu-email>@gmail.com
MC_BASE_URL=http://localhost:3000
MISSION_CONTROL_ORIGIN=http://localhost:3000

PORT=3099
```

```bash
# mission-control/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

AGENT_URL=http://localhost:3099
OPENCLAW_GATEWAY_TOKEN=<token-shared-con-daemon>

NEXT_PUBLIC_VAPID_PUBLIC_KEY=<de generate-vapid.sh>
VAPID_PRIVATE_KEY=<de generate-vapid.sh>
VAPID_SUBJECT=mailto:<tu-email>
```

---

## Operación diaria

```bash
# Arrancar dev server MC (terminal 1)
cd mission-control && npm run dev

# Daemon ya corre en background (lanzado por start-daemon-local.sh).
# Para ver logs:
tail -f ~/Library/Logs/<agent>/agent.log     # macOS
tail -f ~/.local/share/aios/daemon.log       # Linux

# Stop limpio del daemon
bash setup/scripts/cleanup.sh
```

---

## Limitaciones explícitas

- **No persistencia cross-restart sin service manager**: si quieres que el daemon arranque al login automáticamente, ejecuta `bash setup/scripts/install-service-manager.sh` (renderea launchd/systemd local). Sigue siendo `local-only` — no expone públicamente.
- **Telegram bot opcional via ngrok ad-hoc**: si quieres bot temporal sin tunnel persistente, lanza `ngrok http 3099` puntual y siembra el URL en TELEGRAM_WEBHOOK_URL — pero al cerrar ngrok, el bot deja de responder.
- **Mobile install PWA fallida**: el manifest necesita HTTPS para `install` en iOS/Android. En `localhost` solo funciona en Mac/Linux/Windows browsers. Acepta limitación o migra a [local-tunnel](local-tunnel.md).
