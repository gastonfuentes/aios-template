# iOS quirks — comportamientos especificos Safari

## Versiones soportadas

- iOS 16.4+ (marzo 2023): primera version que soporta Web Push **solo si el sitio esta agregado a pantalla de inicio**.
- iOS < 16.4: no soporta push web. Notification API completa ausente.
- En Safari desktop (macOS): push si funciona en pestana, no requiere instalacion.

## Pasos para que iOS reciba push

1. Usuario abre el sitio en **Safari** (no Chrome iOS — usa el mismo engine pero no expone APIs de PWA).
2. Tap en el boton compartir.
3. "Agregar a pantalla de inicio".
4. Abrir la app desde el icono (NO desde Safari).
5. Solo entonces `Notification.requestPermission()` muestra el dialog.

Sin instalacion previa, Safari iOS rechaza silenciosamente la solicitud de permiso.

## UI alternativa para iOS no instalado

```tsx
'use client';
import { useEffect, useState } from 'react';

export function InstallInstructionsiOS() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 rounded-xl bg-white p-4 shadow-lg dark:bg-zinc-900">
      <p className="text-sm font-medium">Para recibir notificaciones</p>
      <ol className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        <li>1. Toca el boton compartir <ShareIcon /> abajo.</li>
        <li>2. "Agregar a pantalla de inicio".</li>
        <li>3. Abre la app desde el icono.</li>
      </ol>
    </div>
  );
}
```

## Otras quirks iOS

- **theme-color** se respeta solo si `apple-mobile-web-app-capable` esta presente.
- **Status bar style**: solo `default`, `black`, `black-translucent`. Otros valores ignored.
- **No `beforeinstallprompt`**: el evento que dispara el banner en Android NO existe en iOS — install es 100% manual.
- **Splash screen**: iOS genera una desde `apple-touch-startup-image` o el icon principal. No hay forma de customizarla via manifest.
- **Push frequency**: iOS limita a ~3 push/hora por sitio antes de degradar entrega.
- **Badge count**: el badge en el icono iOS usa `navigator.setAppBadge(N)` desde la app instalada. Solo iOS 16.4+.

## Detectar si esta instalado

```ts
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true; // iOS legacy

if (isStandalone) {
  // App esta instalada, push si funciona
}
```

## Limites de espacio en iOS

iOS limita el storage de PWAs instaladas a ~50MB en la mayoria de versiones. Para apps que necesiten mucho cache offline, considerar React Native + Expo (cross-ref `auth-stack/references/expo-non-next.md`).
