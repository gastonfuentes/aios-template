# Deploy local + Cloudflare Tunnel

> **Path canónico recomendado del template AIOS** para uso personal. El Mission Control vive en tu máquina (laptop, mini-PC always-on) y se expone opcionalmente a internet via Cloudflare Tunnel. Cero VPS pagado, cero infra recurrente más allá de Supabase Free Tier.

---

## Cuándo elegir este path

- **Uso personal**: tu MC es tuyo, no vas a cobrar a clientes por él.
- **Tienes hardware always-on**: mini-PC, Apple Mac mini, laptop con suspend desactivado, Raspberry Pi capaz, NUC Intel.
- **Quieres el setup más simple posible**: 5-15 min hasta MC vivo según opciones.

## Cuándo NO elegir este path

- Vas a vender el MC a un cliente → usa el path [`DEPLOY-VPS.md`](DEPLOY-VPS.md) (cuando exista) — el MC vive sin depender de tu laptop.
- Necesitas SLA 99.9% real → VPS o cloud con monitoring + alerting es más seguro que tu laptop encendida.
- Vas a tener tráfico significativo (>1000 req/día sostenido) → considerar VPS o Vercel + Supabase managed.

---

## Variantes del path local

| Variante | Tunneling | Mobile access | Custom domain | Setup time | Costo recurrente |
|---|---|---|---|---|---|
| **Local-only** | ❌ ninguno | ❌ solo localhost | ❌ | ~5 min | $0 |
| **Local + Quick Tunnel** | ✅ Cloudflare (subdominio random `*.trycloudflare.com`) | ✅ con la URL del subdominio | ❌ | ~6 min | $0 |
| **Local + Named Tunnel** | ✅ Cloudflare con tu dominio | ✅ con tu dominio | ✅ via Cloudflare DNS | ~15 min | $0 (Cloudflare Free) + costo del dominio (~$10-15/año) |
| **Local + Tailscale Funnel** | ✅ Tailscale | ✅ con la URL Tailscale | ⚠ Tailscale-managed | ~10 min | $0 (Tailscale Free) |
| **Local + ngrok** | ✅ ngrok | ✅ con la URL ngrok | ⚠ premium para custom domain | ~5 min | $0-10/mes (free tier limitado) |

---

## Setup paso a paso — Local + Quick Tunnel (recomendado para arrancar)

### Pre-requisitos

