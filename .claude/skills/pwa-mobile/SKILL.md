---
name: pwa-mobile
description: "Convierte una app Next.js en PWA instalable y agrega notificaciones push web cross-platform (Chrome, Edge, Safari iOS 16.4+). Service worker, manifest, VAPID keys, subscribe/unsubscribe handlers, y suscripciones guardadas en profiles. Activar cuando el usuario menciona PWA, hacer instalable, notificaciones push, mobile, service worker, manifest, install banner, o pide 'que se instale en el telefono'."
allowed-tools: Read, Write, Edit, Bash
---

# pwa-mobile — instalable + push web

> Dos sub-paths claros: PWA basico (manifest + install) y PWA + push completo (VAPID). Elegir cual aplica al alumno antes de empezar.

---

## Cuando activar

- "Quiero que mis alumnos instalen la app en su telefono."
- "Mandame notificaciones push cuando publique nueva leccion."
- "PWA / service worker / manifest."
- "Banner de instalar."

## Cuando NO activar

- App nativa real con acceso a APIs del sistema (camara, NFC, contactos, file picker avanzado). Eso es React Native + Expo, escalar c2.
- Solo emails como canal. Eso es `@.claude/skills/emails-transactional/SKILL.md`.

## Antes de empezar — verifica empiricamente

- [ ] `auth-stack` ya esta integrado (necesitas `profiles` para asociar suscripciones a users).
- [ ] App corriendo en HTTPS (PWA + Service Worker requieren HTTPS, excepto localhost). Si dev, ngrok o `next dev --experimental-https`.
- [ ] Decidir sub-path: solo install (PWA basico) o install + push (PWA completo).
- [ ] Si push: VAPID keys generadas. Sin keys, escalar a `references/generate-vapid.md`.

## Sub-path A: PWA basico (instalable, sin push)

### Paso 1: manifest

`public/manifest.json`:

```json
{
  "name": "Tu app YOUR_COMMUNITY",
  "short_name": "TuApp",
  "description": "Acceso rapido a tu comunidad",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a84ff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Razon de `maskable`: Android crops icons en circulos/cuadrados con margen. Sin `maskable`, tu icon queda con bordes random.

Generar los 3 icons: cross-ref `@.claude/skills/image-kit/SKILL.md` para crear desde un logo source.

### Paso 2: meta tags + link al manifest

`src/app/layout.tsx`:

```tsx
export const metadata = {
  title: 'Tu app',
  manifest: '/manifest.json',
  themeColor: '#0a84ff',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TuApp',
  },
};

export const viewport = {
  themeColor: '#0a84ff',
  width: 'device-width',
  initialScale: 1,
};
```

iOS necesita los meta `apple-*` aparte porque no soporta el manifest completo aun.

### Paso 3: service worker minimo

`public/sw.js` (al menos basico para que sea instalable):

```js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache strategy minima — sirve cached assets primero, fallback a red
self.addEventListener('fetch', (event) => {
  // Solo cachear GETs same-origin
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
});
```

Registrar en `src/app/layout.tsx` con `<Script>` o en un `<ClientProvider>` que corra en el browser.

### Paso 4: install banner

```tsx
// src/components/install-prompt.tsx
'use client';
import { useEffect, useState } from 'react';

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show) return null;

  async function handleInstall() {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setShow(false);
  }

  return (
    <div className="fixed bottom-4 right-4 rounded-xl bg-white p-4 shadow-lg dark:bg-zinc-900">
      <p className="text-sm">Instala TuApp en tu telefono.</p>
      <button onClick={handleInstall} className="mt-2 rounded-lg bg-praxis-gradient px-4 py-2 text-white">
        Instalar
      </button>
    </div>
  );
}
```

iOS no dispara `beforeinstallprompt` — el banner ahi se reemplaza con instrucciones manuales ("Toca compartir → Agregar a pantalla de inicio").

## Sub-path B: PWA + push completo

Hacer Sub-path A primero. Luego agregar push.

### Paso B1: generar VAPID keys

```bash
npx web-push generate-vapid-keys
```

Salida:

```
Public Key: BLab...
Private Key: 8z...
```

Pega en `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLab...
VAPID_PRIVATE_KEY=8z...
VAPID_SUBJECT=mailto:tu@dominio.com
```

### Paso B2: tabla `push_subscriptions`

```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subs_self_read" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_subs_self_write" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_subs_self_delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
```

### Paso B3: subscribe/unsubscribe handlers

Cliente (`src/lib/push/subscribe.ts`):

```ts
export async function enableNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  });

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });

  return true;
}
```

Server (`src/app/api/push/subscribe/route.ts`):

```ts
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const sub = await request.json();
  await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      keys: sub.keys,
    },
    { onConflict: 'endpoint' },
  );

  return Response.json({ ok: true });
}
```

### Paso B4: enviar push desde server

```ts
// src/lib/push/send.ts
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  const supabase = createServiceClient();
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify(payload),
      ).catch(async (err) => {
        // 404/410 = subscription invalida, eliminar
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id);
        }
      }),
    ),
  );
}
```

### Paso B5: SW recibe push

`public/sw.js` (extiende lo del Sub-path A):

```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'TuApp', body: '' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? '/'));
});
```

## Validacion con QR + iPhone real

```bash
# Local con HTTPS
ngrok http 3000
# QR del URL de ngrok desde phone.

