# Cloudflare Tunnel

> **TL;DR**: Tunneling production-grade gratis ilimitado con tu propio dominio. Requiere cuenta Cloudflare + dominio en CF DNS + `cloudflared` CLI. Es el voto del template para deploys serios.

---

## Pre-requisitos

- Cuenta gratuita en [cloudflare.com](https://cloudflare.com).
- Dominio propio con NS apuntando a Cloudflare (cualquier registrar — Namecheap, Hostinger, GoDaddy, etc.).
- CLI `cloudflared` instalado:
  - macOS: `brew install cloudflared`
  - Linux: descarga desde [github.com/cloudflare/cloudflared/releases](https://github.com/cloudflare/cloudflared/releases)
  - Windows WSL2: `apt install cloudflared` o binario directo.

---

## Pasos canónicos

```bash
# 1. Login (abre browser, OAuth con tu cuenta Cloudflare)
cloudflared tunnel login

# 2. Crear el tunnel (nombre arbitrario, ej. <agent>-server)
cloudflared tunnel create <agent>-server

# 3. Route DNS — apuntar subdominio al tunnel
cloudflared tunnel route dns <agent>-server agent.<tudominio.com>

# 4. Run (en foreground para probar; service manager lo gestiona en prod)
cloudflared tunnel run <agent>-server
```

El script [start-cloudflare-tunnel.sh](../scripts/start-cloudflare-tunnel.sh) automatiza los 4 pasos preguntando el subdominio deseado.

---

## Env vars sembradas

```bash
# agent-server/.env
MC_BASE_URL=https://agent.<tudominio.com>
MISSION_CONTROL_ORIGIN=https://mc.<tudominio.com>,http://localhost:3000

# mission-control/.env.local
AGENT_URL=https://agent.<tudominio.com>
```

---

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `auth required` al `tunnel create` | Login expiró | Re-correr `cloudflared tunnel login` |
| `Error 1033: Tunnel offline` en browser | Tunnel daemon no corriendo | Verificar service manager o relanzar `cloudflared tunnel run` |
| DNS no resuelve aún | Propagación CF (rara, suele ser instantánea) | Esperar 30-60s, probar con `dig` |
| `Error: Failed to fetch tunnel from API` | Token expirado o tunnel borrado | Re-crear con `cloudflared tunnel create` |
| Multiple tunnels con mismo nombre | Recreaste sin limpiar el anterior | `cloudflared tunnel delete <id>` el viejo |

---

## Limitaciones

- Requiere **dominio propio en Cloudflare** (no funciona con dominios externos sin migrar NS).
- El plan gratuito incluye bandwidth ilimitado pero rate-limited en abuse extremo (raro hitearlo single-operator).
- Si migras NS desde otro provider, propagación DNS puede tardar ~24h la primera vez.

---

## Cuándo elegirlo

✓ Tienes (o quieres comprar) un dominio.
✓ Producción seria o agencia con cliente.
✓ Quieres URL estable cross-restart sin pagar.

✗ No tienes dominio y no quieres comprarlo → usa [Tailscale](tailscale.md).
✗ Demo rápida descartable → usa [ngrok](ngrok.md).
