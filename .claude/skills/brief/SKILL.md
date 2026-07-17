---
name: brief
description: "Aterriza cualquier idea de Vibe Coding (web, mobile, desktop nativo macOS/Windows/Linux, extension, CLI, AI app, 3D, real-time, e-commerce) en un brief ejecutable. Clasifica el tipo de proyecto y emite una Directiva de Stack Tecnico (KEEP/ADD/REPLACE/REMOVE/CONFIG) que el PRP consume directo. Descompone la idea en fases con la profundidad que el trabajo pida, analizando workspace + idea, sin preguntar al usuario. Activar cuando el usuario menciona necesito un brief, quiero articular una idea, quiero construir X, tengo una idea, dame un brief, investiga y redacta, brief de proyecto, brief para una app."
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch
effort: max
---

# Skill: Brief Director de Alcance Multi-Stack

> Crear brief para: $ARGUMENTS
>
> Esta skill cumple el [STYLE-GUIDE de skills Praxis](../STYLE-GUIDE.md) (Skills 2.0 spec + voz canonica + bundle structure). Leer antes de modificar.

El brief es el **primer paso del pipeline creativo** de Praxis. Convierte una idea vaga en un documento estructurado + una Directiva de Stack ejecutable que luego alimenta `/prp` para generar fases de implementacion concretas.

**Pipeline**: `/brief → BRIEF-{tema}.md → /prp → PRP-XXX.md → /bucle-agentico → implementacion`

---

## Mi rol en el patron recursivo

Soy el patron canonico (`bucle-agentico`) aplicado a **escala proyecto**.

- Mi **mapear** es investigar idea + web + workspace.
- Mi **planear** es fases por nombre + Directiva inicial de Stack.
- Mi **ejecutar** es delegar cada fase al PRP (escala feature).
- Mi **documentar** son los hallazgos de investigacion + decisiones de stack que dejo escritos en el brief.
- Mi **propagar** son los aprendizajes que cada PRP devolvera al cerrar — los recibo en el campo `Aprendizajes para fases siguientes` de cada fase.

La doctrina completa vive en `@.claude/skills/bucle-agentico/SKILL.md`. Lee esa skill para entender el patron entero antes de ejecutar este brief.

---

## Un brief, con fases

Praxis trabaja con **un solo tipo de brief**: un documento `BRIEF-{tema}.md` que aterriza la idea y la descompone en **fases**. No hay variantes ni modos que elegir — un proyecto grande tiene varias fases, una feature acotada tiene una o dos. El agente decide la **profundidad** (cuantas fases, cuanto investigar) con su propio razonamiento (ver Paso 1); el usuario nunca elige nada.

El brief siempre alimenta **un solo PRP** que cubre todas sus fases (ver `@.claude/skills/prp/SKILL.md`). Se acabaron los conceptos de "brief master", "brief single", "PRP por fase" y "PRP unico monolitico": hay un brief, y de el sale un PRP con fases.

---

## Proceso (7 pasos — seguir en orden estricto)

### Paso 1 — Entender el contexto y la profundidad (razonamiento del agente)

Esta decision es **juicio del agente**, no matching de palabras clave. Lee todo lo que tengas disponible, razona sobre el contexto, y decide **cuanta profundidad** pide el trabajo: cuantas fases tendra el brief y cuanto hay que investigar. No hay un "modo" que elegir — solo escalas la profundidad a lo que la idea necesita.

**Que leer antes de decidir**:

1. **$ARGUMENTS completo** — la idea del usuario, tal cual. No buscar palabras especificas; entender la **intencion** del usuario.
2. **Estado del workspace** usando Glob/Read:
   - ¿Existe `package.json`, `src/`, `.claude/`, `BUSINESS_LOGIC.md`, `BRIEF*.md`, `PRP*.md`?
   - ¿El `src/features/` tiene solo el scaffold base de Praxis (auth, dashboard, .template) o tiene features propios del usuario?
   - ¿Hay codigo que sugiera un proyecto ya iniciado con historia?

**Como razonar sobre la profundidad**:

