# STYLE-GUIDE de skills Praxis

> Contrato foundational que TODA skill bajo `injectable/agentic/skills/<id>/` debe respetar. Las skills intocables (`brief`, `prp`, `bucle-agentico`) son la referencia canónica del tono correcto — replicar su patrón sin tocar su contenido.

---

## 1. Spec Skills 2.0 oficial de Anthropic (reglas duras)

Fuente primaria: <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>
Fuente secundaria: <https://github.com/anthropics/skills>
Guía completa: <https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf>

### 1.1 Frontmatter YAML — validación estricta

```yaml
---
name: <id-canonico>
description: "<WHAT en una frase> + <WHEN con triggers concretos>"
---
```

- `name`:
  - Regex: `^[a-z0-9-]{1,64}$`. Solo lowercase, dígitos y guiones medios.
  - Sin XML tags.
  - Reserved words prohibidas: **"anthropic"** y **"claude"** no pueden aparecer en `name`.
  - Patrón preferido: gerundio o noun phrase descriptiva (`processing-pdfs`, `pdf-processing`). Evitar genéricos (`helper`, `utils`, `tools`).
- `description`:
  - Max 1024 chars, no vacía.
  - **Tercera persona estricta** (la description se inyecta al system prompt — primera o segunda persona rompe el discovery).
  - Debe contener **WHAT** + **WHEN**.
  - Formulada **pushy**: incluir 5-7 triggers concretos en una frase tipo *"Activar cuando el usuario menciona X, Y, Z, o pide A, B."*.
- Campos opcionales aceptados: `allowed-tools`, `model`, `disable-model-invocation`, `argument-hint`. Otros campos custom quedan fuera del scope.

#### Ejemplos antes/después de `description`

❌ Mal — primera persona:

```yaml
description: "Yo te ayudo a configurar autenticación con Supabase."
```

❌ Mal — segunda persona:

```yaml
description: "Puedes usar esto para configurar autenticación."
```

❌ Mal — vaga sin triggers:

```yaml
description: "Skill para autenticación."
```

✓ Bien — tercera persona pushy con WHAT + WHEN:

```yaml
description: "Configura autenticación con Supabase Auth + magic-link + RLS para apps Next.js. Activar cuando el usuario menciona login, signup, autenticación, sesión de usuario, magic-link, o protección de rutas."
```

### 1.2 Body del SKILL.md

- **< 500 líneas** (umbral oficial para optimal performance). Excedente se split a `references/<topic>.md`.
- **Voz imperativa al agente** que ejecuta la skill, con explicación del **why** detrás de cada instrucción crítica.
- Sin abuso de **MUSTs/NEVERs** en mayúsculas. Razón > orden — un agente cumple mejor con razones que con imperativos agresivos.
- **Consistent terminology**: un solo término por concepto a lo largo de la skill (no mezclar "API endpoint" + "URL" + "API route" para lo mismo).
- Sin **time-sensitive info** en flujo principal (fechas absolutas, "after Aug 2025"). Mover a sección "Old patterns" colapsada si es histórico relevante; eliminar si no.
- **Forward slashes** only en paths (`scripts/helper.py`, no `scripts\helper.py`). Unix paths funcionan cross-platform.
- **Default + escape hatch** sobre múltiples opciones equivalentes ("Use pdfplumber. For scanned PDFs, use pdf2image instead." beats "You can use pdfplumber, pdf2image, pypdf, or pdfminer.").

### 1.3 Bundle structure canónica

```
skill-name/
├── SKILL.md              # required, frontmatter + instructions, <500 líneas
├── references/           # docs lazy-loaded (load on-demand)
│   └── *.md              # one-level-deep desde SKILL.md
├── scripts/              # código ejecutable determinístico
│   └── *.py / *.sh / *.ts
└── assets/               # templates, icons, fonts usados en output
    └── *.{png,svg,html,...}
```

Las **tres carpetas canónicas** son `references/`, `scripts/`, `assets/`. Inventar `templates/`, `data/`, `examples/` rompe la consistencia con la spec oficial.

### 1.4 Progressive disclosure (3 niveles oficiales)

1. **Level 1**: name + description en system prompt (~50-100 tokens por skill, siempre cargado).
2. **Level 2**: SKILL.md body completo cuando la skill se trigger.
3. **Level 3**: archivos en `references/`, `scripts/`, `assets/` cargados explícitamente bajo demanda (`Read`/`Bash`).

