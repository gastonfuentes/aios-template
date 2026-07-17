# Stack Recipe: mobile-ios-native

> **Compatibilidad Praxis**: `REPLACE`
> **Plataforma objetivo**: iOS 16+ (iPhone + iPad)

## KEEP
- Ninguno del stack web.
- Opcional: Supabase como backend remoto (hay cliente Swift oficial) si la app necesita sync.

## ADD
- **Xcode 16+**
- **Swift 6** + **Swift Package Manager**
- **SwiftUI** (UI moderna declarativa) — AppKit solo si hay control fino necesario
- `Observation` framework (reemplazo moderno de `@ObservableObject`)
- `SwiftData` o `CoreData` (persistencia local)
- `Swift Testing` + `XCTest` (tests)
- `supabase-swift` (si se usa Supabase)
- `KeychainAccess` (tokens seguros)
- Opcional: `Sentry-Cocoa` (crash reporting), `PostHog-iOS` (analytics)

## REPLACE
- Todo el stack web Praxis.

## REMOVE
- `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`
- `src/` entero (Next.js scaffold)
- `.mcp.json` con entries de `next-devtools` / `playwright` (irrelevantes)

## CONFIG
- Proyecto Xcode (`.xcodeproj` o `Package.swift` + `xcodeproj` para signing)
- `Info.plist` con permisos (`NSCameraUsageDescription`, etc. segun features)
- **Signing & Capabilities**: Team + entitlements
- **App Sandbox** + `Hardened Runtime` (obligatorios para notarization)
- Esquemas de build: Debug, Release
- CI: GitHub Actions con runner `macos-latest` (o Xcode Cloud)

## Archivos Praxis a eliminar
- `src/`, `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `components.json`

## Archivos nuevos a crear
- `<AppName>.xcodeproj/` (generado por Xcode)
- `<AppName>/App.swift` (entry point con `@main`)
- `<AppName>/Views/*.swift`
- `<AppName>/Models/*.swift`
- `<AppName>/Services/*.swift`
- `<AppName>Tests/` (Swift Testing)

## IDE / Toolchain externo requerido
- **Xcode 16+** (solo macOS — no corre en Windows/Linux)
- **Apple Developer Account** ($99/ano) para distribucion
- **Mac fisico o VM** (Xcode Cloud si no se tiene Mac)
