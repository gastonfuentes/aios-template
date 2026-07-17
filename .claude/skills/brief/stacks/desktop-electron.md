# Stack Recipe: desktop-electron

> **Compatibilidad Praxis**: `PARTIAL` (reusa React/Tailwind/TypeScript, reemplaza Next.js por Vite + Electron main)
> **Plataforma objetivo**: macOS + Windows + Linux

## KEEP
- React 19 + TypeScript
- Tailwind CSS 3.4
- Zod + Zustand
- Supabase (cliente JS)

## ADD
- **Electron** ^34 + `electron-builder` (packaging)
- `electron-vite` (dev experience con Vite)
- `electron-updater` (auto-update, soporta GitHub Releases como CDN)
- `@electron-toolkit/preload` + `@electron-toolkit/utils`
- `electron-store` (persistencia local, alternativa a localStorage)
- **Contextual Isolation ON** + `contextBridge` (seguridad)
- Opcional: `electron-devtools-installer`

## REPLACE
- `next` → `electron-vite` + React
- `src/app/` → `src/renderer/` (UI) + `src/main/` (proceso principal Node) + `src/preload/` (bridge)
- Server Actions → IPC via `ipcMain.handle` + `ipcRenderer.invoke` (typed con contextBridge)

## REMOVE
- `next`, `next.config.ts`
- `src/app/`

## CONFIG
- `electron.vite.config.ts` (3 targets: main, preload, renderer)
- `electron-builder.yml` con targets: `dmg` (mac), `nsis` (win), `AppImage` + `deb` (linux)
- `contextIsolation: true`, `nodeIntegration: false` (hardening)
- Auto-update via GitHub Releases
- **Code signing**:
  - macOS: Apple Developer cert + notarytool (obligatorio para Gatekeeper)
  - Windows: EV cert (fuertemente recomendado, evita SmartScreen)
  - Linux: no hay signing estandar para AppImage (opcional gpg)

## Archivos Praxis a eliminar
- `next.config.ts`, `src/app/`

## Archivos nuevos a crear
- `src/main/index.ts` (main process con `BrowserWindow`)
- `src/preload/index.ts` (contextBridge)
- `src/renderer/` (React app)
- `electron.vite.config.ts`
- `electron-builder.yml`

## IDE / Toolchain externo requerido
- **Node.js 20+**
- Apple Developer cert + notarytool (macOS)
- EV code signing cert (Windows — $200-500/ano)
