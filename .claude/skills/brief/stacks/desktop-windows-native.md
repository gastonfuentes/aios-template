# Stack Recipe: desktop-windows-native

> **Compatibilidad Praxis**: `REPLACE` (total)
> **Plataforma objetivo**: Windows 10 20H2+ / Windows 11

## Variantes (elegir una durante el brief)

1. **WinUI 3 + C#** (recomendada Microsoft, moderna) — default
2. **WPF + C#** (madura, XAML, ecosistema enorme)
3. **Avalonia + C#** (opcion cross-platform futura)
4. **Win32 + C++** (solo si hay razon dura: drivers, performance extrema)

Por defecto esta receta asume **WinUI 3 + C# + .NET 9**.

## KEEP
- Ninguno del stack web.

## ADD (variante WinUI 3)
- **Visual Studio 2022** (o Rider) — Windows
- **.NET 9** + **C# 13**
- **Windows App SDK** (ultima version estable)
- **WinUI 3** (`Microsoft.WindowsAppSDK`)
- **CommunityToolkit.Mvvm** (MVVM helpers)
- **CommunityToolkit.WinUI** (controles extra)
- `Microsoft.EntityFrameworkCore.Sqlite` (persistencia local) o LiteDB
- `xUnit` + `FluentAssertions` (tests)
- `Microsoft.Windows.CsWin32` (generar P/Invoke tipado si se usa Win32 API)
- Opcional: Sentry .NET, Serilog

## REPLACE
- Todo el stack web.

## REMOVE
- `src/`, `package.json`, `tsconfig.json`, Tailwind/PostCSS configs
- `.mcp.json` entries irrelevantes

## CONFIG
- `.csproj` con `TargetFramework=net9.0-windows10.0.19041.0`
- `.sln` (solution)
- `Package.appxmanifest` (bundle, capabilities, visual assets)
- **MSIX packaging** (recomendado, soporta Microsoft Store + sideload)
- Alternativa: installer clasico con **WiX Toolset** o **Inno Setup**
- **Code signing**:
  - Microsoft Store: certificado gestionado por el Store (sin costo extra)
  - Sideload: EV cert recomendado (evita SmartScreen warning) — $200-500/ano
- CI: GitHub Actions con `windows-latest` runner

## Archivos Praxis a eliminar
- `src/`, `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`

## Archivos nuevos a crear
- `<AppName>/App.xaml` + `App.xaml.cs`
- `<AppName>/MainWindow.xaml` + `.cs`
- `<AppName>/Views/`, `<AppName>/ViewModels/`, `<AppName>/Models/`
- `<AppName>.csproj`, `<AppName>.sln`
- `Package.appxmanifest`
- `<AppName>.Tests/`

## IDE / Toolchain externo requerido
- **Visual Studio 2022** (Community gratis) o **JetBrains Rider**
- **Windows 10/11** para desarrollo visual (VMs OK)
- **Windows SDK** (ultima)
- Code signing cert si distribucion fuera del Store
- **Microsoft Partner Center Account** ($19 individual / $99 empresa) para Microsoft Store
