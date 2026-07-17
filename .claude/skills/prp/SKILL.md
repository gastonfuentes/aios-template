---
name: prp
description: "Genera un PRP (Product Requirements Prompt — framework de Rasmus Widing / Wirasm), el blueprint de una feature antes de implementarla. Hereda Directiva de Stack, Supuestos y Fuera de Alcance del brief origen; mapea el codebase para investigar contexto; propone arquitectura por fases sin subtareas; y deja el plan en PENDIENTE para que el usuario apruebe presionando Run. Nunca implementa codigo. Activar antes de bucle-agentico, o cuando el usuario menciona planea esto, necesito un sistema de X, quiero agregar algo grande, dame un PRP, planifica esta feature, blueprint para X."
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
effort: max
---

# Skill: Generar PRP (Product Requirements Prompt)

> Generar un PRP para: $ARGUMENTS
>
> Esta skill cumple el [STYLE-GUIDE de skills Praxis](../STYLE-GUIDE.md) (Skills 2.0 spec + voz canonica + bundle structure). Leer antes de modificar.

> **NUNCA implementar codigo aqui.** Esta skill solo genera el documento PRP. La ejecucion la hace `bucle-agentico`. Si la tentacion aparece, escribir mas, no codificar.

---

## Mi rol en el patron recursivo

Soy el patron canonico (`bucle-agentico`) aplicado a **escala feature**.

- Mi **mapear** es leer el brief origen completo + codebase.
- Mi **planear** son las fases del PRP por nombre, sin subtareas.
- Mi **ejecutar** es delegar al `bucle-agentico` (escala subtarea).
- Mi **documentar** son las secciones heredadas del brief (Origen, Directiva, Supuestos, Fuera de Alcance, Aprendizajes heredados) + el Plan de implementacion.
- Mi **propagar** ocurre en dos momentos: (a) al aprobar el PRP, actualizo el brief origen marcando sus fases como `EN PROGRESO`; (b) los aprendizajes que el bucle deposite en el PRP volveran al brief al cerrar.

La doctrina completa vive en `@.claude/skills/bucle-agentico/SKILL.md`. Lee esa skill para entender el patron entero antes de generar este PRP.

---

## Que es un PRP

Un PRP (Product Requirements Prompt) es el **blueprint de una pieza de tu software**. Define QUE construir antes de escribir una sola linea de codigo.

Es el contrato humano-IA. El humano define el objetivo y el por que. La IA investiga contexto, propone la arquitectura, y genera el plan de fases. Juntos validan antes de ejecutar.

**Sin PRP**: vibe coding al aire, codigo espagueti, features que no encajan.
**Con PRP**: arquitectura clara, fases definidas, aprendizajes que persisten.

---

## Regla dura de generacion: un solo PRP, con fases

> **Siempre un PRP, sin importar el brief ni la idea.** Cada brief (o idea directa) se convierte en **UN solo PRP** que cubre TODAS las fases del `## Alcance por Fases` del brief como las fases de su `## Plan de implementacion`. No hay variantes ni modos: se acabaron "PRP master", "PRP single", "PRP unico monolitico", la cadena `## Predecesor` y el "1 PRP por fase". Las **subtareas de cada fase** NO se enumeran en el PRP — las genera el `bucle-agentico` al entrar a cada fase, con contexto fresco (eso preserva el patron canonico: "planea solo este nivel, no pre-planees el siguiente"). El `bucle-agentico` ejecuta las fases una por una y al cerrar marca todas las fases del brief como `COMPLETADO`.

---

## Proceso

> **Primera linea del proceso, antes que nada**: NUNCA implementar codigo en esta skill. Generamos un documento. Punto.

### Paso 0: Mapear contexto del nivel superior

Antes de cualquier otra cosa, mirar si hay un brief que este PRP deba heredar.

**Algoritmo**:

