# Playbook: desktop-tauri

## Targets obligatorios
- **Tauri 2 status**: estable, feature-complete, plugins oficiales.
- **Bundle size vs Electron**: Tauri ~3-10MB vs Electron ~100-200MB (dependiendo de features).
- **WebView por OS**: macOS (WKWebView), Windows (WebView2), Linux (webkit2gtk) — diferencias de rendering.
- **Code signing por OS**: costos y proceso (Apple $99, EV cert $200-500).
- **Auto-update**: plugin oficial con signatures Ed25519.

## Targets opcionales
- **Sidecar binaries**: si la app necesita ejecutar binarios externos (ffmpeg, python).
- **System tray**: plugin oficial `@tauri-apps/plugin-tray`.
- **Deep linking**: `tauri://` custom protocol.

## Busquedas sugeridas
- "Tauri 2 vs Electron 2026 comparison"
- "Tauri updater setup"
- "webkit2gtk vs Blink rendering differences"

## Fuentes primarias
- https://tauri.app/v2/
- https://v2.tauri.app/plugin/updater/
- https://v2.tauri.app/concept/security/

## Riesgos a investigar activamente
- **WebView quirks Linux**: webkit2gtk atrasa features web modernas (WebGPU, algunos CSS).
- **Security**: allowlist restrictivo + CSP obligatorio.
- **Rust learning curve**: si el equipo es solo JS, la capa Rust puede ser friccion.
