# Stack Recipe: desktop-flutter

> **Compatibilidad Praxis**: `REPLACE`
> **Plataforma objetivo**: macOS + Windows + Linux (opcionalmente iOS + Android con el mismo codigo)

## KEEP
- Ninguno del stack web.

## ADD
- **Flutter SDK** ultima estable (canal stable)
- **Dart 3.5+**
- `go_router` ^14 (routing declarativo)
- `riverpod` ^2 o `bloc` (state management)
- `freezed` + `json_serializable` (modelos inmutables)
- `dio` (HTTP client)
- `supabase_flutter` (si se usa Supabase)
- `flutter_secure_storage` (secrets)
- `drift` o `isar` (DB local)

## REPLACE
- Todo el stack web.

## REMOVE
- `src/`, `package.json`, `tsconfig.json`, Tailwind/PostCSS

## CONFIG
- `pubspec.yaml` (dependencias + assets)
- `flutter config --enable-macos-desktop --enable-windows-desktop --enable-linux-desktop`
- Platform-specific folders generados: `macos/`, `windows/`, `linux/`
- **Code signing**:
  - macOS: notarization requerida (ver `desktop-macos-native.md`)
  - Windows: EV cert recomendado
- CI: matrix build en GitHub Actions (macos + windows + ubuntu)

## Archivos Praxis a eliminar
- `src/`, `package.json`, `tsconfig.json`, `next.config.ts`, Tailwind configs

## Archivos nuevos a crear
- `lib/main.dart`
- `lib/app/`, `lib/features/`, `lib/shared/`
- `pubspec.yaml`
- `test/` (Flutter tests)

## IDE / Toolchain externo requerido
- **Flutter SDK** (cross-platform)
- **Android Studio** con Flutter plugin o **VS Code** con Flutter extension
- Para macOS build: Xcode CLT
- Para Windows build: Visual Studio 2022 con workload "Desktop development with C++"
- Para Linux build: `clang`, `cmake`, `ninja`, `pkg-config`, GTK3 libs