1. Detectar si `$ARGUMENTS` referencia un `BRIEF*.md`. Ubicaciones validas (en orden de preferencia):
   - **`docs/BRIEF*.md`** — ubicacion canonica desde PRP-040. Cuando el alumno presiona **+ PRP** en la extension, el path inyectado es `@docs/BRIEF-{tema}.md` para briefs nuevos.
   - **`BRIEF*.md`** (raiz del proyecto) — ubicacion legacy retrocompatible. Briefs creados antes de PRP-040 viven aqui; la extension los sigue detectando.
   - Aceptar tambien rutas absolutas o relativas explicitas del alumno (`@./mi-brief.md`, etc.). El `briefScanner` interno ya hace el merge docs/ + raiz con preferencia docs/.
   Si no hay brief detectable, saltar a Paso 1 con flujo legacy (entrevista directa al usuario).
2. Si hay brief: leerlo completo y extraer:
   - **TL;DR**.
   - **Directiva de Stack inicial** (KEEP/ADD/REPLACE/REMOVE/CONFIG).
   - **Supuestos**.
   - **Fuera de Alcance**.
   - **Tipo + compatibilidad con Praxis**.
   - **`## Alcance por Fases`** — TODAS las fases del brief. Estas se convierten en las fases del `## Plan de implementacion` del PRP unico (paso 5).
3. Acumular **aprendizajes heredados** relevantes: del propio brief (si alguna fase ya tiene `Aprendizajes para fases siguientes` poblado de una corrida previa) + de `CLAUDE.md` transversal. En el caso normal (brief recien creado) no hay aprendizajes previos.

#### Un solo PRP que cubre todas las fases

No hay maquina de estado ni decision de modo. El PRP que generas en el Paso 5 cubre **todas** las fases del `## Alcance por Fases` del brief, en orden, como las fases de su `## Plan de implementacion`. El `bucle-agentico` las ejecuta una por una y al cerrar marca todas las fases del brief como `COMPLETADO`.

#### Casos borde de Paso 0

- **Brief sin Directiva de Stack** (alumno la borro): aplicar Trust Stack Praxis default automaticamente y anunciar la decision en el PRP generado (Regla 6: el agente decide y documenta, no pregunta). Cero gate.
- **Brief con compatibilidad MATCH**: el PRP heredara Trust Stack default + la Directiva queda como referencia documental con bloques mayormente vacios.
- **Brief con todas sus fases ya `COMPLETADO`** (re-trigger sobre un brief terminado): reportar el estado al usuario en una linea simple ("Todas las fases de este brief ya estan terminadas. No genero un PRP nuevo.") + terminar sin accion. El usuario sabra que hacer (crear un brief nuevo o pedir extender el actual).
- **Brief ausente**: flujo legacy completo (entrevista breve en Paso 2).

### Paso 1: Leer el template base

Lee el template base de PRP, en orden de preferencia:

1. `references/prp-template.md` (dentro del bundle de esta skill — fuente de verdad canonica).
2. `.claude/PRPs/prp-base.md` (fallback de compatibilidad para proyectos historicos).

El template contiene la estructura completa, las secciones obligatorias (incluyendo `## Origen`, `## Directiva de Stack heredada`, `## Supuestos heredados`, `## Fuera de Alcance heredado`, `## Aprendizajes heredados de fases previas`), y ejemplos de cada campo. Usalo como referencia para generar el PRP.

### Paso 2: Entrevistar al usuario (solo si NO hay brief origen y tras investigar)

Si Paso 0 detecto un brief, **saltar este paso** — lo heredado del brief ya cubre objetivo, criterios, restricciones y stack.

Si NO hay brief, **investigar primero** (Regla 6 principio cardinal — investigar antes de preguntar):

1. Leer el workspace: `BUSINESS_LOGIC.md`, `README.md`, `CLAUDE.md`, PRPs previos en `.claude/PRPs/`, `package.json`, ultimo `git log -10 --oneline`. Cualquier informacion inferible (objetivo del proyecto, restricciones tecnicas, contexto de negocio) sale de aqui.
2. Solo despues de investigar, evaluar que falta. Si `$ARGUMENTS` + lo investigado ya son suficientes para redactar el PRP → saltar este paso.

Si tras investigar todavia falta informacion critica, hacer **una sola batch de 1-3 preguntas** en lenguaje cotidiano (Regla 6 sub-regla d — voz Juan Lara). Cero iteracion. Ejemplo de batch:

