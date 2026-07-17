# Stack Recipe: mobile-expo

> **Compatibilidad Praxis**: `REPLACE_FRONT`
> **Plataforma objetivo**: iOS + Android (y opcionalmente Web via Expo Web)

## KEEP
- TypeScript (toda la logica compartible)
- Supabase (auth + DB + storage + realtime — `@supabase/supabase-js` funciona igual)
- Zod (validacion)
- Zustand (estado cliente)
- Vercel AI SDK v5 (si hay IA) — cuidado: streaming en RN requiere fetch polyfill
- `src/features/<logica>/` (tipado y logica pura portable)

## ADD
- `expo` ^53 + `react-native` ^0.76
- `expo-router` ^4 (file-based routing)
- `nativewind` ^4 (Tailwind para RN) + `tailwindcss` peer
- `react-native-reanimated` ^3 (animaciones)
- `react-native-gesture-handler`
- `expo-secure-store` (keychain/keystore para tokens)
- `expo-notifications` (push)
- `expo-image` (cache de imagenes)
- `@tanstack/react-query` ^5
- `react-hook-form` + `@hookform/resolvers`
- `expo-dev-client` (builds custom en desarrollo)
- `eas-cli` (builds + submissions)

## REPLACE
- `next` → `expo`
- `src/app/` (Next App Router) → `app/` (Expo Router) + `app/_layout.tsx`
- Tailwind PostCSS pipeline → NativeWind Babel plugin
- `next/image` → `expo-image`
- `next/font` → `expo-font` + `useFonts`
- `next/link` → `expo-router` `Link`
- `next/navigation` → `expo-router` `useRouter`, `useLocalSearchParams`
- Playwright → `maestro` (E2E mobile) o `detox`

## REMOVE
- `next`, `next.config.ts`, `postcss.config.js`
- `src/app/` (Next App Router)
- `src/core/adapters/supabase/server.ts` (no hay server Next — usar client en todas partes)
- `@next/*`, `eslint-config-next`

## CONFIG
- `app.json` (nombre, bundle id iOS, package Android, splash, iconos)
- `eas.json` (build profiles: development, preview, production)
- `babel.config.js` con `nativewind/babel`
- `metro.config.js` con `withNativeWind`
- `tailwind.config.ts` con `content: ['./app/**/*.{ts,tsx}']`
- `global.css` (Tailwind directives para NativeWind)
- `tsconfig.json` con `"extends": "expo/tsconfig.base"`

## Archivos Praxis a eliminar
- `next.config.ts`, `postcss.config.js`
- `src/app/` entero
- `src/core/adapters/supabase/server.ts`

## Archivos nuevos a crear
- `app/_layout.tsx`, `app/index.tsx`, `app/(auth)/login.tsx`, etc.
- `app.json`, `eas.json`
- `babel.config.js`, `metro.config.js`
- `global.css`

## IDE / Toolchain externo requerido
- **Xcode 16+** (macOS) para builds iOS local
- **Android Studio** (Arctic Fox o mas reciente) con SDK 34+
- Cuenta Apple Developer ($99/ano) para App Store / TestFlight
- Cuenta Google Play Developer ($25 unico) para Play Store
- **EAS** (alternativa cloud a builds locales, plan gratuito existe)
