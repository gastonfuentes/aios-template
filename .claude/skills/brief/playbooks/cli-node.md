# Playbook: cli-node

## Targets obligatorios
- **CLI similares existentes**: ¿ya existe algo? ¿que hacen mejor / peor?
- **UX de terminal**: prompts interactivos vs flags, errores claros, ayuda con ejemplos.
- **Distribucion**: npm registry (requiere Node preinstalado) vs binary con pkg/esbuild-single-binary.
- **Supported Node versions**: 20+ minimum, LTS tracking.
- **Output formats**: human-readable default + `--json` para scripting.

## Targets opcionales
- **Auto-complete**: bash/zsh/fish completions.
- **Update notifier** (`update-notifier` lib).
- **Telemetry opt-in** (con clara politica de privacidad).

## Busquedas sugeridas
- "Node CLI framework comparison 2026 Commander Yargs Oclif"
- "@clack/prompts modern CLI UX"
- "Node single binary distribution 2026"

## Fuentes primarias
- https://github.com/tj/commander.js
- https://github.com/bombshell-dev/clack
- https://oclif.io

## Riesgos a investigar activamente
- **Cross-platform terminal**: Windows terminal vs macOS Terminal vs iTerm2 vs Linux — colores, glyphs (ligatures).
- **Node version lock**: pin con `engines` + `engineStrict` para evitar bugs por Node viejo.
- **Dependencies** supply chain: auditar `npm audit` + `npm ls` periodico.
