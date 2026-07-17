# Playbook: mobile-ios-native

## Targets obligatorios
- **SwiftUI vs UIKit** en 2026: SwiftUI estable para apps nuevas, UIKit aun para casos complejos (table view performance extrema, tooling maduro).
- **Target minimum iOS version** (13? 15? 16? 17?): cubre 95%+ de dispositivos activos pero corta a algunos usuarios viejos.
- **Apple Developer Program ($99/ano)**: obligatorio para TestFlight + App Store.
- **App Store review**: tiempo promedio 24-48h primera vez, razones comunes de rechazo (privacy, dark patterns, login required).
- **Privacy Nutrition Labels + Privacy Manifest** (obligatorio desde 2024): enumerar data collected + SDKs usados.
- **Signing & notarization flow** para distribucion: Xcode Organizer o notarytool CLI.

## Targets opcionales
- **TestFlight**: distribucion beta interna (hasta 100 testers internos) y externa (10k) con review ligera.
- **In-App Purchases**: StoreKit 2 (moderno, async/await).
- **Analytics privados**: PostHog-iOS o self-hosted para evitar rechazo SKAdNetwork.

## Busquedas sugeridas
- "SwiftUI vs UIKit 2026"
- "iOS App Store Privacy Manifest"
- "StoreKit 2 best practices"
- "App Store rejection reasons 2026"

## Fuentes primarias
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/documentation/bundleresources/privacy_manifest_files
- https://developer.apple.com/documentation/storekit

## Riesgos a investigar activamente
- **Rechazo** por "thin app" (muy parecida a un website) — ofrecer features iOS-native.
- **IDFA + ATT**: si hay tracking, App Tracking Transparency prompt obligatorio.
- **30% fee Apple** en IAP — no se puede evitar para digital goods.