- Un **proyecto completo** (idea que define un producto nuevo desde cero, con multiples capacidades integradas) pide un brief con **varias fases** coordinadas, una Directiva de Stack completa, e investigacion amplia. Aunque el workspace tenga codigo previo, si la idea es un producto nuevo, planea el todo.
- Una **feature acotada** (pieza dentro de un contexto existente, un cambio puntual sobre algo ya vivo) pide un brief mas corto, con **una o dos fases** y una Directiva de deltas.

**La distincion esencial**: ¿el usuario esta **definiendo un producto** o **refinando uno existente**? En ambos casos el output es el mismo tipo de archivo (`BRIEF-{tema}.md` con `## Alcance por Fases`); lo unico que cambia es **cuantas fases** y cuanto detalle.

**Cuando hay ambiguedad real**: ganan las señales de la idea sobre las del workspace. Si aun asi no queda claro, preferir menos fases — es mas conservador, y si el usuario necesitaba mas profundidad lo dira al revisar el brief.

**Comunicar la decision (no preguntarla)**:

Despues de decidir, anunciar en una linea la profundidad elegida. Ejemplo:

```
Voy a generar un brief de proyecto con varias fases — describes un producto completo con varias capacidades y el workspace no muestra un proyecto relacionado en marcha.
```

o

```
Voy a generar un brief acotado de una o dos fases — describes una adicion puntual al dashboard que ya existe en src/features/dashboard/.
```

Continuar al Paso 2 sin esperar confirmacion. Si el usuario discrepa en algun momento de los pasos siguientes, ajustar.

**Si `$ARGUMENTS` esta vacio**: pedir al usuario que describa la idea.

### Paso 2 — Elegir el tipo de proyecto (razonamiento del agente)

Esta decision tambien es **juicio del agente**. No existe un matching por keywords ni un arbol de decision automatico. El agente lee el catalogo como **marco conceptual** y razona desde la idea completa del usuario para elegir el tipo que mejor encaja.

**Como hacerlo**:

1. Leer `catalog.md` (misma carpeta que este SKILL.md). El catalogo describe 28 tipos en 8 categorias, cada uno con su naturaleza, plataforma objetivo y compatibilidad con el stack Praxis.
2. Entender la **intencion real** de la idea del usuario:
   - ¿Que quiere que haga el producto final?
   - ¿Donde vive el producto (navegador, App Store, barra del sistema, terminal, etc.)?
   - ¿Quien es el usuario final y como llegaria al producto?
   - ¿Hay restricciones tecnicas explicitas o implicitas (rendimiento, acceso a hardware, offline, privacidad)?
3. Comparar esa intencion contra la naturaleza de cada categoria / tipo del catalogo. Elegir el tipo donde **la descripcion del catalogo describe mejor lo que el usuario quiere**, no donde coinciden palabras.
4. Si hay dos tipos candidatos con encaje razonable (por ejemplo: mobile nativa vs mobile con Expo), **decidir uno con criterio del agente** y documentar el porque en el brief generado (seccion `## Mi Vision` o `## Contexto`). Por la Regla 6 sub-regla (a): el agente decide y documenta, no pregunta. Si el usuario discrepa al revisar el brief, edita el archivo o re-trigerea.
5. Si ningun tipo describe bien la idea → elegir `custom-unknown` y activar el modo de investigacion libre (ver su receta).

**Reglas duras**:
- El catalogo es una **guia conceptual**, no una lista de palabras a buscar. El agente razona; no hace pattern-matching.
- Siempre comunicar al usuario el tipo elegido + la compatibilidad contra Praxis en una linea: `Lo clasifique como <tipo> (compatibilidad Praxis: <nivel>) porque <razon breve del razonamiento>`.
- Si el usuario objeta la clasificacion, reclasificar — no insistir.
- Nunca elegir un tipo por "cercania textual" si la naturaleza del proyecto no encaja.

### Paso 3 — Cargar recetas especificas (carga perezosa)

Una vez confirmado el tipo (ej. `desktop-macos-native`):

1. Leer `stacks/<tipo>.md` — la **Directiva de Stack** (KEEP/ADD/REPLACE/REMOVE/CONFIG).
2. Leer `playbooks/<tipo>.md` — los **targets de investigacion obligatorios**.

**NO cargar otros stacks/playbooks** — solo el del tipo detectado. Esto es critico para no saturar el contexto.

### Paso 4 — Investigar (con el playbook)

Ejecutar los **targets obligatorios** del playbook usando `WebSearch` + `WebFetch`:

