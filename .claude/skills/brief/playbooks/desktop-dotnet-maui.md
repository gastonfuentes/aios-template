# Playbook: desktop-dotnet-maui

## Targets obligatorios
- **.NET MAUI status** en 2026: estable para Windows + MacCatalyst. Linux solo via community (Uno Platform alternativa).
- **MAUI vs Avalonia**: MAUI oficial MS pero mas tied a Windows/Mac; Avalonia cross-platform mas amplio (incluye Linux).
- **MacCatalyst** limitations: corre UIKit styling en Mac (no nativo-nativo). Parece "iOS app en Mac".
- **Code signing**: mac (Apple cert) + windows (EV cert).
- **CI matrix**: `dotnet build` en runners matching por OS.

## Targets opcionales
- **Shared code con Xamarin.Forms legacy** si vienes de ahi.
- **Blazor Hybrid** (MAUI + WebView con componentes Blazor).

## Busquedas sugeridas
- "MAUI vs Avalonia 2026"
- "MacCatalyst MAUI limitations"
- "MAUI production apps examples"

## Fuentes primarias
- https://learn.microsoft.com/dotnet/maui/
- https://avaloniaui.net (alternativa)

## Riesgos a investigar activamente
- **Linux no soportado oficialmente**: si Linux es must-have → Avalonia.
- **MacCatalyst UX** no es macOS-nativo de verdad — evaluar si es aceptable.
