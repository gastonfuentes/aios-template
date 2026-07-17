# Stack Recipe: desktop-linux-native

> **Compatibilidad Praxis**: `REPLACE` (total)
> **Plataforma objetivo**: Linux (Ubuntu 22.04+, Fedora 40+, Arch rolling)

## Variantes (elegir una durante el brief)

1. **GTK4 + Rust (gtk-rs)** — idiomatico GNOME, binario pequeno — default
2. **GTK4 + Python (PyGObject)** — prototipado rapido
3. **Qt 6 + C++** (opcion QML) — portabilidad a Windows/macOS gratis
4. **Iced / Slint (Rust)** — UI moderna retained-mode sin X/Wayland pain

Por defecto esta receta asume **GTK4 + Rust**.

## KEEP
- Ninguno del stack web.

## ADD (variante GTK4 + Rust)
- **Rust 1.80+** + Cargo
- **gtk4-rs** (`gtk4`, `glib`, `gio`, `adw` via `libadwaita-rs`)
- **meson** + **ninja** (build system idiomatico GNOME)
- **blueprint-compiler** (markup declarativo para GTK UI)
- `sqlx` o `rusqlite` (SQL local)
- Opcional: `relm4` (framework Elm-like sobre GTK4)

## REPLACE
- Todo el stack web.

## REMOVE
- `src/`, `package.json`, `tsconfig.json`, Tailwind/PostCSS configs

## CONFIG
- `meson.build` (build system)
- `<app>.desktop` file (menu integration)
- `<app>.appdata.xml` (AppStream metadata — obligatorio Flathub)
- Iconos en `data/icons/hicolor/`
- **Distribucion** (elegir una o varias):
  - **Flatpak** + Flathub (mas portable, sandboxed) — manifest `<app>.json` o `<app>.yaml`
  - **Snap** (Ubuntu-first, sandboxed)
  - **AppImage** (portable sin dependencias)
  - `.deb` (Debian/Ubuntu) + `.rpm` (Fedora/RHEL) via empaquetado directo
- Wayland-first, X11 via XWayland compatibility
- CI: GitHub Actions con `ubuntu-latest`

## Archivos Praxis a eliminar
- `src/`, `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`

## Archivos nuevos a crear
- `src/main.rs`
- `src/ui/window.blp` (Blueprint) o `.ui` (XML)
- `meson.build`
- `data/<app>.desktop`
- `data/<app>.appdata.xml`
- `data/<app>.metainfo.xml`
- `<app>.flatpak.yaml` (si Flathub)

## IDE / Toolchain externo requerido
- **Rust toolchain** (`rustup`)
- **GTK4 dev libs**: `apt install libgtk-4-dev libadwaita-1-dev` (Debian/Ubuntu)
- **Meson + Ninja**
- **GNOME Builder** o **VS Code** con extensiones rust-analyzer + Blueprint
- Opcional: **flatpak-builder** (local Flatpak builds)
