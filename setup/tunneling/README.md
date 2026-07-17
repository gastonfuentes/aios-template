# Tunneling — comparativa de opciones

> **TL;DR**: 3 opciones oficialmente soportadas (Cloudflare / Tailscale / ngrok) + 3 escape valves (Twingate / bore / none). El voto del template depende de si tienes dominio y por cuánto tiempo necesitas la exposición pública.

---

## Comparativa

| Provider | Dominio propio | Costo | URL estable | Setup time | Mejor para |
|---|---|---|---|---|---|
| **Cloudflare Tunnel** | ✓ requerido | Gratis | ✓ | ~10 min | Production seria, agencia con cliente |
| **Tailscale Funnel** | ✗ no necesario | Gratis (< 100 devices) | ✓ MagicDNS | ~5 min | Single-operator sin dominio, sweet spot |
| **ngrok** | ✗ no en free, ✓ en paid | Gratis (URL random) / $8 mes | ⚠ paid only | ~3 min | Demos rápidas, testing |
| **Twingate** | ✗ | Free tier limited | ✓ | ~10 min | Zero-trust scope corporate (over-engineered single-operator) |
| **bore.pub** | ✗ | Gratis self-hosted | ⚠ random | ~5 min | Hackeo de fin de semana, no production |
| **none (local-only)** | n/a | Gratis | n/a | 0 min | Laptop personal sin acceso móvil |

---

## Voto del template

### Para production o agencia con cliente
**Cloudflare Tunnel**. Bandwidth ilimitado gratis, URL profesional con tu dominio, tooling maduro, persiste cross-restart. La curva de aprendizaje extra (10 min para migrar NS a Cloudflare) vale los próximos años de uso. Doc canónica: [cloudflare.md](cloudflare.md).

### Para single-operator sin dominio
**Tailscale Funnel**. Cero compra, URL `<host>.<tailnet>.ts.net` estable mientras no cambies el hostname, MagicDNS resuelve cross-platform, free tier sobra hasta 100 devices. Beta status pero estable en práctica desde 2023. Doc canónica: [tailscale.md](tailscale.md).

### Para demo descartable de 1 hora
**ngrok**. Setup en 3 min con authtoken, free tier suficiente para mostrarle a alguien una vez. URL cambia al restart, así que no inviertas tiempo configurándola para producción. Doc canónica: [ngrok.md](ngrok.md).

### Para laptop personal sin acceso móvil
**none**. Cuadrante `local-only` del template. MC vive en `localhost:3000`, daemon en `localhost:3099`, cero exposición pública. Pierdes Telegram + acceso móvil; ganas cero superficie de ataque.

---

## Cómo decide el agente

Durante la entrevista del template (`INTERVIEW.md` Pregunta 5), el agente te ofrece A/B/C según tu respuesta a Pregunta 2 sobre dispositivos. Si no sabes elegir, el agente:

1. **Tienes dominio en Cloudflare** → recomienda Cloudflare.
2. **No tienes dominio** → recomienda Tailscale.
3. **Quieres demo rápida descartable** → recomienda ngrok.

Cada recomendación se acompaña del link a la doc específica del provider con pasos exactos.
