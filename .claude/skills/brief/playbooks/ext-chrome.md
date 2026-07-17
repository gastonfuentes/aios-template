# Playbook: ext-chrome

## Targets obligatorios
- **Manifest V3 status** en 2026: MV2 deprecado, MV3 obligatorio. Enterprise policies extienden soporte MV2 pero usuario final no.
- **Service Worker limitaciones**: no persistente (se apaga), no DOM access, no synchronous storage — diferencias grandes con background page MV2.
- **Permissions** minimos: menos permissions = menos friccion en install + approval rapida.
- **Chrome Web Store**: $5 fee unico registro. Review time primera vez: 1-3 dias tipico.
- **Content scripts vs executeScript** (activeTab): decidir segun UX.

## Targets opcionales
- **cross-browser**: Firefox (`browser.*` API + polyfill), Edge/Brave heredan Chrome.
- **Self-hosted updates** enterprise sin store.

## Busquedas sugeridas
- "Manifest V3 service worker limitations"
- "Chrome extension review rejection common"
- "WXT framework extensions"

## Fuentes primarias
- https://developer.chrome.com/docs/extensions/mv3
- https://developer.chrome.com/docs/webstore/publish/
- https://wxt.dev

## Riesgos a investigar activamente
- **Service Worker terminacion** mid-operation — usar chrome.storage para state.
- **Rechazos** por permissions excesivos o descripciones vagas.
- **CSP estricto MV3** — no remote code, no eval.
