# Stack Recipe: ext-vscode

> **Compatibilidad Praxis**: `REPLACE`
> **Plataforma objetivo**: VS Code + Cursor + Windsurf (VS Code API 1.85+)

## KEEP
- TypeScript (estricto)

## ADD
- **VS Code Extension API** 1.85+
- **esbuild** ^0.24 (bundler, 10-100x mas rapido que webpack)
- **Vitest** 2.1+ (unit tests con mock de `vscode`)
- **vsce** (publicar .vsix)
- `@types/vscode`
- Opcional: `@vscode/test-electron` (integration tests en VS Code headless)

## REPLACE
- Todo el stack web.

## REMOVE
- `src/app/`, `src/core/adapters/supabase/`, `public/`
- Tailwind/PostCSS (salvo que la extension tenga WebViews con Tailwind embebido — en ese caso se inlines)
- `next.config.ts`, `postcss.config.js`

## CONFIG
- `package.json` con:
  - `"engines": { "vscode": "^1.85.0" }`
  - `"main": "./dist/extension.js"`
  - `"activationEvents": ["onCommand:..."]` o `"onView:..."`
  - `"contributes": { "commands": [...], "views": [...], "configuration": ... }`
- `tsconfig.json` con `"module": "CommonJS"`, `"target": "ES2022"`, `"lib": ["ES2022"]`
- `esbuild.js` (build script con watch mode)
- `.vscodeignore` (qu no empaquetar en el .vsix)
- WebViews con **CSP + nonce** (regla dura: no inline `onclick`, no inline `style=""`)
- **Nunca usar `fs` de Node** en extensiones — usar `vscode.workspace.fs` (funciona en remote/SSH)

## Archivos Praxis a eliminar
- `src/app/`, `src/lib/`, `public/`, Tailwind configs
- `next.config.ts`

## Archivos nuevos a crear
- `src/extension.ts` (entry point con `activate` / `deactivate`)
- `src/commands/` (un archivo por comando)
- `src/providers/` (TreeDataProvider, WebviewViewProvider, etc.)
- `src/services/` (logica de negocio)
- `esbuild.js`
- `.vscodeignore`
- `CHANGELOG.md`
- `icon.png` (128x128 marketplace)

## IDE / Toolchain externo requerido
- **Node.js 20+**
- **VS Code** para Extension Development Host (F5)
- Cuenta **Azure DevOps** / Marketplace publisher (gratuita) si se publica
- **vsce CLI** para packaging y publishing
