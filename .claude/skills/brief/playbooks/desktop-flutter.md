# Playbook: desktop-flutter

## Targets obligatorios
- **Flutter Desktop status** en 2026: mac/win estable, linux en beta avanzada.
- **Limitations vs nativo**: tree-shaking, font rendering, menus nativos (FluentUI/Cupertino/Material).
- **Code signing por OS**: misma lista que nativos (Apple cert, EV cert Windows).
- **Size del binario**: Flutter agrega runtime Dart + Skia (~20-50MB).
- **CI** matrix build: Ubuntu runners no bastan para mac/win — necesitas macos-latest y windows-latest.

## Targets opcionales
- **Flutter Mobile compartir codigo**: 90%+ shared, 10% platform-specific UI.
- **FFI** para llamar C/Rust si performance critica.

## Busquedas sugeridas
- "Flutter Desktop production apps 2026"
- "Flutter Windows distribution MSIX"
- "Flutter macOS notarization"

## Fuentes primarias
- https://docs.flutter.dev/platform-integration/desktop
- https://docs.flutter.dev/deployment/windows
- https://docs.flutter.dev/deployment/macos

## Riesgos a investigar activamente
- **Uncommon Flutter + Desktop issues**: menu bars, trays, file dialogs nativos — plugins terceros.
- **Talento**: encontrar devs Flutter senior es mas dificil que web/swift/c#.