- **Tipos catalogados**: minimo 3 busquedas obligatorias + las que sugiera el playbook.
- **Tipo `custom-unknown`**: minimo 5 busquedas (el contexto es mas debil).

Reglas duras de investigacion:
- **NUNCA inventar URLs** ni citar fuentes que no hayas consultado.
- **Priorizar docs oficiales** (las del playbook en "Fuentes primarias").
- **Registrar cada URL consultada** con una nota de lo encontrado — va en el brief al final.
- Si el tipo tiene variantes multiples (ej. `desktop-windows-native` tiene WinUI 3 vs WPF vs Avalonia), investigar los trade-offs y proponer una.

### Paso 5 — Anunciar hallazgos y avanzar

Por la Regla 6 sub-regla (a), el agente NO valida con el usuario antes de redactar — anuncia los hallazgos como informacion para que el usuario los lea mientras se redacta el brief, y avanza directo a Paso 6.

```
Investigue sobre [tema/tipo]. Esto es lo que encontre:

- [Hallazgo 1] — [fuente]
- [Hallazgo 2] — [fuente]
- [Hallazgo 3] — [fuente]

Voy a poner esta Directiva de Stack en el brief:
- KEEP: [lista]
- ADD: [lista]
- REPLACE: [lista]
- REMOVE: [lista]

Riesgos destacados: [1-2 items].

Redactando el brief ahora.
```

Proceder directo al Paso 6 sin esperar respuesta. El usuario validara el brief completo cuando este redactado y guardado.

### Paso 6 — Redactar el brief

Escribir el brief en **primera persona**, escalando la profundidad a lo que la idea pida (Paso 1). Las plantillas completas + reglas de redaccion viven en [`references/templates.md`](references/templates.md) — leerlas al entrar a este paso (progressive disclosure: la plantilla solo entra al contexto cuando se necesita).

Resumen operativo:
- **Estructura unica**: 3 lineas TL;DR + Mi Vision + Contexto e Investigacion + Directiva de Stack (KEEP/ADD/REPLACE/REMOVE/CONFIG) + `## Alcance por Fases` (con los campos estructurados por fase) + Supuestos + Fuera de Alcance + Evaluacion + Fuentes.
- **Escalar profundidad**: un proyecto completo lleva varias fases y Directiva completa; una feature acotada lleva una o dos fases y una Directiva de deltas (bloques vacios con "ninguno"). La estructura es la misma — solo cambia el detalle. El brief siempre se convierte en **un solo PRP** que cubre todas las fases.
- **Voz**: SIEMPRE primera persona del usuario ("Quiero...", "He decidido...", "Despues de investigar..."). NUNCA tercera persona en el brief.

### Paso 7 — Guardar brief y anunciar plan de ejecucion

Por la Regla 6 sub-regla (a), el agente NO pide validacion del brief completo — lo guarda directamente. El archivo es el artefacto que el usuario revisa en su tiempo. Si el usuario discrepa, edita el archivo o re-trigerea **+ Brief**.

