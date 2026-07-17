# Stack Recipe: desktop-macos-native

> **Compatibilidad Praxis**: `REPLACE` (total)
> **Plataforma objetivo**: macOS 14+ (Sonoma) idealmente 15+ (Sequoia)

## KEEP
- Ninguno del stack web.
- Opcional: Supabase como backend remoto (`supabase-swift`) si hay sync cloud.

## ADD
- **Xcode 16+** con **Swift 6**
- **SwiftUI** (UI declarativa, default para apps nuevas)
- **AppKit** solo cuando se necesita control fino (menus, toolbars personalizadas, NSDocument)
- `Swift Package Manager` (gestion de deps)
- `SwiftData` o `CoreData` (persistencia local)
- `Swift Testing` + `XCTest`
- `Sparkle` ^2 (auto-update si distribucion fuera de Mac App Store)
- `Keychain Services` (secrets)
- Opcional: `Sentry-Cocoa`, `PostHog-iOS` (compatible con macOS)
- Opcional: `Defaults` (Sindre Sorhus) — wrapper tipado de UserDefaults

## REPLACE
- Todo el stack web.

## REMOVE
- `package.json`, `tsconfig.json`, Tailwind/PostCSS
- `src/` entero
- `.mcp.json` entries irrelevantes

## CONFIG
- Proyecto Xcode o `Package.swift`
- `Info.plist` (bundle id, category, minimum system version)
- **Signing & Capabilities**:
  - Apple Developer Team ID
  - `App Sandbox` (obligatorio Mac App Store, opcional fuera)
  - `Hardened Runtime` (obligatorio para notarization)
  - Entitlements segun features (network, file access, camera, etc.)
- **Notarization** via `xcrun notarytool submit --apple-id ... --team-id ... --wait`
- **Distribucion**:
  - Mac App Store: archive → upload en Xcode Organizer
  - DMG directa: `create-dmg` + Sparkle appcast
- CI: GitHub Actions con `macos-latest` runner

## Archivos Praxis a eliminar
- `src/`, `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `components.json`

## Archivos nuevos a crear
- `<AppName>.xcodeproj/` (o `Package.swift`)
- `<AppName>/App.swift`
- `<AppName>/ContentView.swift`
- `<AppName>/Models/`, `<AppName>/Services/`, `<AppName>/Views/`
- `<AppName>Tests/`
- `.github/workflows/release.yml` (si se quiere CI)

## IDE / Toolchain externo requerido
- **Xcode 16+** (solo macOS)
- **Mac fisico** (Xcode no corre en Windows/Linux; alternativa: runners GitHub Actions macos-latest)
- **Apple Developer Account** ($99/ano) — obligatorio para notarization y Mac App Store
- **`create-dmg`** via Homebrew (si distribucion directa)