# Verificar:
# 1. Banner de instalar aparece en Chrome (Android).
# 2. iOS: Safari → Compartir → Agregar a pantalla de inicio.
# 3. App se abre standalone (sin barra del browser).
# 4. Push: enableNotifications() → permiso aceptado → sub creada.
# 5. Server send: notificacion llega al device incluso con app cerrada.
```

iOS Safari soporta push solo si la app fue instalada (Add to Home Screen). En navegador puro NO recibe push.

## Si tu Directiva no es Next.js

- Cualquier framework: el manifest, SW y VAPID son estandar web. Las APIs del cliente (`navigator.serviceWorker`, `pushManager`) son cross-framework.
- Para mobile nativo (React Native): usar Expo Notifications, no Web Push. Cross-ref `@.claude/skills/auth-stack/references/expo-non-next.md`.

## Cross-references con skills hermanas

- `@.claude/skills/auth-stack/SKILL.md` — `push_subscriptions.user_id` referencia `profiles.id`. Hand-off: `enableNotifications()` se llama desde un boton en `/(app)/settings`, requiere user autenticado.
- `@.claude/skills/emails-transactional/SKILL.md` — push como canal alternativo. Patron: enviar push primero (instantaneo), email solo si push falla o si es legalmente requerido (recibo). Hand-off: en notificaciones de cobro, push + email; en broadcast a toda la comunidad, solo email.
- `@.claude/skills/frontend-design/SKILL.md` — el banner de install y los toasts del permiso de push respetan paleta y tipografia.
- `@.claude/skills/image-kit/SKILL.md` — generar los 3 icons del manifest desde un logo source.

## Archivos lazy-loaded

- `references/generate-vapid.md` — comando + variables, manejo de rotacion de keys.
- `references/ios-quirks.md` — comportamientos especificos iOS Safari, requisitos para push (Add to Home Screen primero), version minima 16.4+.
- `references/icons-checklist.md` — los 3 icons obligatorios + 1 maskable + iOS-specific apple-touch-icon.
- `references/notification-strategies.md` — cuando usar push vs email vs ambos, frecuencia maxima recomendada, opt-in granular.
- `assets/sw.js` — service worker completo (basico + push + notificationclick).
- `assets/manifest.json` — manifest completo con campos opcionales explicados.
- `assets/install-prompt.tsx` — componente con UI completa (Android + iOS instructions).
- `scripts/test-push.sh` — envia push de prueba a un user-id.

## Validacion al cerrar

- [ ] Lighthouse PWA score >= 90 (`npx lighthouse https://tu-url --only-categories=pwa`).
- [ ] Instalable en Chrome desktop + Android (banner aparece).
- [ ] iOS Safari: agregar a pantalla de inicio funciona, app abre standalone.
- [ ] Push test funciona en Chrome desktop. iOS solo si > 16.4 + instalado.
- [ ] Subscriptions persisten en `push_subscriptions` table.
- [ ] Subscriptions invalidas (404/410) se purgan automatico al enviar.
