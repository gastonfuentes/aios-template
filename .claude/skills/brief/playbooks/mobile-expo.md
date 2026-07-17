# Playbook: mobile-expo

## Targets obligatorios
- **Expo SDK version actual** y politicas de upgrade: cada 3-4 meses, breaking changes manejables.
- **Expo Router vs React Navigation puro**: Expo Router recomendado 2026.
- **Build service**: EAS Build (cloud, gratis con limites) vs local Xcode/Android Studio.
- **App Store review**: tiempo promedio (24-48h iOS, 2-3h Android post primera vez), razones comunes de rechazo.
- **Apple Developer ($99/ano)** + **Google Play Developer ($25 unico)**: costos confirmados.
- **Push notifications**: Expo Notifications vs FCM puro.
- **OTA updates**: EAS Update (JS bundle sin review Apple).

## Targets opcionales
- **Dev build vs Expo Go**: dev build necesario si hay native modules no incluidos.
- **Monorepo con Expo + Next.js**: Solito pattern.
- **Offline-first**: WatermelonDB, RxDB, PowerSync, Supabase offline.

## Busquedas sugeridas
- "Expo SDK 53 release notes"
- "Expo Router vs React Navigation 2026"
- "EAS Build free tier limits"
- "App Store review rejection common reasons 2026"

## Fuentes primarias
- https://docs.expo.dev
- https://docs.expo.dev/router/introduction/
- https://docs.expo.dev/eas/

## Riesgos a investigar activamente
- **iOS privacy manifests**: desde 2024 obligatorios — enumerar SDKs de terceros.
- **Native modules custom**: requieren Dev Build (no Expo Go) — complejidad adicional.
- **Expo Go limitaciones**: muchas libs populares no corren (sharing, etc.) — planear Dev Build.
