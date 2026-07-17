# Playbook: desktop-linux-native

## Targets obligatorios
- **Toolkit**: GTK4 (idiomatico GNOME), Qt6 (cross-platform KDE), Iced/Slint (Rust moderno). Tradeoff de ecosistema.
- **Lenguaje**: Rust (gtk-rs) vs C++ (Qt) vs Python (PyGObject rapido de prototipar pero con overhead).
- **Formato de distribucion**:
  - **Flatpak + Flathub**: mas portable, sandboxed, mejor UX de usuario final.
  - **Snap**: Ubuntu-first, sandboxed, auto-update, controversial fuera de Ubuntu.
  - **AppImage**: portable sin install, menos UX.
  - **deb/rpm**: tradicional, distribucion por distro.
- **Wayland vs X11**: Wayland es la direccion (GNOME 46+, KDE Plasma 6 default); X11 aun mayoritario via XWayland.
- **CI runner**: GitHub Actions `ubuntu-latest` (free 2000 mins/mes OSS).

## Targets opcionales
- **GNOME HIG vs Breeze (KDE)**: adaptar look & feel segun target.
- **libadwaita** para apps GNOME modernas.
- **Portals** (xdg-desktop-portal) para features sandboxed (file picker, notifications).

## Busquedas sugeridas
- "GTK4 rs vs Qt 6 C++ 2026"
- "Flatpak Flathub submission process"
- "libadwaita best practices"
- "Wayland Linux desktop apps 2026"

## Fuentes primarias
- https://gtk-rs.org
- https://docs.flatpak.org
- https://developer.gnome.org/documentation/

## Riesgos a investigar activamente
- **Fragmentacion**: distros multiples (Ubuntu/Fedora/Arch/Debian) con versiones diferentes de libs — Flatpak/Snap ayudan.
- **Flathub review time**: 1-2 semanas la primera vez, reviewer feedback iterativo.
- **Performance con Wayland** vs X11: algunos tools viejos (screen sharing, remote) aun dependen de X11.
