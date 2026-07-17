# Manual setup — paso a paso humano

> **TL;DR**: Guía manual para operadores que prefieren ejecutar comandos uno por uno sin agente. Cubre los 4 cuadrantes oficialmente soportados. Para quien quiere aprender los pasos antes de delegar al agente.

---

## Pre-requisitos universales

Independiente del cuadrante:

```bash
# Verifica versiones mínimas
node --version    # >= 20
npm --version     # >= 10
git --version
```

Si falta Node 20+:
- macOS: `brew install node@20` o [nvm](https://github.com/nvm-sh/nvm).
- Linux: NodeSource (`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -` + `sudo apt install -y nodejs`).
- Windows: WSL2 + Ubuntu + pasos Linux.

---

## Cuadrante 1: `local-only`

### 1. Clona el repo

```bash
gh repo create my-mission-control --template juanlara-aidev/aios-template --private --clone
cd my-mission-control
```

### 2. Instala dependencias

```bash
cd mission-control && npm install && cd ..
cd agent-server && npm install && npm run build && cd ..
```

### 3. Crea Supabase project

1. Ve a [supabase.com](https://supabase.com) → New Project → Free tier → US East.
2. Espera ~2 min al provisioning.
3. Settings → API → copia `Project URL` + `service_role` key.

### 4. Aplica migrations Supabase

```bash
cd supabase
supabase link --project-ref <ref>
supabase db push
```

Si no tienes Supabase CLI: copia el SQL de cada archivo en `supabase/migrations/` y pégalo en Supabase Dashboard → SQL Editor.

### 5. Genera VAPID keys

```bash
cd agent-server
npx web-push generate-vapid-keys
# Copia el "Public Key" y "Private Key" output
```

### 6. Siembra .env del daemon

`agent-server/.env`:
```bash
LLM_PROVIDER=claude-code-sdk           # o anthropic-api / openrouter
# Si claude-code-sdk: no API key needed (el CLI usa ~/.claude/auth.json)
# Si anthropic-api: ANTHROPIC_API_KEY=sk-ant-...
# Si openrouter: OPENROUTER_API_KEY=sk-or-...

SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

ALLOWED_EMAILS=tu-email@gmail.com
MC_BASE_URL=http://localhost:3000
MISSION_CONTROL_ORIGIN=http://localhost:3000

PORT=3099
OPENCLAW_GATEWAY_TOKEN=<genera con: openssl rand -hex 32>

VAPID_PUBLIC_KEY=<de paso 5>
VAPID_PRIVATE_KEY=<de paso 5>
VAPID_SUBJECT=mailto:tu-email@gmail.com
```

### 7. Siembra .env.local del MC

`mission-control/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...     # de Supabase Settings → API → anon public

AGENT_URL=http://localhost:3099
OPENCLAW_GATEWAY_TOKEN=<mismo valor que en agent-server/.env>

NEXT_PUBLIC_VAPID_PUBLIC_KEY=<mismo que VAPID_PUBLIC_KEY>
```

### 8. Arranca daemon + MC

Terminal 1:
```bash
cd agent-server && npm run start
```

Terminal 2:
```bash
cd mission-control && npm run dev
```

### 9. Validar

- `curl http://localhost:3099/healthz` → debe responder `{ok:true}`.
- Abre `http://localhost:3000` → redirige a `/login`.
- Mete tu email, recibe magic-link, click → entras al dashboard.

---

## Cuadrante 2: `local-tunnel`

Pasos 1-9 del `local-only` + estos extras:

### 10. Instala tunnel CLI

Elige uno:
- Cloudflare: `brew install cloudflared` → ver [setup/tunneling/cloudflare.md](../setup/tunneling/cloudflare.md).
- Tailscale: descarga de [tailscale.com/download](https://tailscale.com/download) → ver [setup/tunneling/tailscale.md](../setup/tunneling/tailscale.md).
- ngrok: `brew install ngrok/ngrok/ngrok` → ver [setup/tunneling/ngrok.md](../setup/tunneling/ngrok.md).

### 11. Arranca tunnel

Sigue los pasos del doc específico del provider que elegiste.

### 12. Actualiza env vars con tunnel URL

```bash
# agent-server/.env
MC_BASE_URL=https://<tunnel-domain>
MISSION_CONTROL_ORIGIN=https://<mc-domain>,http://localhost:3000

# mission-control/.env.local
AGENT_URL=https://<tunnel-domain>
```

### 13. Install service manager (launchd / systemd)

Ver [setup/service-manager/README.md](../setup/service-manager/README.md) para pasos exactos. Renderiza el template con placeholders y `launchctl bootstrap` / `systemctl --user enable`.

---

## Cuadrante 3: `vps-linux`

### 14. Aprovisiona VPS

Hetzner / Contabo / DigitalOcean — mínimo 2 GB RAM, Ubuntu 22.04 LTS.

### 15. SSH inicial + harden

```bash
ssh root@<vps-ip>
adduser <user>
usermod -aG sudo <user>
# Copia tu ssh pubkey, desactiva root login, ufw allow OpenSSH/80/443
```

### 16. En el VPS, repite pasos 1-7 del `local-only`

### 17. Instala nginx + Let's Encrypt

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d agent.<dominio.com>
```

Edita `/etc/nginx/sites-available/<agent>` para proxy `localhost:3099`. Ver [setup/deploy-paths/vps-linux.md](../setup/deploy-paths/vps-linux.md) para nginx config canónica.

### 18. systemd service para daemon

Renderiza `systemd-linux.service.template` (ver [service-manager/README.md](../setup/service-manager/README.md)) y `systemctl --user enable` + `start`.

### 19. Deploy MC PWA a Vercel

```bash
cd mission-control
npx vercel link
npx vercel env add ... (todas las env vars de paso 7 + AGENT_URL=https://agent.<dominio>.com)
npx vercel --prod
```

---

## Cuadrante 4: `pwa-only-cloud`

Pasos 1-7 del `local-only` MENOS daemon (skip pasos 8-9). En su lugar:

### 20. Deploy MC PWA a Vercel directo

```bash
cd mission-control
npx vercel link
npx vercel env add LLM_PROVIDER ... etc.
npx vercel --prod
```

El MC consume el LLM provider directamente desde rutas serverless. Pierde features daemon-requiring (crons, Telegram, voice).

---

## Troubleshooting

Ver [docs/troubleshooting.md](troubleshooting.md) para catálogo completo de errores comunes y fixes.