```
Antes de armar el plan necesito un par de cosas:

  • ¿Que quieres que haga esta funcion cuando este lista?
  • ¿Para que te va a servir?
  • ¿Hay algo que NO deba tocar? (si no se te ocurre nada, dejalo en blanco)
```

NUNCA preguntar "criterios de exito medibles", "restricciones tecnicas", "valor de negocio" — esa es jerga prohibida (PRP-027). Reformular en lenguaje cotidiano.

### Paso 3: Investigar contexto del codebase

Antes de escribir el PRP, investiga el codebase:

- **Grep/Glob**: buscar codigo existente relacionado con la feature.
- **Read**: leer archivos relevantes para entender patrones actuales.
- **Supabase** (o equivalente del stack heredado): si involucra BD, verificar tablas y estructura existente.

Esto alimenta las secciones de Contexto y Modelo de datos del PRP.

### Paso 4: Anunciar arquitectura propuesta y avanzar

Por la Regla 6 sub-regla (a), el agente NO valida con el usuario antes de redactar — decide y avanza. Anuncia la arquitectura como informacion para que el usuario la lea mientras se redacta:

```
Mapee el contexto. Voy a poner esto en el PRP:

- Objetivo: [una linea derivada del brief o de tu input]
- Fases: [lista corta por nombre, sin subtareas]
- Decisiones de arquitectura clave: [3-5 puntos]
- Refinamientos a la Directiva heredada (si los hay): [lista o "ninguno"]
- Aprendizajes heredados que aplican: [lista o "ninguno"]

Redactando ahora.
```

Proceder directo al Paso 5 sin esperar respuesta. El usuario validara el PRP completo cuando este redactado (presionando ⚡ Run, que es la confirmacion implicita).

### Paso 5: Generar el PRP

Crear el archivo PRP siguiendo el template de `prp-base.md`.

**Nombre del archivo**: `.claude/PRPs/PRP-{numero}-{feature-kebab}.md`

Donde:
- `{numero}` es un entero de 3 digitos con padding (`001`, `002`, ...).
- `{feature-kebab}` es el nombre de la feature en kebab-case.

**Asignacion del numero (obligatorio antes de crear el archivo)**:

Para evitar colisiones con PRPs etiquetados pero sin archivo formal, ejecutar SIEMPRE estos dos comandos antes de elegir el numero:

```bash
ls .claude/PRPs/
grep "PRP-" CLAUDE.md
```

El siguiente numero disponible es `max(numeros encontrados en ambas fuentes) + 1`. Si ninguna fuente tiene PRPs, empezar en `001`.

**Contenido obligatorio** (orden y voz):

- `## Origen` — primera persona si viene del brief; impersonal "planificacion directa, sin brief previo." si no.
- `## Objetivo` — primera persona ("Quiero...", "Necesito..."), heredado del brief.
- `## Por Que` — primera persona, hereda el porque del brief.
- `## Que` (Criterios de exito + Comportamiento esperado + Casos borde) — impersonal.
- `## Contexto` (Documentacion externa, Codigo existente, Gotchas, Modelo de datos) — impersonal.
- `## Directiva de Stack heredada` — copia integra del brief o "no hay brief origen — Trust Stack default Praxis".
- `## Supuestos heredados` — copia exacta del brief o "no hay supuestos heredados".
- `## Fuera de Alcance heredado` — copia exacta del brief o "no hay brief origen — Fuera de Alcance vacio".
- `## Aprendizajes heredados de fases previas` — concatenacion en orden cronologico de los `Aprendizajes para fases siguientes` de cada fase COMPLETADO previa, o "primer PRP del brief" / "no hay brief origen".
- `## Plan de implementacion` (SOLO fases, sin subtareas) — impersonal.
- `## Aprendizajes` (vacia al inicio) — impersonal.
- `## Anti-patrones` — impersonal.

**Trust Stack (referencia)** — incluir esta seccion en el PRP solo si la `Compatibilidad con Praxis` heredada del brief es `MATCH` o `EXTEND`. Para `PARTIAL`, `REPLACE_FRONT`, `REPLACE`, omitirla y referenciar la Directiva heredada como fuente de verdad del stack.

