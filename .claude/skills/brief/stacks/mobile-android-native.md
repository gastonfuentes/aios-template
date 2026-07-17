# Stack Recipe: mobile-android-native

> **Compatibilidad Praxis**: `REPLACE`
> **Plataforma objetivo**: Android 10+ (API 29+)

## KEEP
- Ninguno del stack web.
- Opcional: Supabase como backend (hay cliente Kotlin oficial).

## ADD
- **Android Studio Ladybug** o mas reciente
- **Kotlin 2.0+** con Gradle Kotlin DSL
- **Jetpack Compose** (UI declarativa moderna)
- **Material 3** (`androidx.compose.material3`)
- `Hilt` (DI) o `Koin`
- `Room` (SQL local) + `DataStore` (preferences)
- `Retrofit` + `Moshi` / `Kotlinx.serialization` (API)
- `Coil` (imagenes)
- `Navigation Compose`
- `ViewModel` + `StateFlow`
- `supabase-kt` (si se usa Supabase)
- Opcional: Firebase Crashlytics, Sentry Android

## REPLACE
- Todo el stack web Praxis.

## REMOVE
- `src/`, `package.json`, `tsconfig.json`, Tailwind/PostCSS configs
- `.mcp.json` con entries de `next-devtools` / `playwright`

## CONFIG
- `build.gradle.kts` (app + project)
- `settings.gradle.kts` con dependencyResolutionManagement
- `AndroidManifest.xml` (permisos segun features)
- `proguard-rules.pro` (obfuscation release)
- Signing config (keystore + alias + passwords en `gradle.properties` o CI secret)
- CI: GitHub Actions con `actions/setup-java@v4` + `ubuntu-latest` (Android builds funcionan en Linux)

## Archivos Praxis a eliminar
- `src/`, `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`

## Archivos nuevos a crear
- `app/src/main/java/<package>/MainActivity.kt`
- `app/src/main/java/<package>/ui/` (Composable screens)
- `app/src/main/java/<package>/data/` (repositorios + DB)
- `app/src/main/AndroidManifest.xml`
- `app/build.gradle.kts`, `settings.gradle.kts`

## IDE / Toolchain externo requerido
- **Android Studio** (gratis, cross-platform)
- **JDK 17+**
- **Google Play Developer Account** ($25 unico) para Play Store
- **Keystore** para signing de releases (generar con `keytool`)
