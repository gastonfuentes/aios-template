---
name: skill-creator
description: "Genera nuevas skills Praxis cumpliendo Skills 2.0 spec de Anthropic. Lee STYLE-GUIDE.md como contrato obligatorio, genera frontmatter validado, body imperativa < 500 lineas, bundle canonico references/scripts/assets, cross-references con skills hermanas, registro en injectable/agentic/skills/ + regenerar templates. Activar cuando el usuario menciona crear nueva skill, agregar capacidad al agente, extender skills, skill custom para mi nicho, o pide 'haz una skill que haga X'."
allowed-tools: Read, Write, Edit, Bash
---

# skill-creator — generar skills cumpliendo Skills 2.0

> Auto-referencial. Esta skill genera skills nuevas siguiendo el mismo contrato que ella misma respeta. El STYLE-GUIDE de `injectable/agentic/skills/STYLE-GUIDE.md` es la fuente de verdad — leerlo antes de cada skill nueva.

---

## Cuando activar

- "Necesito una skill que haga X."
- "Agregame al agente la capacidad de Y."
- "Crea skill para mi nicho de [WhatsApp / e-commerce / fitness / educacion]."

## Cuando NO activar

- Editar una skill existente. Eso es Edit directo en su `SKILL.md`.
- Crear un PRP. Eso es `@.claude/skills/prp/SKILL.md`.
- Crear un brief. Eso es `@.claude/skills/brief/SKILL.md`.

## Antes de empezar — verifica empiricamente

- [ ] Leer `injectable/agentic/skills/STYLE-GUIDE.md` integro. Ese es el contrato.
- [ ] Listar skills existentes (`ls injectable/agentic/skills/`) para evitar duplicados o nombres colisionantes.
- [ ] Verificar que el nombre propuesto cumple regex `^[a-z0-9-]{1,64}$` y no contiene "anthropic" ni "claude".
- [ ] Validar que el caso de uso justifica una skill nueva vs extender una existente.

## Flujo principal

### Paso 1: validar el caso de uso

Una skill nueva justifica su existencia cuando:

1. **Caso recurrente**: el agente necesita esta capacidad >5 veces en proyectos distintos.
2. **Patron complejo**: requiere mas de 50 lineas de instructional + assets dedicados.
3. **Sin overlap con skills existentes**: si encaja en una skill que ya existe, extender (nuevas references) en lugar de duplicar.

Si no cumple los 3, la solucion correcta probablemente es:

- Documentar como aprendizaje en CLAUDE.md.
- Agregar como `references/<topic>.md` a una skill existente.
- Crear un comando especifico (`.claude/commands/`) si es un workflow puntual.

### Paso 2: estructura del bundle

```
nueva-skill/
├── SKILL.md              # < 500 lineas, frontmatter + instrucciones imperativas
├── references/           # docs lazy-loaded (cargar bajo demanda)
│   └── <topic>.md        # one-level-deep, files >300 lineas con TOC
├── scripts/              # codigo determinista (Python / Node / Bash)
│   └── <name>.{py,sh,ts}
└── assets/               # templates, plantillas, icons usados en output
    └── <name>.{tsx,html,svg,...}
```

Las tres carpetas canonicas: `references/`, `scripts/`, `assets/`. NO inventar `templates/`, `data/`, `examples/`.

### Paso 3: frontmatter Skills 2.0 estricto

```yaml
---
name: nueva-skill
description: "<WHAT en una frase>. Activar cuando el usuario menciona <trigger 1>, <trigger 2>, <trigger 3>, <trigger 4>, <trigger 5>."
allowed-tools: <comma-separated list opcional>
---
```

Reglas duras:

- `name`: regex `^[a-z0-9-]{1,64}$`. Sin XML tags. Sin "anthropic"/"claude".
- `description`: max 1024 chars, **tercera persona estricta** (no "yo", no "tu"), pushy con WHAT + WHEN concretos.
- Campos opcionales: `allowed-tools`, `model`, `disable-model-invocation`, `argument-hint`. Otros NO.

### Paso 4: body imperativa con why

Plantilla minima en `assets/skill-template.md`. Estructura recomendada:

1. `# <Nombre legible>` + frase ejecutiva.
2. `## Cuando activar` (4-7 triggers).
3. `## Cuando NO activar` (2-3 casos donde otra skill o ningun workflow es mejor).
4. `## Antes de empezar — verifica empiricamente` (pre-requisitos checkable).
5. `## Flujo principal` (pasos imperativos con why).
6. `## Si tu Directiva no es Next.js/Supabase` (solo skills de stack — adaptaciones).
7. `## Cross-references con skills hermanas` (al menos 3 cuando aplique).
8. `## Archivos lazy-loaded` (lista de references/scripts/assets con que contiene cada uno).
9. `## Validacion al cerrar` (comandos para verificar que el resultado funciona).

### Paso 5: cross-references concretas

