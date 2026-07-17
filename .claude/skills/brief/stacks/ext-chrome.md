# Stack Recipe: ext-chrome

> **Compatibilidad Praxis**: `REPLACE`
> **Plataforma objetivo**: Chrome + Edge + Brave (Manifest V3), opcionalmente Firefox (adaptado)

## KEEP
- React 19 + TypeScript
- Tailwind CSS 3.4 (para popup/options/side panel UI)
- Zod (validacion mensajes background ↔ content)

## ADD
- **Vite** + **@crxjs/vite-plugin** (DX nativa para extensiones Chrome)
  - Alternativa: `wxt` (framework moderno para extensiones, soporta MV3)
- `@types/chrome`
- `react`, `react-dom`
- Opcional: `@vitest/ui` (tests)

## REPLACE
- `next` → `vite` + `@crxjs/vite-plugin` o `wxt`
- `src/app/` → entries por tipo: `src/popup/`, `src/options/`, `src/background/`, `src/content/`
- Routing web → router interno del popup (si hay)

## REMOVE
- `next`, `next.config.ts`
- `src/core/adapters/supabase/server.ts`
- Cualquier cosa que requiera Node server-side

## CONFIG
- `manifest.json` (Manifest V3) con:
  - `"manifest_version": 3`
  - `"permissions"` minimos necesarios
  - `"host_permissions"` (si inyecta en paginas)
  - `"background": { "service_worker": "src/background/index.ts" }`
  - `"content_scripts": [{ matches, js }]`
  - `"action": { "default_popup": "popup.html" }`
  - `"options_page"` o `"options_ui"`
- **Service Worker** (no background page persistente — limitacion MV3)
- **chrome.storage.sync / .local** en vez de localStorage (persistencia fiable)
- CSP estricto: `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'self'" }`

## Archivos Praxis a eliminar
- `next.config.ts`, `src/app/`, `src/core/adapters/supabase/server.ts`

## Archivos nuevos a crear
- `manifest.json` (o `wxt.config.ts` si WXT)
- `src/background/index.ts` (service worker)
- `src/content/index.ts` (content script si aplica)
- `src/popup/main.tsx` + `src/popup/App.tsx`
- `src/options/main.tsx` + `src/options/App.tsx`
- `vite.config.ts`

## IDE / Toolchain externo requerido
- **Node.js 20+**
- **Chrome Web Store Developer Account** ($5 unico) para publicar
- `chrome` para testing (cargar unpacked desde `chrome://extensions`)
- Opcional: `web-ext` de Mozilla para testing en Firefox
