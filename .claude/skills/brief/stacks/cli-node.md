# Stack Recipe: cli-node

> **Compatibilidad Praxis**: `REPLACE`
> **Plataforma objetivo**: macOS + Windows + Linux (Node 20+)

## KEEP
- TypeScript

## ADD
- **Node.js 20+**
- **Commander** ^12 (parser de args) — alternativa: **Yargs** o **Oclif** (plugins)
- **Inquirer** ^10 o **@clack/prompts** (prompts interactivos — @clack es mas moderno)
- **chalk** ^5 (colores)
- **ora** (spinners)
- **zod** (validacion de input)
- **tsup** (builds pequenos y rapidos — compila a CJS/ESM/dts)
  - Alternativa: **unbuild**, **pkgroll**
- Opcional: **cosmiconfig** (leer config de varios formatos)
- Opcional: **@clack/core** para UI personalizadas

## REPLACE
- Todo el stack web.

## REMOVE
- `src/app/`, `src/core/adapters/supabase/`, `public/`
- Tailwind configs
- `next.config.ts`

## CONFIG
- `package.json` con:
  - `"type": "module"` (ESM) o CJS
  - `"bin": { "<cmd-name>": "./dist/index.js" }` (hace el binario)
  - Shebang en el entry file: `#!/usr/bin/env node`
  - `"files": ["dist"]` (que se publique a npm)
- `tsconfig.json` con `"module": "ESNext"`, `"moduleResolution": "Bundler"`
- `tsup.config.ts` con entry + formats + dts
- Tests: `vitest`

## Archivos Praxis a eliminar
- `src/app/`, `src/lib/`, `public/`, Tailwind configs, `next.config.ts`

## Archivos nuevos a crear
- `src/index.ts` (entry con shebang)
- `src/commands/*.ts`
- `src/utils/*.ts`
- `tsup.config.ts`

## IDE / Toolchain externo requerido
- **Node.js 20+**
- Cuenta **npm** (publicar: `npm publish`)
- Opcional: **changesets** para versioning