No basta con mencionar otras skills. Declarar **hand-off explicito**: "Cuando el usuario llega a Y, esta skill llama a `@.claude/skills/<hermana>/SKILL.md` para Z. La hermana asume X de la nuestra."

Ejemplo bien hecho (de `auth-stack`):

> `@.claude/skills/emails-transactional/SKILL.md` — encadenar despues de signup. Hand-off: el trigger `handle_new_user` puede llamar una funcion edge que despache `sendEmail({ template: 'welcome', to: new.email })`.

### Paso 6: registrar y regenerar

```bash
# 1. Crear la carpeta y los archivos
mkdir -p injectable/agentic/skills/<nueva>/{references,scripts,assets}
# (poblar archivos)

# 2. Regenerar templates compilados — Praxis distribuye via payload, NO via /plugin install
npm run generate

# 3. Validar tests
npm test
```

Diferencia clave vs skills standalone de Anthropic: Praxis no usa `/plugin install`. Las skills viven en el payload encriptado y se inyectan via INIT/UPDATE de la extension.

### Paso 7: validar contra Skills 2.0 spec

Checklist final:

- [ ] `head -10 SKILL.md` muestra frontmatter valido (regex `name`, descripcion no vacia, ≤1024 chars).
- [ ] `wc -l SKILL.md` < 500.
- [ ] Description en tercera persona (sin "yo", sin "tu").
- [ ] Bundle usa `references/`, `scripts/`, `assets/` (no `templates/`, `data/`).
- [ ] References one-level-deep (no nested deeper).
- [ ] Files >300 lineas en references tienen TOC al inicio.
- [ ] Forward slashes only en paths.
- [ ] Cross-references concretas con skills hermanas (cuando aplique).

Cualquier check fallido bloquea el cierre.

## Casos de uso YOUR_COMMUNITY-flavored

Ejemplos canonicos de skills custom para nichos del alumno:

### `whatsapp-broadcaster` — broadcasting a tu comunidad

```
Caso: alumno YOUR_COMMUNITY tiene comunidad de WhatsApp y quiere automatizar
broadcasts desde su app.

Bundle:
- SKILL.md con flow integracion WhatsApp Business API
- references/twilio-vs-meta.md (proveedores comparados)
- references/template-approval.md (proceso de aprobacion de Meta)
- scripts/send-broadcast.ts
- assets/broadcast-templates/ (mensajes pre-aprobados)

Cross-refs: auth-stack (lista de receptores), supabase-admin (logs de envio).
```

### `landing-redirect` — redireccionar trafico SEO

```
Caso: alumno tiene blog viejo y quiere redirigir traffic a su SaaS.

Bundle:
- SKILL.md con setup de 301 redirects, sitemap fusion
- references/seo-preservation.md (que NO romper al migrar)
- scripts/check-broken-links.sh
- assets/middleware-redirect.ts

Cross-refs: web-3d (landing nueva), frontend-design (paleta).
```

## Cross-references con skills hermanas

- `@.claude/skills/STYLE-GUIDE.md` — contrato obligatorio que toda skill debe respetar. Esta skill lo cita en cada Paso 1.
- `@.claude/skills/brief/SKILL.md` — patron de skill multi-archivo con references lazy load. Replicar.
- `@.claude/skills/prp/SKILL.md` — voz imperativa al agente con explicacion del why. Replicar.
- `@.claude/skills/bucle-agentico/SKILL.md` — doctrina canonica recursiva. Cualquier skill nueva debe operar dentro de la doctrina, no fuera.

## Archivos lazy-loaded

- `references/skill-anatomy.md` — anatomia detallada de un SKILL.md exitoso, con seccion por seccion.
- `references/anti-patterns.md` — errores comunes al crear skills (descriptions vagas, body verbose, references anidadas).
- `references/voz-y-tono.md` — distincion canonica voz briefs vs PRPs vs skills (resumen del STYLE-GUIDE para acceso rapido).
- `references/registro-en-praxis.md` — pasos para que una skill nueva se inyecte correctamente: registrar en `injectable/`, regenerar templates, opcionalmente agregar a `DEFAULT_ACTIVE_SKILLS`.
- `assets/skill-template.md` — punto de partida vacio para SKILL.md.
- `scripts/validate-skill.sh` — verifica frontmatter + line count + estructura.

## Validacion al cerrar

- [ ] La skill nueva existe en `injectable/agentic/skills/<id>/SKILL.md`.
- [ ] `head -10` muestra frontmatter valido.
- [ ] `wc -l SKILL.md` < 500.
- [ ] `npm run generate` regenera templates sin warnings.
- [ ] `npm test` retorna 0.
- [ ] Si la skill debe ser default-activa: agregada a `DEFAULT_ACTIVE_SKILLS` en `src/services/projectConfig.ts`.
- [ ] Probar inyeccion en proyecto fresh: `code --install-extension --force` + INIT + verificar que la skill aparece en el sidebar.