### 1.5 References — reglas estrictas

- **One-level-deep** desde SKILL.md. Nested deeper rompe progressive disclosure — Claude usa `head -100` cuando ve referencias anidadas y pierde info.
- Files **>300 líneas** incluyen Table of Contents al inicio.
- Naming descriptivo (`finance.md`, no `doc2.md`).

### 1.6 Cross-platform

El formato Skills 2.0 es idéntico cross-tool (Claude Code, Codex CLI, Cursor, Gemini CLI). Las skills inyectadas a la carpeta agéntica del provider activo (PRP-032 multi-provider) deben funcionar idénticas en los tres entornos.

---

## 2. Distinción de voz: briefs vs PRPs vs skills

Esta es la corrección clave del PRP-027 al aplicarse a artefactos internos del pipeline. PRP-027 dicta voz Juan Lara primera persona para superficies que el usuario lee como narrativa (sidebar, READMEs, notificaciones, release notes). **Las skills NO son superficies de narrativa** — son prompts ejecutables dentro del contexto del agente.

### 2.1 Briefs (`BRIEF-*.md`)

- **Primera persona del usuario**.
- "Quiero...", "He decidido...", "Mi visión es...".
- El brief ES la voz del autor articulando su intención.

### 2.2 PRPs (`PRP-XXX-*.md`)

- **Primera persona heredada del brief** SOLO en las secciones `## Origen`, `## Objetivo`, `## Por Que`.
- El resto del PRP (Que, Contexto, Directiva de Stack, Plan, Anti-patrones, Aprendizajes) es **impersonal técnico**.

### 2.3 Skills — frontmatter `description`

- **Tercera persona estricta**, pushy, con WHAT + WHEN explícito.
- Max 1024 chars.
- La description se pre-carga en el system prompt de Claude para discovery; primera o segunda persona rompe el mecanismo de selección.

### 2.4 Skills — body del SKILL.md y archivos en `references/`

- **Voz imperativa al agente** que ejecuta la skill, con explicación del **why** detrás de cada instrucción crítica.
- Sin primera persona del autor ("yo monté", "te dejé", "cuando diseño").
- Sin abuso de MUSTs/NEVERs en mayúsculas — explicar el porqué genera mejor cumplimiento que ordenar.

#### Ejemplos antes/después del body

❌ Mal — primera persona del autor:

```markdown
Yo siempre creo la tabla profiles primero porque me ahorra problemas con RLS retroactivo.
```

❌ Mal — MUSTs sin razón:

```markdown
NEVER write before enabling RLS!!! ALWAYS enable RLS FIRST!!!
```

❌ Mal — segunda persona narrativa:

```markdown
Tú vas a configurar Supabase para que la autenticación funcione.
```

✓ Bien — imperativa con why:

```markdown
Crea la tabla `profiles` con RLS habilitada antes del primer write. Razón: Supabase no permite re-aplicar RLS retroactivamente sin migración compleja.
```

### 2.5 La identidad Praxis viene de cuatro fuentes (NO del pronombre)

1. **Idioma español** 100% (siglas técnicas permitidas: lista del PRP-027).
2. **Ejemplos del dominio SinergIA** (alumno Vibe Coding, primer SaaS, comunidad Skool, broadcast WhatsApp).
3. **Cross-references explícitas** entre skills hermanas (auth ↔ emails ↔ payments ↔ pwa ↔ supabase-admin).
4. **Explicaciones del why** detrás de instrucciones críticas — no órdenes, sino razones.

---

## 3. Paleta visual SinergIA

Reemplaza cualquier residuo del purple SF heredado (hex que empieza con 683) por la paleta canónica de Praxis (sidebar):

