# Deploy path — `vps-linux`

> **TL;DR**: VPS Ubuntu 22+ con dominio propio + nginx + Let's Encrypt + systemd. Daemon always-on 24/7 independiente de laptop. PWA MC en Vercel apuntando al daemon. Setup ≤30 min. Costo $5-20/mes.

---

## Cuándo elegirlo

✓ Production seria o deployment de cliente.
✓ Crons 24/7 con laptop apagada.
✓ Multi-device cross-locations sin depender de laptop.
✓ Vas a facturar tokens reales a un cliente (LLM provider con pay-per-token).

✗ Single-operator personal con laptop encendida casi siempre → [local-tunnel](local-tunnel.md) es más simple.
✗ Sin presupuesto infra → [local-tunnel](local-tunnel.md) free + Tailscale.

---

## VPS providers recomendados

| Provider | Tier mínimo | Costo aprox | RAM | Sweet spot |
|---|---|---|---|---|
| **Hetzner** | CPX11 | €4-5/mes | 2 GB | Mejor relación calidad/precio EU |
| **Contabo** | VPS S | €4-7/mes | 4 GB | Más RAM por dólar (overcommit) |
| **DigitalOcean** | Basic Droplet | $6/mes | 1 GB | Mejor docs + UI, sweet spot US |
| **Linode (Akamai)** | Nanode | $5/mes | 1 GB | Estable, US/EU |
| **AWS Lightsail** | Smallest | $3.50/mes | 0.5 GB | Solo si ya tienes ecosystem AWS |

**Mínimo recomendado**: 2 GB RAM (1 GB se queda corto si el daemon corre múltiples crons + Node 20 + nginx).

**Sistema operativo**: Ubuntu 22.04 LTS o 24.04 LTS. Otras distros (Debian, Fedora, Arch) funcionan pero los scripts asumen `apt` package manager.

---

## Capabilities (recap de MATRIX.md)

Todas activas:

| Capability | Estado |
|---|:-:|
| MC PWA + chat | ✓ |
| Crons 24/7 always-on | ✓ |
| Telegram bot | ✓ |
| Voice STT/TTS | ✓ |
| Memory Tool nativo (si Claude Code CLI) | ✓ |
| Memoria semántica indexada | ✓ con OpenAI key |
| Always-push receiver | ✓ remoto |
| Acceso desde cualquier red | ✓ |

---

## Pasos resumidos

El agente del template asume que ya tienes:
1. VPS aprovisionado con SSH access.
2. Dominio propio con DNS A record apuntando al VPS IP.
3. Supabase project creado.

Ejecuta vía SSH del agente:

```bash
# En el VPS:
# 1. Install deps Linux
bash setup/scripts/install-deps-linux.sh

# 2. Generate VAPID keys
bash setup/scripts/generate-vapid.sh

# 3. nginx + Let's Encrypt SSL termination
bash setup/scripts/install-nginx-letsencrypt.sh
# Pregunta el dominio: agent.<tudominio.com>
# certbot obtiene cert automático y configura renewal

# 4. systemd user service para daemon
bash setup/scripts/install-service-manager.sh
# Renderea systemd-linux.service.template con AGENT_NAME

# 5. Smoke test daemon
bash setup/scripts/smoke-test.sh

# Desde tu laptop local:
# 6. Apply migrations a Supabase
bash setup/scripts/seed-supabase.sh

# 7. Deploy PWA MC a Vercel apuntando al VPS
bash setup/scripts/deploy-vercel.sh
# Pregunta el AGENT_URL: https://agent.<tudominio.com>
```

---

## Arquitectura

```
                                  ┌──────────────────┐
                                  │  Vercel (PWA MC) │
                                  │  mc.dominio.com  │
                                  └────────┬─────────┘
                                           │ HTTPS
                                           │ bearer token
                                           ▼
┌────────────────────────────────────────────────────┐
│                       VPS                          │
│  ┌──────────────┐         ┌────────────────────┐   │
│  │   nginx      │ ──────► │  agent-server      │   │
│  │ :443 SSL     │  proxy  │  Node 20 :3099     │   │
│  │ Let's Encrypt│         │  (systemd service) │   │
│  └──────────────┘         └────────────────────┘   │
│                                       │            │
└───────────────────────────────────────┼────────────┘
                                        │ HTTPS
                                        ▼
                            ┌────────────────────┐
                            │  Supabase Cloud    │
                            │  (auth + DB + RLS) │
                            └────────────────────┘
```

---

## Env vars críticas

```bash
# En VPS, agent-server/.env
LLM_PROVIDER=openrouter           # recomendado para deploy cliente (control fino costo)
OPENROUTER_API_KEY=sk-or-...
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
MC_BASE_URL=https://mc.<dominio-cliente>.com
MISSION_CONTROL_ORIGIN=https://mc.<dominio-cliente>.com
ALLOWED_EMAILS=<email-operador>,<email-cliente-opcional>

# En Vercel project env, NEXT_PUBLIC_*
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
AGENT_URL=https://agent.<dominio-cliente>.com
OPENCLAW_GATEWAY_TOKEN=<shared con VPS .env>
```

---

## Operación diaria

```bash
# SSH al VPS para diagnostics
ssh user@vps

# Status del daemon
systemctl --user status <agent>-agent

# Logs en vivo
journalctl --user -u <agent>-agent -f

# Restart limpio
systemctl --user restart <agent>-agent

# Renew SSL manual (certbot auto-renewa, pero verificable):
sudo certbot renew --dry-run
```

---

## Backup & monitoring

- **Backups Supabase**: incluidos en plan gratuito (7-day rolling).
- **Backups daemon SQLite**: el daemon emite `weekly-backup` cron a `~/aios-backups/` con retention 60 días. Configurable.
- **Monitoring uptime**: setup gratis con [UptimeRobot](https://uptimerobot.com) pinging `https://agent.<dominio>.com/healthz`.
