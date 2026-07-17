# Playbook: ext-vscode

## Targets obligatorios
- **Extensiones similares** en marketplace: feature set, pricing (free/paid via licensing propio), ratings.
- **VS Code API surface relevante**: Commands, WebView, TreeDataProvider, LanguageServer, TextEditor decorations, FileSystemProvider.
- **WebView CSP**: nonce obligatorio, **no** inline `onclick`, **no** inline `style=""` (regla dura Praxis).
- **Cross-IDE compatibility**: VS Code, Cursor, Windsurf comparten API; verificar versiones minimas.
- **Publishing**: Azure DevOps publisher, `vsce publish`, versionado semver.
- **Tamano del .vsix**: < 5MB recomendado marketplace.

## Targets opcionales
- **Open VSX Registry** (publicar tambien alla para Eclipse Theia, Gitpod, etc.).
- **Marketplace Insights**: trending, categorias.
- **Extension pack** si se publica bundle.

## Busquedas sugeridas
- "VS Code extension API <feature>"
- "WebView CSP nonce VS Code"
- "vsce publish best practices"
- "Open VSX publishing guide"

## Fuentes primarias
- https://code.visualstudio.com/api
- https://code.visualstudio.com/api/extension-guides/webview
- https://github.com/microsoft/vscode-vsce

## Riesgos a investigar activamente
- **Race conditions** en activationEvents: usar `onView` no `onStartupFinished` (Praxis aprendizaje documentado).
- **Extension Development Host**: hay que recargar ventana (Cmd/Ctrl+R) cada compile.
- **Remote workspaces** (SSH/Containers): nunca usar `fs` de Node, solo `vscode.workspace.fs`.