**Comandos de validacion final** — derivarlos del tipo de proyecto del brief origen. Cuando no hay brief, defaults Praxis: `npx tsc --noEmit`, `npm run build`, `npm test`, Playwright.

**El `## Plan de implementacion` cubre todas las fases del brief**:

- `## Origen` cita el brief (si lo hay) y explicita que el PRP cubre TODAS sus fases.
- `## Plan de implementacion` enumera `### Fase 1`, `### Fase 2`, ..., `### Fase N` — una por cada fase del `## Alcance por Fases` del brief, en el mismo orden. Cada fase: `**Objetivo**:` (heredado del campo "Objetivo high-level" de la fase del brief) + `**Validacion**:` (criterios concretos derivados). Sin subtareas (las genera el `bucle-agentico`).
- `## Anti-patrones` incluye explicitamente `NO generar nuevos PRPs durante la ejecucion de este PRP` (un PRP = una sola sesion, un solo plan).
- `## Aprendizajes` se rellena durante la ejecucion del bucle pero se filtra al cierre con criterios discriminativos (PASO 5.3 del `bucle-agentico`).

### Paso 6: Anunciar el PRP generado y dejarlo en PENDIENTE

Por la Regla 6 sub-regla (a), el agente NO pide validacion del PRP completo — lo guarda en `PENDIENTE` y anuncia que esta listo. La presion de **⚡ Run** del usuario es la transicion implicita a `APROBADO`. Si el usuario quiere editar antes, abre el archivo y edita directo.

Anunciar (sin pregunta):

```
Plan listo en .claude/PRPs/PRP-XXX-{kebab}.md.

- Origen: [brief @docs/BRIEF-{tema}.md / planificacion directa]
- Objetivo: [una linea]
- Numero de fases: [N]
- Decisiones de arquitectura clave: [bullets]

Cuando quieras ejecutarlo, presiona ⚡ Run. Si quieres ajustar algo antes,
abre el archivo y editalo — los cambios que hagas se respetan.
```

**NO implementes nada todavia.** El PRP esta en `PENDIENTE` esperando el ⚡ Run del usuario.

### Paso 7: Al aprobar el PRP, actualizar el brief origen

Cuando el usuario apruebe el PRP (cambia `> **Estado**: PENDIENTE` a `> **Estado**: APROBADO`):

- Si hay brief origen, recorrer TODAS las fases de `## Alcance por Fases` (el PRP unico las cubre todas) y para cada una:
  - `Estado: PENDIENTE → EN PROGRESO`.
  - `Iniciada: YYYY-MM-DD` (fecha de hoy).
- Si no hay brief origen, omitir este paso.

---

## Despues del PRP

Una vez aprobado, la implementacion se hace con `@.claude/skills/bucle-agentico/SKILL.md`, que:

- Lee el PRP y extrae las secciones heredadas.
- Verifica los Supuestos heredados antes de arrancar.
- Aplica una Fase 0 implicita si la Directiva tiene bloques REMOVE/ADD/REPLACE/CONFIG no vacios.
- Ejecuta sub-fases con mapeo de contexto fresco antes de cada una.
- Al cerrar, propaga aprendizajes al PRP, al brief origen, y a CLAUDE.md transversal.

Los aprendizajes descubiertos durante la implementacion se documentan de vuelta en el PRP (seccion `## Aprendizajes`) para que el conocimiento persista.

---

## Reglas

- **NUNCA implementar codigo en este skill.** Solo generar el documento. (Esta es la regla mas importante: si la tentacion aparece, parar y escribir mas en el PRP.)
- **SIEMPRE leer `prp-base.md`** antes de generar.
- **NUNCA generar subtareas** dentro de las fases (eso lo hace `bucle-agentico` al entrar a cada fase).
- **SIEMPRE investigar el codebase** antes de proponer arquitectura.
- **SIEMPRE asignar numero** con `ls .claude/PRPs/` + `grep "PRP-" CLAUDE.md` antes de crear el archivo.
- **El PRP nace en estado `PENDIENTE`** hasta que el usuario apruebe.
- **Un solo PRP** — siempre uno, cubre todas las fases del brief; nunca cadenas de PRPs ni modos.
- **Al aprobar, actualizar el brief origen** si lo hay (Paso 7).
