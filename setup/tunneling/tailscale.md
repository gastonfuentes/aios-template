# Tailscale Funnel

> **TL;DR**: Sweet spot sin dominio propio. Tailscale Funnel te da subdominio `<host>.<tailnet>.ts.net` gratis hasta 100 devices, con MagicDNS estable. Voto del template cuando no quieres comprar dominio.

---

## Pre-requisitos

- Cuenta gratuita en [tailscale.com](https://tailscale.com) (login con Google, GitHub, Microsoft, o email).
- CLI `tailscale` instalado:
  - macOS: descarga desde [tailscale.com/download/mac](https://tailscale.com/download/mac) o `brew install --cask tailscale`
  - Linux: `curl -fsSL https://tailscale.com/install.sh | sh`
  - Windows WSL2: instala el Tailscale Windows host + habilita WSL2 share.

---

## Pasos canónicos

```bash
# 1. Login (abre browser, OAuth)
tailscale up

# 2. Habilitar Funnel en tu cuenta (UI web, una vez por tailnet)
# Ir a https://login.tailscale.com/admin/dnssetup → habilitar MagicDNS
# Ir a https://login.tailscale.com/admin/acls → agregar nodeAttrs: ["funnel"] a tus tags

# 3. Exponer el puerto del daemon al Funnel
tailscale funnel --bg --https=443 --set-path=/ http://localhost:3099

# 4. Verificar URL pública
tailscale funnel status
# Imprime: https://<host>.<tailnet>.ts.net/ → http://localhost:3099
```

El script [start-tailscale-funnel.sh](../scripts/start-tailscale-funnel.sh) automatiza los 4 pasos.

---

## MagicDNS hostname

Formato canónico: `https://<hostname>.<tailnet-name>.ts.net`

- `<hostname>`: nombre de tu device en Tailscale (el de tu Mac/Linux box).
- `<tailnet-name>`: tu tailnet (ej. `tail4f3a2.ts.net` por default, o un nombre custom si lo configuraste).

Persiste cross-restart mientras no cambies el hostname.

---

## Env vars sembradas

```bash
# agent-server/.env
MC_BASE_URL=https://<host>.<tailnet>.ts.net
MISSION_CONTROL_ORIGIN=https://<host>.<tailnet>.ts.net,http://localhost:3000

# mission-control/.env.local
AGENT_URL=https://<host>.<tailnet>.ts.net
```

---

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `Funnel not enabled` | Falta habilitar Funnel en ACLs | Ir al admin panel → ACLs → agregar `nodeAttrs: ["funnel"]` |
| `MagicDNS off` | MagicDNS no habilitado en tailnet | Ir a DNS settings → toggle ON MagicDNS |
| URL responde pero el daemon no aparece | Puerto wrong en `funnel` config | `tailscale funnel status` y verifica que el target sea `http://localhost:3099` |
| Latencia alta desde mobile | Tailscale relay si DERP no llega directo | Normal en redes con NAT estricto, ~100-300ms aceptable single-operator |

---

## Limitaciones

- **Beta status** — Tailscale Funnel sigue marcado beta (estable en práctica desde 2023).
- **100 devices máximo** en plan gratuito (sobrado para single-operator).
- **Solo HTTPS** — no soporta puertos arbitrarios para servicios non-HTTP.
- **Hostname depende del device name** — si cambias el nombre del Mac, cambia la URL.

---

## Cuándo elegirlo

✓ No quieres comprar dominio.
✓ Single-operator o equipo pequeño (< 100 devices).
✓ Quieres acceso desde móvil sin friction.

✗ Necesitas URL custom de marca → usa [Cloudflare](cloudflare.md).
✗ Demo descartable de 1 hora → usa [ngrok](ngrok.md).