1. Convertir el titulo a **kebab-case** (ej. "Biblioteca de libros macOS" → `biblioteca-libros-macos`).
2. Nombre del archivo: **siempre** `BRIEF-{tema-kebab}.md` (un solo tipo de brief — sin prefijo `MASTER`).
3. Manejar colision automaticamente: si ya existe el archivo en `docs/`, sufijar con `-2`, `-3`, etc. sin preguntar (Regla 6 sub-regla a — el agente decide). Anunciar la decision en el reporte.
4. **Guardar en `docs/{filename}.md`** — carpeta canonica desde PRP-040. El tool `Write` del agente crea la carpeta `docs/` automaticamente si no existe (no requiere `mkdir` previo). **Caso edge raro**: si la raiz del proyecto ya tiene un archivo (no carpeta) llamado `docs`, guardar en raiz como degradacion y avisar al alumno en voz Juan Lara ("Quise guardar en `docs/` pero ya tienes un archivo con ese nombre. Lo dejo en raiz por ahora — si quieres que use `docs/`, renombra ese archivo y vuelve a generarlo."). El `briefScanner` ya tiene fallback retrocompatible — el `prp` Paso 0 sigue encontrandolo.
5. Anunciar al usuario con dos componentes obligatorios — sintaxis correcta + plan de ejecucion explicito.

   **Componente A — Sintaxis correcta de Claude Code**:

   ```
   Brief guardado en docs/BRIEF-{tema}.md.

   Para convertirlo en PRP: invoca @.claude/skills/prp/SKILL.md
   y referencia este brief con @docs/BRIEF-{tema}.md como entrada.
   (En la extension Praxis: presiona el boton + PRP — la skill auto-detecta este brief.)
   ```

   **Componente B — Plan de ejecucion explicito** (siempre el mismo — un solo PRP cubre todas las fases):

   ```
   Tu plan de ejecucion (1 PRP que cubre las N fases del brief):

     1. Presiona + PRP → genero UN solo PRP que abarca todas las fases del
        `## Alcance por Fases` de este brief, con la Directiva, Supuestos y
        Fuera de Alcance heredados.
     2. Aprueba el PRP cuando estes listo (o edita lo que quieras antes).
     3. Presiona ⚡ Run → bucle-agentico ejecuta las fases una por una,
        generando las subtareas de cada fase en el momento. Al cerrar, marca
        todas las fases del brief como COMPLETADO y guarda los aprendizajes.
   ```

   El alumno principiante debe salir del brief sabiendo **exactamente** que presionar despues y por que: un brief, un PRP, un Run.

---

## Reglas duras

- **Carga perezosa obligatoria**: cargar solo `stacks/<tipo>.md` + `playbooks/<tipo>.md` del tipo detectado, NUNCA los 30+ de golpe.
- **Siempre en primera persona** — el brief suena como el usuario, no como la IA.
- **Siempre Directiva de Stack** — bloques KEEP/ADD/REPLACE/REMOVE/CONFIG son **obligatorios** en ambas estructuras (incluso si algun bloque queda vacio con "ninguno").
- **Siempre investigar en la web** antes de redactar — no alucinar stacks ni versiones.
- **Siempre fuentes reales** al final — URLs que consultaste.
- **Nunca validar** con el usuario antes de guardar (Regla 6: guardar directo, el archivo es el artefacto que el usuario revisa).
- **Nunca inventar URLs** ni fuentes.
- **Nunca crear PRPs** en esta skill (`/prp` se encarga).
- **Nunca implementar codigo** — esta skill es PLANIFICACION.
- **Nunca sobrescribir** un BRIEF-*.md existente sin avisar.
- **Nunca cargar todos los stacks/playbooks** — carga perezosa por tipo.

---

## Despues del Brief

El brief es el primer paso del pipeline creativo de Praxis:

```
brief → BRIEF-{tema}.md
  ↓
prp → PRP-XXX-{feature-kebab}.md  (UN solo PRP — consume Directiva, Supuestos, Fuera de Alcance y TODAS las fases del brief)
  ↓
bucle-agentico → implementacion por fases (devuelve aprendizajes al brief al cerrar)
```

**Lo que documentes aqui no se pierde.** Lo que el PRP hereda al generarse:

- **TL;DR** — para que el agente entienda el norte sin leer el brief completo.
- **Directiva de Stack inicial** (KEEP/ADD/REPLACE/REMOVE/CONFIG) — copia integra en cada PRP. Cada PRP puede refinarla.
- **Supuestos** — el bucle-agentico los verifica al inicio de la ejecucion. Si alguno es falso, aborta.
- **Fuera de Alcance** — el PRP lo hereda para no proponer trabajo fuera del scope.
- **Tipo + compatibilidad Praxis** — define cual Trust Stack y cuales comandos de validacion aplican.
- **Fases** — el PRP las toma todas como su `## Plan de implementacion` (un PRP con N fases).

**Lo que el PRP devuelve al brief al cerrar** (gracias a `bucle-agentico` Paso 5):

- Estado de la fase: `EN PROGRESO → COMPLETADO` + fecha.
- Aprendizajes que afectaran fases siguientes (campo `Aprendizajes para fases siguientes`).
- Ajustes a la Directiva de Stack descubiertos en el codebase (campo `Ajustes a la Directiva de Stack`).

Asi el brief se vuelve **diario vivo del proyecto**: refleja lo que el plan inicial dijo + lo que la ejecucion enseño.

La doctrina recursiva completa vive en `@.claude/skills/bucle-agentico/SKILL.md`.