- **Primary gradient**: `linear-gradient(135deg, #0a84ff 0%, #00d9ff 100%)` (azul → cyan).
- **Accent cyan**: `#00d9ff`.
- **Accent blue**: `#0a84ff`.
- **Background neutral oscuro**: `var(--vscode-sideBar-background)` con overlay `rgba(255,255,255,0.03)`.
- **Border sutil**: `rgba(255,255,255,0.08)`.
- **Texto**: variable theme nativo del editor cuando aplica; en emails/landing usar `#0f172a` sobre fondo claro o `#f8fafc` sobre fondo oscuro.
- **Tipografía**: stack del sistema (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`). Para emails: web-safe + fallback.

---

## 4. Lista cerrada de palabras prohibidas

Las siguientes categorias NO pueden aparecer literales en ningun archivo bajo `injectable/agentic/skills/<id>/`. La lista exhaustiva con strings exactas vive en el PRP-035 (fuera del payload, para evitar que el propio STYLE-GUIDE haga match en el grep de validacion).

**Vocabulario propietario SF**:

- Frases iniciadas con "Golden" + sustantivo (regla canonica, ruta canonica heredadas del payload SF).
- Compuestos "Self-A..." y "Auto-B..." del payload SF (nombre que daban al ciclo de auto-refuerzo). Reemplazar por "Auto-Refuerzo" o "Registro de Aprendizajes".
- Concepto "B..." en uppercase del payload SF (su nombre del bucle por fases). Reemplazar por "por fases" en minusculas.
- Metaforas industriales SF (referencias a sentidos/ojos del agente, rol de capataz). Reemplazar por descripciones impersonales en espanol estandar.
- Imperativo agresivo "NO + verbo en mayusculas" (era el tono SF). Reemplazar por imperativa con explicacion del why.
- Anecdotas de bug-rate ficcional del payload SF (ej. mencion del numero exacto de commits de un debug). Eliminar.
- Atribucion residual al payload SF en frontmatter, cross-refs o metadata.

**Visual SF**:

- Hex de purple SF (empieza con 683). Reemplazar por gradient cyan SinergIA del Apartado 3.

**Reserved en frontmatter `name`**:

- `anthropic` y `claude` (Skills 2.0 spec).

**Voz primera persona del autor en body** (regex orientativo, puede haber falsos positivos en quotes/ejemplos):

- `^Yo `, `^Te dej`, `^Mi regla`, `^Cuando dise`, `^He decidido`.

---

## 5. Estructura recomendada del SKILL.md

```markdown
---
name: <id-canonico>
description: "<WHAT en una frase>. Activar cuando el usuario menciona <trigger1>, <trigger2>, <trigger3>, <trigger4>, <trigger5>."
---

# <Nombre legible> — <una frase resumen>

> Una frase ejecutiva sobre qué resuelve esta skill y a quién le sirve.

---

## Cuándo activar

- Lista de 4-7 triggers de invocación reales (verbatim del usuario o reformulados).

## Cuándo NO activar

- 2-3 casos donde otra skill o ningún workflow es mejor.

## Antes de empezar — ten esto a mano

- Pre-requisitos físicos (cuentas, API keys, dependencias) que el agente debe verificar empíricamente antes de ejecutar (Regla 6 PRP-029).

## Flujo principal

1. Paso 1 imperativo con why.
2. Paso 2 imperativo con why.
3. ...

## Si tu Directiva no es Next.js/Supabase

> Solo en skills de stack. 5-10 líneas + link a `references/non-next/<framework>.md`.

## Cross-references con skills hermanas

- `@.claude/skills/<id-hermano>/SKILL.md` → cuándo encadenar y por qué.

## Archivos lazy-loaded

- `references/<topic>.md` — qué contiene, cuándo leerlo.
- `scripts/<helper>.sh` — qué hace, cuándo ejecutarlo.
- `assets/<template>` — qué genera, cuándo usarlo.

## Validación al cerrar

- Comandos para verificar que el resultado funciona.
```

---

## 6. Patrones de cross-pollination Praxis-only

Las skills hermanas se referencian explícitamente con paths absolutos `@.claude/skills/<id>/SKILL.md`. Cada skill de stack declara al menos 3 cross-links concretos con ejemplo de hand-off.

Mapa canónico de hand-offs:

```
auth-stack ──→ emails-transactional   (welcome al alumno post-signup)
auth-stack ──→ payments-polar         (purchases vinculadas a profile)
auth-stack ──→ pwa-mobile             (suscripción push asociada a profile)
auth-stack ──→ supabase-admin         (profiles + RLS son su núcleo)

emails-transactional ──→ payments-polar   (notificación de cobro/cancelación)
emails-transactional ──→ pwa-mobile       (push como canal alternativo a email)

payments-polar ──→ emails-transactional   (webhook checkout.completed → sendEmail)

pwa-mobile ──→ auth-stack             (push subs guardadas en profiles)

ai-sdk-kit ──→ auth-stack             (agente con memoria conoce al user)
ai-sdk-kit ──→ supabase-admin         (vector embeddings, conversations)

image-kit ──→ auth-stack              (avatares en profiles via Storage)
image-kit ──→ web-3d                  (assets de la landing)
image-kit ──→ playwright-cli          (thumbnails comparativos en reportes)

web-3d ──→ auth-stack                 (CTA navega a /signin)
web-3d ──→ frontend-design            (paleta + tipografía heredada)

playwright-cli ──→ image-kit          (reportes con thumbnails)

frontend-design                       (transversal — referenciada por todas las UI-visible)
```

---

## 7. Plantilla mínima de SKILL.md (punto de partida)

```markdown
---
name: <id>
description: "<WHAT en una frase>. Activar cuando el usuario menciona <triggers>."
---

# <Nombre legible>

> <Frase ejecutiva>.

---

## Cuándo activar

- <trigger 1>
- <trigger 2>
- <trigger 3>

## Cuándo NO activar

- <caso 1>
- <caso 2>

## Antes de empezar

Verificar empíricamente:

- [ ] <pre-requisito 1>
- [ ] <pre-requisito 2>

## Flujo principal

### Paso 1: <nombre>

<imperativo + why>

### Paso 2: <nombre>

<imperativo + why>

## Si tu Directiva no es Next.js/Supabase

Ver `references/non-next/<framework>.md`.

## Cross-references

- `@.claude/skills/<hermano-1>/SKILL.md` — <cuándo encadenar>.
- `@.claude/skills/<hermano-2>/SKILL.md` — <cuándo encadenar>.

## Validación al cerrar

```bash
<comandos de verificación>
```
```

---

## 8. Skills doctrinales como referencia de tono

Las tres skills del pipeline recursivo son la fuente de verdad del tono correcto:

- `@.claude/skills/brief/SKILL.md` — cómo orquestar skill con bundle `references/` + carga perezosa por tipo detectado (`stacks/<tipo>.md` + `playbooks/<tipo>.md`).
- `@.claude/skills/prp/SKILL.md` — cómo escribir voz imperativa al agente con explicación del why y heredar contexto del nivel superior.
- `@.claude/skills/bucle-agentico/SKILL.md` — cómo redactar doctrina densa sin perder claridad, con flujo PASO 0-5 cohesivo.

Su **contenido doctrinal es intocable** — las 5 reglas duras + Regla 6 + lifecycle de 4 estados del PRP + el patrón recursivo aplicado a las 3 escalas son la metodología canónica de Praxis. Cualquier modificación a la doctrina requiere un brief dedicado con justificación explícita.

### 8.1 Excepción de voz documentada para `bucle-agentico/SKILL.md`

La sección "Mi rol: doctrina + aplicación a subtarea" usa **primera persona del agente** ("Soy el patrón canónico...", "Mi rol es...") porque la skill ES la doctrina canónica autorreferencial. Esa primera persona es deliberada y se preserva — la skill literalmente describe su propia identidad como fuente de verdad del patrón recursivo.

El resto del body de `bucle-agentico/SKILL.md` usa imperativa con explicación del why (regla canónica del Apartado 2.4 arriba). Esta excepción aplica **solo** a la sección "Mi rol" y a los headers que la introducen.

### 8.2 Alineación estructural a Skills 2.0 (PRP-036)

Las 3 skills doctrinales fueron alineadas estructuralmente a Skills 2.0 en PRP-036 sin tocar su contenido doctrinal:

- **Frontmatter**: descriptions tercera persona pushy con WHAT + WHEN explícito y triggers concretos en español; `effort: max` declarado; `allowed-tools` explícito; eliminación de `context: fork` de `prp/SKILL.md` (rompía inheritance del brief origen).
- **Bundle canónico**: `references/` con templates extraídos del body + ejemplos input/output; `evals/evals.json` con casos de regresión; cross-link a este STYLE-GUIDE en cada header.
- **Body**: compactación in-place de `bucle-agentico/SKILL.md` (diagramas duplicados condensados, secciones con overlap fusionadas) preservando doctrina + flujo PASO 0-5 + reglas duras + Regla 6 + uso de MCPs guidance juntos como pieza cohesiva.

El contenido doctrinal quedó textualmente idéntico; solo cambió la organización del bundle y la presentación del frontmatter.

---

*Cualquier skill futura, propia o ajena, que se incorpore al payload de Praxis pasa por este STYLE-GUIDE antes de ser inyectable. El `skill-creator` lo cita como contrato obligatorio.*