- Node 20+ (`node --version`).
- git (`git --version`).
- Cuenta Supabase Free Tier — crear en [supabase.com](https://supabase.com/dashboard).
- macOS / Linux / Windows + WSL2.

### Paso 1: Clona el template

El agente lo hace por ti tras `gh repo clone juanlara-aidev/aios-template`. Si tipeas tú:

```bash
gh repo clone juanlara-aidev/aios-template my-mission-control
cd my-mission-control
```

### Paso 2: Abre el agente y dile "Lee BOOT.md y arráncame"

El agente ejecuta:

1. **Detecta tu OS** vía `uname -a` + `which node/npm/git/gh/cloudflared`.
2. **Entrevista 7-8 preguntas** (cuadrante de deploy, nombre del agente, provider LLM, etc.).
3. **Aplica scripts** de `setup/scripts/` según el cuadrante:
   - `install-deps-{macos,linux,windows-wsl2}.sh`
   - `seed-supabase.sh` (aplica `supabase/migrations/<timestamp>__aios_schema_canonical.sql`)
   - `generate-vapid.sh` (VAPID keys para PWA push)
   - `start-daemon-local.sh` (arranca `agent-server` en background)
   - `start-cloudflare-tunnel.sh` (arranca Quick Tunnel apuntando a `localhost:3000`)
   - `smoke-test.sh` (valida que todo esté vivo)
4. **Siembra identity templates** rellenando `.claude/identity/SOUL.md`, `USER.md`, `HEARTBEAT.md`, y `.claude/agents/<agent-name>.md` con las respuestas del operador.
5. **Reporta la URL pública** del Quick Tunnel (`https://<random>.trycloudflare.com`) + URL local `http://localhost:3000`.

### Paso 3: Valida y entra

- Abre `http://localhost:3000` (o la URL pública del tunnel).
- Haz login con tu email — Supabase envía magic-link.
- Una vez dentro, dile al agente: *"Lee mi contexto"* — `operator-context` skill sintetiza tu perfil.

---

## Setup paso a paso — Local + Named Tunnel (producción del operador)

Cuando ya validaste el setup con Quick Tunnel y quieres URL persistente con tu dominio:

### Pre-requisitos adicionales

- Cuenta Cloudflare Free.
- Dominio propio gestionado en Cloudflare DNS (~$10-15/año para dominio nuevo, o transfiriendo uno existente).
- Cloudflare Zero Trust (gratis hasta 50 users).

### Pasos canónicos

1. **`cloudflared login`** — abre browser para autenticarte con tu cuenta Cloudflare.
2. **`cloudflared tunnel create my-mission-control`** — crea el túnel persistente. Anota el `<tunnel-uuid>`.
3. **DNS**: en Cloudflare Dashboard → tu dominio → DNS → Add CNAME → `aios.<tu-dominio>` → `<tunnel-uuid>.cfargotunnel.com` (proxied).
4. **Config file** `~/.cloudflared/config.yml`:

   ```yaml
   tunnel: <tunnel-uuid>
   credentials-file: ~/.cloudflared/<tunnel-uuid>.json
   ingress:
     - hostname: aios.<tu-dominio>
       service: http://localhost:3000
     - hostname: aios-agent.<tu-dominio>
       service: http://localhost:3099
     - service: http_status:404
   ```

5. **Arranca el tunnel** persistente: `cloudflared tunnel run my-mission-control`.
6. **Update env vars** del MC + daemon:

   ```bash
   # mission-control/.env.local
   NEXT_PUBLIC_SITE_URL=https://aios.<tu-dominio>
   AGENT_URL=https://aios-agent.<tu-dominio>

   # agent-server/.env
   MISSION_CONTROL_ORIGIN=http://localhost:3000,https://aios.<tu-dominio>
   MISSION_CONTROL_URL=https://aios.<tu-dominio>/api/openclaw/event
   MC_BASE_URL=https://aios.<tu-dominio>
   ```

7. **Service manager** (opcional, para arranque persistente al reboot):
   - **macOS**: `bash setup/scripts/install-service-manager.sh` instala `launchd` plist + `cloudflared tunnel run` como background daemon.
   - **Linux**: `systemd --user` units para `agent-server` + `cloudflared`.
   - **Windows**: Task Scheduler con disparador "At log on".

### Verificar

```bash
curl -s https://aios.<tu-dominio>/api/health 2>&1 | head -5
curl -s -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" https://aios-agent.<tu-dominio>/healthz | head -5
```

Ambos deberían responder 200 con JSON estructurado.

---

## Mantenimiento

- **Daily ops**: el daemon corre en background. No necesitas hacer nada salvo verificar logs si algo falla.
  - macOS: `tail -f ~/Library/Logs/aios/agent.log`
  - Linux: `journalctl --user -u aios-agent --follow`
  - Windows: ver `agent-server/store/*.log`
- **Stop limpio**: `bash setup/scripts/cleanup.sh` para el daemon + tunnel.
- **Updates del template**: `git pull origin main` desde el directorio del template clone si quieres aplicar mejoras del upstream. El operador decide qué pull aplica (muchos archivos están gitignored — su personalización queda intacta).
- **Backup**: `agent-server/store/*` + `.claude/agent-memory/<agent>/*` son los archivos con state del operador. Hacer backup periódico (cron `weekly-backup` opcional, o snapshot manual).

---

## Troubleshooting

Ver [`docs/troubleshooting.md`](troubleshooting.md) para el catálogo completo. Errores comunes:

- **`cloudflared: command not found`** → instalar: macOS `brew install cloudflared`; Linux `wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb`; Windows .msi installer de GitHub releases.
- **Quick Tunnel se desconecta tras N minutos** → es comportamiento esperado de `*.trycloudflare.com` (subdominio efímero). Re-correr `bash setup/scripts/start-cloudflare-tunnel.sh` lo levanta de nuevo con subdominio nuevo. Para persistencia, upgrade a Named Tunnel.
- **`MC SSR error: AGENT_URL not configured`** → el MC no puede contactar al daemon. Verificar que `AGENT_URL` esté sembrado en `mission-control/.env.local` y que el daemon esté vivo (`curl localhost:3099/healthz`).
- **Magic-link Supabase `rate_limit_email_sent`** → SMTP nativo de Supabase tiene cap 2 emails/hora. Para producción, configurar Resend o similar SMTP custom (ver [`docs/customization.md`](customization.md) sección SMTP).

---

## Referencias

- [`BOOT.md`](../BOOT.md) — contrato del agente initializer.
- [`INTERVIEW.md`](../INTERVIEW.md) — cuestionario de la entrevista.
- [`MATRIX.md`](../MATRIX.md) — matriz decisión cuadrante → scripts.
- [`setup/tunneling/cloudflare.md`](../setup/tunneling/cloudflare.md) — guía detallada Cloudflare Tunnel.
- [`setup/tunneling/tailscale.md`](../setup/tunneling/tailscale.md) — alternativa Tailscale Funnel.
- [`setup/tunneling/ngrok.md`](../setup/tunneling/ngrok.md) — alternativa ngrok.
- [`setup/service-manager/README.md`](../setup/service-manager/README.md) — service managers cross-OS.
