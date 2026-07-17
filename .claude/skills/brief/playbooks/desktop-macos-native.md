# Playbook: desktop-macos-native

## Targets obligatorios
- **SwiftUI vs AppKit** en 2026: SwiftUI para apps nuevas, AppKit para control fino (menus, document-based apps, windows flotantes).
- **macOS version target** (Sonoma 14+ vs Sequoia 15+): trade-off entre features y cobertura de usuarios.
- **Apple Developer Program ($99/ano)**: obligatorio para notarization + Mac App Store.
- **Notarization**: flujo con `xcrun notarytool submit --wait`, signing con Developer ID Application cert.
- **Distribucion paths**:
  - **Mac App Store**: mas friccion (sandbox estricto, 30% fee, review), menos acceso a APIs.
  - **DMG directa + Sparkle**: sin review, acceso total al sistema, responsabilidad de updates propia.
- **App Sandbox + Hardened Runtime**: requeridos para notarization; implica entitlements explicitos.
- **CI runner**: GitHub Actions `macos-latest` (free 2000 mins/mes OSS), Xcode Cloud, Bitrise.

## Targets opcionales
- **Universal binary** (Intel + Apple Silicon): `arm64 x86_64` archive.
- **Sparkle appcast** con firmas EdDSA.
- **Widgets / Shortcuts App Intents**: requieren SwiftUI + Swift moderno.

## Busquedas sugeridas
- "SwiftUI macOS app 2026"
- "Apple notarization notarytool CLI"
- "Sparkle framework Swift 2026"
- "Mac App Store vs DMG distribution"

## Fuentes primarias
- https://developer.apple.com/documentation/swiftui
- https://developer.apple.com/documentation/security/notarizing_macos_software
- https://sparkle-project.org

## Riesgos a investigar activamente
- **Gatekeeper / "app no verificada"**: si no notarizas, usuarios ven warning que mata la conversion.
- **Rechazo en Mac App Store**: razones mas comunes — sandbox violations, thin apps, categorias equivocadas.
- **Xcode project file conflicts** en git: considerar XcodeGen o Tuist para definir proyectos en texto.
