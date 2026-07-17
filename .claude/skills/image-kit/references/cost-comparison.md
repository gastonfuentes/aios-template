# Cost comparison — generadores de imagenes

Snapshot mayo 2026. Precios pueden cambiar — validar contra el provider.

## Modelos via OpenRouter

| Modelo | Cost per image (1024x1024) | Calidad | Velocidad |
|---|---|---|---|
| `google/gemini-2.0-flash-exp:free` | $0 (rate limited) | Buena para mockups | Rapida |
| `google/gemini-image-generation` | ~$0.039 | Muy buena | Rapida |
| `openai/dalle-3` | ~$0.040 | Excelente, especialmente texto en imagen | Media |
| `black-forest-labs/flux-1.1-pro` | ~$0.040 | Excelente, fotorealismo | Media |
| `black-forest-labs/flux-schnell` | ~$0.003 | Buena, muy rapido | Muy rapida |

**Recomendacion para empezar**: `google/gemini-2.0-flash-exp:free` para validar prompts. Cuando satisfecho, mover a `flux-schnell` por default y `flux-1.1-pro` para casos premium (hero images, fotorealismo).

## Modelos locales (Stable Diffusion via ComfyUI)

| Modelo | Costo | Hardware requerido |
|---|---|---|
| SDXL | $0 (despues de setup) | GPU 8GB+ |
| Flux dev (local) | $0 | GPU 24GB+ |

Ventaja: cero costo per generation, control total.
Desventaja: setup complejo, mantener GPU encendida o pagar runtime.

Recomendacion: solo si generas >1000 images/mes. Bajo eso, OpenRouter es mas barato cuando consideras tiempo + electricidad.

## Cost projection para creador YOUR_COMMUNITY

Asumiendo:

- 100 alumnos pagantes.
- Cada uno necesita 5-10 imagenes durante el flow (avatar + 2 thumbnails + assets).
- 750 imagenes/mes.

Con `flux-schnell` ($0.003): ~$2.25/mes.
Con `flux-1.1-pro` ($0.04): ~$30/mes.
Con local ComfyUI: $0 + $20-50/mes de hosting GPU.

Para volumen bajo, OpenRouter pago como uses gana. Solo evaluar local cuando >$50/mes de uso.

## Ahorros operativos

1. **Cache aggresivo**: cualquier imagen generada para un user persiste en Storage. Si vuelve a pedir lo mismo, sirve la cacheada.
2. **WebP siempre**: 60-80% menos bytes que PNG. Reduce CDN bills.
3. **Lazy loading**: imagenes off-screen no se cargan. Reduce egress.
4. **Variantes responsive**: generar 320/640/1024/1920 una vez, servir el optimo. Reduce bytes que el cliente descarga.
