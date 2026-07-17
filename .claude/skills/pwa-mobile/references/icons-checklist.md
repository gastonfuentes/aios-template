# Icons checklist — manifest + iOS

## Set minimo (3 archivos)

```
public/icons/
├── icon-192.png         # 192x192, transparent background, padding ~10%
├── icon-512.png         # 512x512, idem
└── icon-512-maskable.png # 512x512, sin transparencia, contenido en circulo central 80%
```

`maskable` es la diferencia clave: Android crops el icon en formas variables (circulo, rounded square). Sin maskable, los bordes se cortan. Usar herramienta: `https://maskable.app`.

## iOS-specific

iOS no usa los `icons` del manifest. Usa el meta tag `apple-touch-icon`:

```html
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

`/icons/apple-touch-icon.png` debe ser **180x180**, sin transparencia (iOS no la soporta — agregar background color manual), con esquinas cuadradas (iOS las redondea automatico).

## Splash screens iOS (opcional)

iOS genera splash desde `apple-touch-startup-image`. Para personalizarlo necesitas un set para cada device size:

```html
<link rel="apple-touch-startup-image" href="/splash/iphone-14-pro.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />
```

Es exhaustivo (12+ devices). Generar con `https://progressier.app` o similar. Default sin esto: iOS genera una desde el icon — funciona, solo no es brand-perfect.

## Badge para notificaciones

```
public/icons/
└── badge-72.png        # 72x72, monochrome (silueta blanca sobre transparente)
```

El badge aparece junto al icon de la notificacion en Android. Sin badge, Android usa el icon completo.

## Generar los icons desde un logo source

Cross-ref `@.claude/skills/image-kit/SKILL.md`. Comando equivalente con `sharp`:

```bash
# Si tienes logo-1024.png como source
npx sharp-cli -i logo-1024.png -o public/icons/icon-512.png resize 512 512
npx sharp-cli -i logo-1024.png -o public/icons/icon-192.png resize 192 192
npx sharp-cli -i logo-1024.png -o public/icons/apple-touch-icon.png resize 180 180 -- composite -bg "#0a0a0a"
```

O con `image-kit` para casos donde el logo necesita generarse + variantes.
