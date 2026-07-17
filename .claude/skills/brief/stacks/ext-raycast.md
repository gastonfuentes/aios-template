# Stack Recipe: ext-raycast

> **Compatibilidad Praxis**: `REPLACE`
> **Plataforma objetivo**: macOS (Raycast)

## KEEP
- TypeScript (estricto)
- Zod (validacion de forms y preferences)

## ADD
- **Raycast API** via `@raycast/api` (provisto por el IDE Raycast)
- **`@raycast/utils`** (helpers: `useFetch`, `useCachedPromise`, `getPreferenceValues`)
- **React 18** (viene del SDK Raycast)
- `ray` CLI (instalado via `npm install -g @raycast/api` o viene con Raycast)

## REPLACE
- Todo el stack web.

## REMOVE
- `src/app/`, `src/lib/`, Tailwind configs
- `next.config.ts`

## CONFIG
- `package.json` con:
  - `"commands"` array: cada comando con `name`, `title`, `mode: "view" | "no-view"`, `subtitle`, `description`, `icon`
  - `"preferences"` (config expuesta al usuario)
  - `"tools"` (para Raycast AI commands, opcional)
  - `"dependencies": { "@raycast/api": "...", "@raycast/utils": "..." }`
- `tsconfig.json` con `"jsx": "react-jsx"`, `"target": "ES2022"`
- Iconos en `assets/` (1024x1024 @ para icono principal, 512x512 por comando)
- NO hay bundler propio — Raycast lo maneja via `ray build`

## Archivos Praxis a eliminar
- `src/`, `public/`, `next.config.ts`, Tailwind configs

## Archivos nuevos a crear
- `src/<command-name>.tsx` (un archivo por comando, exporta default)
- `assets/command-icon.png`
- `package.json` (formato Raycast)

## IDE / Toolchain externo requerido
- **Raycast app** instalada (solo macOS) — tier gratuito existe, Pro $8/mes
- **Node.js 20+**
- Cuenta en Raycast Store (gratis) para publicar extensiones
- `ray` CLI (`ray develop`, `ray build`, `ray publish`)
