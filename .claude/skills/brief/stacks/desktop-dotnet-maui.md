# Stack Recipe: desktop-dotnet-maui

> **Compatibilidad Praxis**: `REPLACE`
> **Plataforma objetivo**: macOS + Windows (+ iOS + Android opcional)

## KEEP
- Ninguno del stack web.

## ADD
- **.NET 9 + C# 13**
- **.NET MAUI** ultimo estable
- **Visual Studio 2022** (Windows) o **Rider** (mac/win/linux)
- **MVVM**: `CommunityToolkit.Mvvm`
- `CommunityToolkit.Maui` (controles extra)
- `sqlite-net-pcl` (DB local) o EF Core SQLite
- `xUnit` + `MAUI Test`
- Opcional: Sentry .NET, Serilog

## REPLACE
- Todo el stack web.

## REMOVE
- `src/`, `package.json`, `tsconfig.json`, Tailwind/PostCSS

## CONFIG
- `<AppName>.csproj` con `TargetFrameworks=net9.0-maccatalyst;net9.0-windows10.0.19041.0`
- `Platforms/MacCatalyst/`, `Platforms/Windows/` (entry points por OS)
- `AppShell.xaml` (navegacion)
- **Code signing**:
  - macOS (MacCatalyst): Apple Developer cert + notarization
  - Windows: EV cert recomendado (similar WinUI 3)
- CI: `dotnet build -f <tfm>` en runners matching

## Archivos Praxis a eliminar
- `src/`, `package.json`, `tsconfig.json`, `next.config.ts`, Tailwind configs

## Archivos nuevos a crear
- `<AppName>.csproj`
- `MauiProgram.cs`, `App.xaml`, `AppShell.xaml`
- `Views/`, `ViewModels/`, `Models/`
- `Platforms/MacCatalyst/Info.plist`
- `Platforms/Windows/Package.appxmanifest`

## IDE / Toolchain externo requerido
- **Visual Studio 2022** con workload MAUI (Windows) o **Rider** (mac/win)
- **.NET 9 SDK**
- Para MacCatalyst: **Xcode 16+** (solo macOS)
- Apple Developer Account ($99/ano) si se distribuye en Mac App Store
- Microsoft Partner Center ($19/99) si se distribuye en Microsoft Store
