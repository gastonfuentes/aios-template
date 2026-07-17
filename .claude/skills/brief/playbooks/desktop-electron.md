# Playbook: desktop-electron

## Targets obligatorios
- **Ecosistema vs Tauri**: Electron mas maduro, mas docs, mas libs. Tauri menor footprint.
- **Security hardening**: `contextIsolation`, `nodeIntegration: false`, `sandbox: true`, CSP estricto.
- **Auto-update**: `electron-updater` con GitHub Releases, S3, o custom.
- **Code signing por OS**: misma lista que Tauri (Apple Developer $99, EV cert $200-500).
- **Distribucion**: dmg (mac), NSIS o MSI (win), AppImage/deb/rpm (linux).

## Targets opcionales
- **Mac App Store**: sandboxed builds con entitlements especificos — restricciones.
- **Microsoft Store**: MSIX packaging desde Electron.
- **Squirrel.Windows** como alternativa a NSIS.

## Busquedas sugeridas
- "Electron security best practices 2026"
- "electron-builder vs electron-forge"
- "electron-updater GitHub Releases"

## Fuentes primarias
- https://www.electronjs.org/docs/latest/tutorial/security
- https://www.electron.build (electron-builder)
- https://github.com/electron/forge (electron-forge)

## Riesgos a investigar activamente
- **Bundle size** ~200MB por OS — considerar costo de descarga primer usuario.
- **Memory** en macOS — Electron usa ~200-500MB baseline.
- **Chrome vulnerabilities**: update Electron frecuente, cada 8 semanas con Chromium upstream.
