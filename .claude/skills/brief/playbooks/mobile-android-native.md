# Playbook: mobile-android-native

## Targets obligatorios
- **Jetpack Compose vs XML Views**: Compose es la direccion oficial 2026; XML aun en legacy.
- **Target API level**: Play Store obliga target API al ultimo (35+ en 2026). Update cada ano.
- **Google Play Developer ($25 unico)**: obligatorio para publicar.
- **Play Store review**: 2-3 horas primera vez, instant despues en updates simples.
- **Signing con Play App Signing**: Google gestiona el keystore, tu subes un upload key.
- **Data Safety section** obligatoria en Play Console.

## Targets opcionales
- **Foldables & large screens**: soporte obligatorio en Play Store a partir de 2024 para visibilidad optima.
- **Wear OS** companion app.
- **Play Billing** para in-app purchases (15-30% fee como Apple).

## Busquedas sugeridas
- "Jetpack Compose vs Views 2026"
- "Android target API requirement 2026"
- "Play Store Data Safety section"

## Fuentes primarias
- https://developer.android.com/jetpack/compose
- https://support.google.com/googleplay/android-developer/answer/9859152 (target API)
- https://developer.android.com/google/play/billing

## Riesgos a investigar activamente
- **Compose performance**: tener cuidado con recompositions. Baseline Profiles para hot paths.
- **App size**: Google Play recomienda < 150MB (app bundle), sobre eso requiere install manual.
- **Fragmentacion de dispositivos**: testear en 3+ densidades de pantalla (mdpi, hdpi, xxhdpi).
