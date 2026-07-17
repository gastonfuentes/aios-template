# Stack Recipe: desktop-tauri

> **Compatibilidad Praxis**: `PARTIAL` (reusa React/Tailwind/TypeScript/Zod/Zustand, reemplaza Next.js por Vite + Rust)
> **Plataforma objetivo**: macOS + Windows + Linux (binario unico por OS)

## KEEP
- React 19 + TypeScript
- Tailwind CSS 3.4
- Zod (validacion en UI)
- Zustand (estado cliente)
- `@tanstack/react-query` si se usa
- Supabase (cliente JS — si hay backend remoto)

## ADD
- **Rust 1.80+** (toolchain completo: `rustup`, `cargo`)
- **Tauri 2**: `@tauri-apps/api` + `@tauri-apps/cli` + crates `tauri` + `tauri-build`
- **Vite** + `@vitejs/plugin-react` (reemplaza el bundler de Next)
- `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-shell`, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-store` (segun features)
- `@tauri-apps/plugin-updater` (auto-update)
- `@tauri-apps/plugin-notification`

## REPLACE
- `next` → `vite` + `@vitejs/plugin-react`
- `src/app/` (App Router) → `src/` con `main.tsx` + React Router / TanStack Router
- `next/server` / Server Actions → **Tauri commands** en Rust (`#[tauri::command]`) invocadas con `invoke('cmd_name', {...})`
- `next/image` → `<img>` clasico (Vite)
- `next/font` → `@fontsource/*`

## REMOVE
- `next`, `next.config.ts`
- `src/app/` (App Router)
- `src/core/adapters/supabase/server.ts` (no hay SSR)

## CONFIG
- `src-tauri/tauri.conf.json` (permisos, bundle, updater)
- `src-tauri/Cargo.toml`
- `src-tauri/src/main.rs` con `tauri::Builder::default().run(...)`
- `vite.config.ts` (root + build.outDir)
- Tauri allowlist CSP estricto
- **Code signing** por OS:
  - macOS: Apple Developer cert + notarytool
  - Windows: EV cert (Sectigo / DigiCert)
  - Linux: firma gpg para AppImage (opcional)

## Archivos Praxis a eliminar
- `next.config.ts`
- `src/app/` entero
- `src/core/adapters/supabase/server.ts`

## Archivos nuevos a crear
- `src-tauri/` (todo el runtime Rust)
- `src/main.tsx` (entry point Vite)
- `vite.config.ts`
- `index.html` en la raiz del proyecto Vite

## IDE / Toolchain externo requerido
- **Rust toolchain** (`rustup`, `cargo`) — cross-platform
- **Xcode CLT** (macOS, para builds de DMG)
- **WebView2** (Windows, preinstalado en Win 11)
- **webkit2gtk** libs (Linux)
- Code signing certs (costos variables por OS)
