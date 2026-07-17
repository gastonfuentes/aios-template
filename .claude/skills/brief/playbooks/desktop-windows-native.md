# Playbook: desktop-windows-native

## Targets obligatorios
- **WinUI 3 vs WPF vs Avalonia** en 2026: WinUI 3 direccion oficial Microsoft, WPF maduro pero legacy, Avalonia cross-platform moderno.
- **Target Windows version**: Windows 10 20H2+ o solo Windows 11 (features como fluent acrylic requieren 11).
- **Packaging**: MSIX (moderno, soporta Store + sideload) vs installer clasico (WiX, Inno Setup, NSIS).
- **Code signing**: EV cert ($200-500/ano, Sectigo/DigiCert). Sin EV → SmartScreen warning bloquea a usuarios.
- **Microsoft Store**: Partner Center account ($19 individual / $99 empresa), review relativamente rapida.
- **CI runner**: GitHub Actions `windows-latest` (free 2000 mins/mes OSS).

## Targets opcionales
- **MSIX Core** para Windows 10 sin store updates.
- **Windows App Attest** para apps gubernamentales/enterprise.
- **.NET AOT** para reducir startup time.

## Busquedas sugeridas
- "WinUI 3 vs WPF 2026"
- "MSIX packaging tutorial"
- "EV code signing certificate cost 2026"
- "SmartScreen reputation new app"

## Fuentes primarias
- https://learn.microsoft.com/windows/apps/winui/winui3/
- https://learn.microsoft.com/windows/msix/overview
- https://learn.microsoft.com/windows/apps/publish/

## Riesgos a investigar activamente
- **SmartScreen reputation**: nuevos certs toman 1-3 meses acumulando "confianza" — users primeros ven warning.
- **Visual Studio license**: Community gratis para OSS / individual / < $1M. Enterprise / organization grande requiere Professional.
- **ARM Windows**: Snapdragon laptops crecen, verificar que el build soporta ARM64.
