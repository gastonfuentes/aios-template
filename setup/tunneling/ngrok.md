# ngrok

> **TL;DR**: El tunneling más conocido. Gratis con URL random cada restart, paid (~$8/mes) para custom domain estable. Bueno para demos rápidas o testing antes de comprar dominio.

---

## Pre-requisitos

- Cuenta gratuita en [ngrok.com](https://ngrok.com) (login Google/GitHub/email).
- Authtoken (settings → Your Authtoken).
- CLI `ngrok` instalado:
  - macOS: `brew install ngrok/ngrok/ngrok`
  - Linux: descarga desde [ngrok.com/download](https://ngrok.com/download)
  - Windows WSL2: `apt install ngrok` o binario directo.

---

## Pasos canónicos

```bash
# 1. Autenticar el CLI con tu authtoken
ngrok config add-authtoken <TU_AUTHTOKEN>

# 2. Exponer puerto local
ngrok http 3099

# 3. Copiar la URL pública (formato https://<random>.ngrok-free.app)
# Aparece en stdout: "Forwarding https://abc-123-xyz.ngrok-free.app -> http://localhost:3099"
```

El script [start-ngrok-tunnel.sh](../scripts/start-ngrok-tunnel.sh) automatiza el flow y extrae la URL desde el API local de ngrok (`http://localhost:4040/api/tunnels`).

---

## Free tier vs Paid

| | Free | Paid ($8/mes Personal) |
|---|---|---|
| URL | Random cada restart (`abc-xyz.ngrok-free.app`) | Custom domain estable |
| Bandwidth | 1 GB/mes | 10 GB/mes |
| Sessions concurrentes | 1 | 3+ |
| Inspector web | ✅ | ✅ |
| Custom subdomain | ❌ | ✅ |

---

## Env vars sembradas

```bash
# agent-server/.env
MC_BASE_URL=https://<random>.ngrok-free.app
MISSION_CONTROL_ORIGIN=https://<random>.ngrok-free.app,http://localhost:3000

# mission-control/.env.local
AGENT_URL=https://<random>.ngrok-free.app
```

⚠ Free tier: tras cada restart de ngrok, la URL cambia y tienes que re-sembrar las env vars.

---

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `ERR_NGROK_4018` (Auth required) | Authtoken no configurado | `ngrok config add-authtoken <token>` |
| URL random rota tras laptop sleep | Free tier reconnect cambia URL | Upgradear a paid o re-sembrar env vars |
| `tunnel session limit exceeded` | Más de 1 ngrok corriendo en free tier | `killall ngrok` y relanzar |
| Warning page de ngrok en browser | Visitas primera vez | Aceptar warning una vez; persiste en cookies |

---

## Cuándo elegirlo

✓ Demo de 1-2 horas para mostrarle a alguien.
✓ Testing local antes de decidir tunneling final.
✓ Plan paid si necesitas URL custom estable sin dominio Cloudflare.

✗ Production seria → usa [Cloudflare](cloudflare.md) con dominio.
✗ Setup gratis estable → usa [Tailscale](tailscale.md).
