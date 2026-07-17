# Registro en Praxis — pasos para que la skill nueva se inyecte

Praxis distribuye skills via payload encriptado, NO via `/plugin install` standalone. Cualquier skill nueva debe registrarse en el sistema de templates compilados.

## 1. Carpeta y archivos

```
injectable/agentic/skills/<id>/
├── SKILL.md
├── references/<topic>.md
├── scripts/<name>.{sh,py,ts}
└── assets/<name>.{tsx,png,...}
```

El generador (`scripts/generate-templates.js`) walks recursivo `injectable/agentic/`. Cualquier archivo que tenga contenido se incluye automatico al regenerar.

## 2. Regenerar templates compilados

```bash
npm run generate
```

Output esperado:

```
✅ Template generation complete! (N files → 10 TypeScript modules)
```

`N` aumenta segun cuantos archivos agregaste. Si N no cambio, el script no detecto los archivos — verificar paths.

## 3. Validar tests

```bash
npm test
```

Tests que asertan estructura del payload (`skillCatalog.test.ts`, `templates.test.ts`) detectan si la skill rompio algo. Si fallan tras `npm run generate`, ver el aprendizaje 2026-05-02 del meta-repo (PRP-034): regenerar es paso obligatorio antes de investigar logica.

## 4. Decidir si activar por default

Si la skill debe estar inyectada al hacer INIT (no opcional), agregarla a `DEFAULT_ACTIVE_SKILLS` en `src/services/projectConfig.ts`:

```ts
export const DEFAULT_ACTIVE_SKILLS = [
  'brief',
  'prp',
  'bucle-agentico',
  'build-with-agent-team',
  'frontend-design',
  'playwright-cli',
  'skill-creator',
  '<tu-nueva-skill>',  // si quieres que sea default
];
```

Considerar:

- Skills foundational (que el alumno necesita siempre): si default.
- Skills de stack opcional (auth-stack solo si quieres login): NO default. El alumno la activa manual desde el sidebar.
- Skills experimentales: NO default. Activar manual hasta validar.

## 5. Dependencies acopladas

Si tu skill funciona junto con un MCP (ej. `supabase-admin` requiere Supabase MCP configurado), agregar a `coupledSkills` en `src/services/mcpCatalog.ts`:

```ts
{
  id: 'supabase',
  // ...
  coupledSkills: ['supabase-admin', 'auth-stack'],
}
```

Cuando el alumno activa el MCP, las skills acopladas se activan auto en modo managed. En modo coexistence, NO se acoplan automatico (cross-ref `auth-stack/SKILL.md` y la doctrina del PRP-024).

## 6. Empaquetar en `.vsix`

```bash
npm run package
```

Genera `praxis-X.Y.Z.vsix`. Para validar que tu skill quedo dentro:

```bash
unzip -l praxis-X.Y.Z.vsix | grep <tu-skill>
```

Deberia listar archivos dentro de `dist/extension.js` (todos los templates van bundled adentro). Para verificar que el payload encriptado tambien lleva tu skill, inspeccionar el blob via dashboard de Supabase o via roundtrip E2E del deploy.

## 7. Test E2E en proyecto fresh

Antes de publicar release, smoke test:

```bash
# En proyecto temporal
mkdir /tmp/test-praxis && cd /tmp/test-praxis
code --install-extension /path/to/praxis-X.Y.Z.vsix
# Abrir VS Code, ejecutar Praxis: INIT
# Verificar que .claude/skills/<tu-skill>/SKILL.md aparece
```

Si tu skill no aparece tras INIT:

1. Revisar que `npm run generate` haya incluido los archivos (output count).
2. Revisar que el payload encriptado se redeployo (`npm run deploy:payload`).
3. Verificar la cache local del cliente — `payloadCache` puede tener version vieja.

## 8. Documentar

Si la skill nueva es transversal (afecta varias skills) o introduce un nuevo concepto:

- Agregar entry en `injectable/agentic/SKILLS_README.md`.
- Si aprendizaje aplica al meta-repo: agregar a `CLAUDE.md` raiz (seccion "Aprendizajes").
- Si rompe convenciones del STYLE-GUIDE: actualizar el STYLE-GUIDE primero (cross-ref `injectable/agentic/skills/STYLE-GUIDE.md`).

## Cross-ref con bucle-agentico

La doctrina canonica del PRP-029 dicta que cualquier creacion de skill propia operativa pasa por el patron recursivo: mapea contexto, planea solo este nivel, ejecuta, documenta, propaga aprendizajes. `skill-creator` ES un nivel del patron — el nivel "construccion de instrumental".
