---
name: bucle-agentico
description: "Ejecuta features complejas por fases con mapeo de contexto real antes de cada fase, en lugar de generar todas las subtareas al inicio basadas en suposiciones. Lee el PRP aprobado, verifica supuestos empiricamente, aplica Fase 0 si la Directiva tiene delta de stack, genera las subtareas de cada fase just-in-time con Auto-Refuerzo cuando hay errores, y al cerrar propaga aprendizajes al PRP, brief y CLAUDE.md. Es la doctrina canonica del patron recursivo de Praxis. Activar cuando el usuario presiona Run sobre un PRP aprobado, o cuando la tarea toca multiples archivos, BD + UI + codigo coordinados, fases que dependen una de otra."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch, Agent
effort: max
---

# Bucle-agentico: modo por fases

> "No planifiques lo que no entiendes. Mapea contexto, luego planifica."
>
> Esta skill cumple el [STYLE-GUIDE de skills Praxis](../STYLE-GUIDE.md) (Skills 2.0 spec + voz canonica + bundle structure). Excepcion documentada: la seccion "Mi rol" abajo usa primera persona del agente porque la skill ES la doctrina canonica autorreferencial.

El modo por fases es para sistemas complejos que requieren construccion por fases con mapeo de contexto por fase.

---

## El patron recursivo (la doctrina)

> **"Mapea. Planea solo este nivel. Ejecuta. Documenta. Propaga aprendizajes hacia arriba."**

Esta skill no es una herramienta mas: es la **doctrina canonica** de la metodologia de Praxis. La misma operacion se aplica a tres escalas:

```
ESCALA PROYECTO  ──► brief
                     │ Mapea: idea + investigacion web + workspace
                     │ Planea: fases por nombre + Directiva inicial de Stack
                     │ Ejecuta: ⟶ delega cada fase al PRP (escala feature)
                     │
                     ▼
ESCALA FEATURE   ──► prp
                     │ Mapea: brief origen completo + codebase actual
                     │ Planea: las fases del PRP por nombre, sin subtareas
                     │ Ejecuta: ⟶ delega al bucle-agentico (escala subtarea)
                     │
                     ▼
ESCALA SUBTAREA  ──► bucle-agentico  (esta skill)
                       Mapea: PRP origen + estado real del momento
                       Planea: subtareas just-in-time
                       Ejecuta: subtarea por subtarea
                       Documenta: aprendizaje
                                  ↑ propaga al PRP (seccion Aprendizajes)
                                        ↑ propaga al brief (Aprendizajes para fases siguientes)
                                              ↑ propaga a CLAUDE.md (Aprendizajes Auto-Refuerzo)
```

**Reglas duras del patron** (aplicables a cualquier escala):

1. **No planees con suposiciones.** Mapea contexto real antes de planear este nivel. Pre-planear el nivel siguiente esta prohibido — eso es trabajo del nivel siguiente cuando entre.
2. **Solo planeas tu nivel.** Ningun nivel detalla la planificacion del nivel inferior. El brief planea fases; el PRP las hereda como su plan. Ninguno de los dos detalla las subtareas del bucle — esas se generan al entrar a cada fase.
3. **Documenta aprendizajes localmente y propagalos hacia arriba.** Cada nivel escribe en su propia seccion de aprendizajes y, al cerrar, propaga lo que afecte a niveles superiores.
4. **Cada nivel tiene un lifecycle con tres estados base** — `PENDIENTE → EN PROGRESO → COMPLETADO` — mas estados intermedios apropiados a cada escala. El PRP introduce un cuarto estado `APROBADO` entre `PENDIENTE` y `EN PROGRESO` para marcar la aprobacion humana antes de la ejecucion (lifecycle del PRP completo: `PENDIENTE → APROBADO → EN PROGRESO → COMPLETADO`). El brief fase y la subtarea operan con los tres estados base. El nivel que ejecuta es el dueño de las transiciones.
5. **Cada nivel actualiza al nivel superior al cerrar.** El bucle al terminar actualiza el PRP. El PRP al terminar actualiza el brief. El brief al terminar actualiza CLAUDE.md transversal.
6. **Autonomia total dentro de cada nivel.** El usuario interactua con el pipeline solo en los triggers: aportar la idea inicial, presionar **+ Brief**, **+ PRP**, **⚡ Run**. Entre triggers, cada nivel ejecuta 100% autonomo bajo este principio cardinal y sus cinco sub-reglas:

   **Principio cardinal — investigar antes de preguntar.** Cualquier pregunta al usuario en cualquier punto del pipeline esta precedida por una fase de investigacion agotada. El agente nunca pregunta lo que puede averiguar leyendo el codebase, ejecutando comandos diagnosticos, consultando MCPs, buscando en la web, o revisando los aprendizajes de `CLAUDE.md`. Solo pregunta cuando la respuesta no es fisicamente derivable del estado del mundo accesible al agente.

   **(a) Decisiones tecnicas las toma el agente.** Stack, arquitectura, tipo, fases, naming, ordenamiento — el agente decide usando criterio + doctrina + aprendizajes heredados. Anuncia la decision y la deja documentada en el artefacto producido (brief.md, PRP.md, codigo, commit). Si el usuario discrepa al revisar el artefacto, edita el archivo o re-trigerea el nivel. Nunca pregunta *"¿confirmas?"* mid-proceso.

   **(b) Resolucion de errores con protocolo de investigacion.** Cuando algo falla, el agente agota todas sus herramientas antes de detenerse, en este orden: (1) leer el error completo + stack trace + logs relevantes, (2) `grep`/`glob` el codebase por patrones similares ya resueltos, (3) usar MCPs disponibles para diagnosticar (`next-devtools`, `playwright`, `supabase`, etc.), (4) `WebSearch` + `WebFetch` para docs oficiales y soluciones, (5) leer aprendizajes en `CLAUDE.md` por si el mismo error ya fue resuelto antes, (6) intentar fixes alternativos iterando hasta resolver. Cada error resuelto se documenta en el PRP (seccion `## Aprendizajes`) sin preguntar.

   **(c) Escalacion al usuario solo si es fisicamente imposible continuar.** Tres unicos casos validos, **y solo despues de investigacion agotada**: **(c1)** la solucion requiere algo que solo el usuario puede aportar (API keys, cuentas pagas externas, credenciales OAuth, hardware), **(c2)** descubre que el alcance aprobado del nivel superior es objetivamente erroneo y necesita re-aprobacion (no un ajuste menor — un error estructural), **(c3)** una accion destructiva no anticipada por el plan aprobado afectaria trabajo del usuario fuera del scope del PRP. Cualquier otra "duda" se resuelve investigando.

   **(d) Lenguaje de las escalaciones.** Cuando el agente si debe preguntar al usuario (informacion de entrada en triggers, o escalaciones c1/c2/c3), las preguntas siguen las **Reglas de copy publico** de `CLAUDE.md`: voz cercana de Juan Lara, español 100%, sin jerga tecnica, estructura `[que paso / que necesito] + [que hacer / que decidir] + [como seguimos]`. El usuario es alguien aprendiendo Vibe Coding, no un dev senior. Cero "env var", "schema", "stack trace", "criterios de exito medibles" sueltos. Las preguntas tienen maximo 2-3 opciones, formuladas como elecciones simples ("A o B, ¿cual prefieres?"), nunca como ceremonia tecnica ("¿confirmas?", "¿procedes?", "¿quieres iterar?"). Si la pregunta requiere contexto tecnico, el agente lo explica en lenguaje cotidiano antes de preguntar.

   **(e) Operaciones git y GitHub son responsabilidad exclusiva del agente.** El agente nunca le pide al usuario que haga commit, push, stash, pull, ni cualquier accion de git o GitHub. El usuario no tiene que conocer estos comandos para usar Praxis.

   Si el agente encuentra el arbol de git sucio (archivos modificados o staged) antes de empezar o durante la ejecucion, los inspecciona y decide:

   - **Cambios triviales** (lockfiles autogenerados, archivos de build, whitespace, archivos en `.gitignore` que se filtraron) → el agente los maneja autonomamente (stash temporal, los incluye en su proximo commit, o los descarta segun contexto). Anuncia que hizo en el reporte final, no pregunta.
   - **Cambios sustanciales** (codigo que parece intencional, archivos nuevos con contenido propio) → el agente pregunta al usuario en lenguaje simple **solo sobre intencion**, nunca sobre la mecanica git. El agente ejecuta la accion git que corresponda segun la respuesta.

   Cualquier "validar con el usuario", "¿esto se alinea?", "¿confirmas?" durante un nivel `EN PROGRESO` que no caiga en (c1)/(c2)/(c3) es ruido y rompe el contrato del nivel superior.

---

## Mi rol: doctrina + aplicacion a subtarea

Esta skill cumple **dos funciones simultaneas**:

1. **Documento canonico del patron recursivo.** Las otras dos skills (`brief` y `prp`) son instancias del mismo patron a sus escalas respectivas y se refieren a este documento como fuente de verdad.
2. **Aplicacion especifica del patron a escala subtarea.** Cuando se invoca con un PRP referenciado, ejecuta el patron concreto: mapea el PRP, entra fase por fase generando las subtareas de cada una just-in-time, ejecuta subtareas, documenta aprendizajes, propaga al PRP / brief / CLAUDE.md.

Cuando leas el resto de este archivo, los pasos 1-5 son la **aplicacion** del patron a escala subtarea. La doctrina arriba es el **patron** que esos pasos instancian.

---

## Cuando Usar por fases

Aplica cuando la tarea coordina multiples componentes (DB + codigo + UI), las fases dependen una de otra, o requiere entender contexto del codebase antes de implementar. Ejemplos: sistemas de auth con roles, notificaciones en tiempo real, dashboards con metricas, facturacion con Stripe, CRUDs completos con imagenes, migraciones de arquitectura.

---

## La Innovacion Clave: Mapeo de contexto por fase

El enfoque tradicional genera todas las subtareas al inicio basandose en **suposiciones**. El bucle-agentico genera solo FASES upfront, y al ENTRAR a cada fase mapea **contexto real** (codebase + lo construido en fases previas) antes de generar subtareas. Cada fase se planifica con informacion REAL del estado actual del sistema.

```
Recibir problema -> Generar solo FASES (sin subtareas)
                 |
                 v
+--> ENTRAR fase N -> MAPEAR contexto real -> GENERAR subtareas -> EJECUTAR
|        (incluye lo construido en fases previas)                       |
+-------------------- repetir hasta agotar fases ----------------------+
```

---

## El Flujo por fases

### PASO 0: MAPEAR CONTEXTO DEL NIVEL SUPERIOR (leer el PRP)

Antes de cualquier otra cosa, leer el archivo PRP referenciado en `$ARGUMENTS` y extraer todos los datos heredados:

- **Estado actual** del PRP (`PENDIENTE` / `APROBADO` / `EN PROGRESO` / `COMPLETADO`).
- **Objetivo** + **Por Que** + **Criterios de exito**.
- **Plan de implementacion** (las fases que debes ejecutar).
- **Directiva de Stack heredada** (KEEP/ADD/REPLACE/REMOVE/CONFIG).
- **Supuestos heredados**.
- **Fuera de Alcance heredado**.
- **Aprendizajes heredados de fases previas**.
- **Origen** — si el PRP referencia un `BRIEF*.md`, guardar la ruta y la fase del brief.

#### Lifecycle: auto-flip a EN PROGRESO + analisis de git tree

Por la Regla 6 (autonomia total), la invocacion del bucle ES la confirmacion del usuario. El agente no pide validaciones adicionales — flippea estados automaticamente y analiza el contexto:

- Si el PRP esta `APROBADO`: cambiar a `> **Estado**: EN PROGRESO` y continuar.
- Si el PRP esta `PENDIENTE`: **auto-flip** `PENDIENTE → APROBADO → EN PROGRESO` (la invocacion del bucle es la aprobacion implicita del usuario) y continuar. Anuncia el flip en el reporte final.
- Si el PRP esta `EN PROGRESO`: continuar (ejecucion reanudada).
- Si el PRP esta `COMPLETADO`: anunciar *"Re-ejecutando este plan que ya estaba terminado."* + ejecutar **analisis de git tree** (siguiente bloque) antes de proceder.

#### Analisis de git tree (al inicio + en re-ejecucion de COMPLETADO)

Por la Regla 6 sub-regla (e), git/GitHub son responsabilidad exclusiva del agente. Antes de empezar:

1. Ejecutar `git status --short` + `git diff --stat` para detectar cambios sin guardar.
2. Si el arbol esta limpio → continuar sin acciones.
3. Si hay cambios, clasificarlos por inspeccion del diff:
   - **Triviales**: lockfiles autogenerados (`package-lock.json`, `yarn.lock`), archivos de build (`dist/`, `.next/`), whitespace, archivos en `.gitignore` que se filtraron, archivos generados por scripts del propio proyecto. → El agente los maneja autonomamente (stash + restore al final, o incluir en el commit final segun contexto). Anunciar en el reporte final, no preguntar.
   - **Sustanciales**: codigo que parece intencional, archivos nuevos con contenido propio, ediciones a archivos del usuario. → Investigar `git log` para ver autoria + timing. Si el agente puede determinar que son de la sesion actual (suyos) → manejarlos autonomamente. Si parece autoria del usuario → **escalar como (c3) limitado**: pregunta al usuario en lenguaje simple sobre **intencion** (no sobre mecanica git), con voz Juan Lara.

Ejemplo de pregunta sustancial (sub-regla d aplicada):

```
Antes de re-ejecutar este plan vi que hay cosas a medio guardar
en tu proyecto:

  • src/features/dashboard/page.tsx (modificado)
  • src/components/UserCard.tsx (nuevo)

¿Estos cambios los hiciste tu? Y si si, ¿que prefieres?

  A) Guardalos antes de seguir — yo los guardo con tu nombre
     y luego ejecuto el plan.
  B) Dejalos de lado por ahora — los aparto, ejecuto el plan,
     y al final te los devuelvo encima.
  C) Son mios de una ejecucion anterior — yo los limpio
     y empiezo de cero.
```

Acciones del agente segun respuesta (todas autonomas, ninguna requiere que el usuario tipee git):

- A → `git add <files> + git commit -m "wip: cambios del usuario antes de re-ejecutar PRP-XXX"` + procede.
- B → `git stash push -m "praxis: cambios del usuario antes de PRP-XXX"` + procede + al final `git stash pop` (si conflicto al hacer pop → escalacion c3 con explicacion simple).
- C → `git checkout -- <files> + git clean -fd <files>` + procede.

### PASO 0.5: VERIFICAR SUPUESTOS EMPIRICAMENTE

Por la Regla 6 (principio cardinal: investigar antes de preguntar), el agente NO presenta los supuestos al usuario para confirmacion. Los verifica empiricamente contra el estado real del mundo y solo escala los irresolubles.

Por cada Supuesto heredado del PRP:

1. **Intentar verificacion empirica** segun la naturaleza del supuesto:
   - "Existe la dep X" → `npm ls <X>` o `cat package.json | grep <X>`.
   - "El archivo Y existe" → `test -f <Y>`.
   - "La tabla Z tiene columna C" → MCP Supabase `list_tables` o `execute_sql`.
   - "El binario W esta instalado" → `which <W>`.
   - "La env var V esta seteada" → buscar en `.env.local`, `.env`, `.env.production`, env vars del sistema, keychain, configs del proyecto.
   - "El servicio externo S responde" → `curl` o `WebFetch`.
   - "El usuario tiene cuenta paga en P" → no verificable empiricamente; asumir verdadero (fue aprobado en el PRP) y anotar en reporte final.
2. **Si verificable y verdadero** → seguir silente.
3. **Si verificable y falso pero auto-resoluble** (dep faltante, archivo a generar, columna a crear, binario a instalar) → resolver autonomamente y anunciar en el reporte final. Cero pregunta al usuario.
4. **Si verificable y falso e irresoluble** (requiere credencial externa, cuenta paga, hardware, accion solo del usuario) → **escalacion (c1)** con instrucciones claras en voz Juan Lara (sub-regla d). Mensaje patron:

   ```
   Para seguir necesito tu <recurso>. <Una linea explicando que es y para que>.

   Como conseguirlo:
   1. <Paso 1 simple>
   2. <Paso 2 simple>
   3. <Donde pegarlo / que hacer con el>

   Cuando lo tengas, presiona ⚡ Run de nuevo y sigo desde donde quede.
   ```

5. **Si no verificable empiricamente** (asuncion sobre el usuario o el mundo externo no inspeccionable) → asumir verdadero (fue aprobado al aprobar el PRP), anotar en el reporte final como *"supuestos no verificados: [...]"*.

Si no hay supuestos heredados, saltar este paso.

### PASO 0.7: ANUNCIAR MAPEO Y ARRANCAR

Por la Regla 6 sub-regla (a), el agente NO valida con el usuario antes de empezar — la aprobacion del PRP ya es la confirmacion. Anuncia el mapeo extraido y arranca sin esperar respuesta:

```
Empezando ejecucion de @.claude/PRPs/PRP-XXX-{kebab}.md.

- Estado del PRP: <APROBADO/PENDIENTE/EN PROGRESO/COMPLETADO> → EN PROGRESO.
- Fases: [lista por nombre]
- Fase 0 implicita (delta de Directiva): [si / no — si si, listar el delta brevemente]
- Aprendizajes heredados aplicables: [lista o "ninguno"]
- Supuestos verificados empiricamente: [N de M; los irresolubles ya escalados como c1, si los hay]
- Tras todas las fases, PASO 5 ejecuta validacion final + housekeeping.

Voy.
```

Proceder directo al PASO 1 (DELIMITAR Y DESCOMPONER) sin esperar confirmacion. Si el usuario interrumpe en algun momento, ajustar.

### Fase 0 implicita (aplicar delta de Directiva)

Cuando la Directiva de Stack heredada tiene bloques **REMOVE / ADD / REPLACE / CONFIG no vacios**, anteponer una **Fase 0 nueva ANTES de la Fase 1**, dedicada exclusivamente a aplicar el delta de stack.

Fase 0:
- Tiene su **propio mapeo de contexto** (¿cual es el codebase actual?, ¿que hay que quitar primero?).
- Tiene sus **propias subtareas** (uninstall paquetes, scaffolding nuevo, mover/renombrar carpetas, configs).
- **No es la Fase 1 con delta** — es independiente, se ejecuta primero, y solo despues entra la Fase 1.

Ejemplo concreto: Directiva dice `REMOVE: next`, `REPLACE: src/app → swift-package`. La Fase 0 desinstala `next` y hace scaffolding del Swift package. Recien entonces la Fase 1 (la primera fase del PRP, ej. "setup proyecto Swift") arranca sobre el codebase ya transformado.

Si la Directiva esta vacia o solo tiene KEEP, **no hay Fase 0** — entrar directo a la Fase 1.

### PASO 1: DELIMITAR Y DESCOMPONER EN FASES

```
+-------------------------------------------------------------+
|  PASO 1: DELIMITAR Y DESCOMPONER EN FASES                   |
|                                                              |
|  - Entender el problema FINAL completo                       |
|  - Romper en FASES ordenadas cronologicamente                |
|  - Identificar dependencias entre fases                      |
|  - NO generar subtareas todavia                              |
|  - Usar TodoWrite para registrar las fases                   |
+-------------------------------------------------------------+
```

### PASO 2: ENTRAR EN FASE N - MAPEAR CONTEXTO

ANTES de generar subtareas, explorar:

**Codebase:**
- Que archivos/componentes existen relacionados?
- Que patrones usa el proyecto actualmente?
- Hay codigo que puedo reutilizar?

**Base de Datos (Supabase MCP):**
- Que tablas existen?
- Que estructura tienen?
- Hay RLS policies configuradas?

**Dependencias:**
- Que construi en fases anteriores?
- Que puedo asumir que ya existe?
- Que restricciones tengo?

DESPUES de mapear, generar subtareas especificas y actualizar TodoWrite.

### PASO 3: EJECUTAR SUBTAREAS DE LA FASE

```
WHILE subtareas pendientes en fase actual:

  1. Marcar subtarea como in_progress en TodoWrite

  2. Ejecutar la subtarea

  3. [Dinamico] Usar MCPs si el juicio lo indica:
     - Next.js MCP -> Ver errores en tiempo real
     - Playwright -> Validar visualmente
     - Supabase -> Consultar/modificar DB

  4. Validar resultado
     - Si hay error -> AUTO-REFUERZO (ver paso 3.5)
     - Si esta bien -> Marcar completed

  5. Siguiente subtarea

Fase completada cuando todas las subtareas done.
```

### PASO 3.5: AUTO-REFUERZO (cuando hay errores) — protocolo de investigacion

El sistema se BLINDA con cada error. Por la Regla 6 sub-regla (b), cuando algo falla el agente agota TODAS sus herramientas antes de detenerse o escalar al usuario.

**Protocolo de investigacion (6 pasos en orden — solo escalar tras agotar):**

1. **Leer el error completo + stack trace + logs relevantes.** No saltarse el mensaje. La causa real suele estar en las ultimas 5 lineas del stack o en logs accesorios (Next.js MCP `get_logs`, `console.error`, error responses HTTP completos).
2. **`grep`/`glob` el codebase por patrones similares ya resueltos.** Buscar el nombre exacto del error, claves del stack trace, identificadores. Si el proyecto ya resolvio algo parecido antes, reutilizar el patron.
3. **Usar MCPs disponibles para diagnosticar.** `next-devtools` para errores runtime de Next.js, `playwright` para validar visualmente que renderiza, `supabase` para inspeccionar tablas/RLS/queries, etc. Cada MCP es una herramienta de diagnostico — no esperar a que el usuario diga "intenta con X".
4. **`WebSearch` + `WebFetch` para docs oficiales y soluciones.** Buscar el mensaje literal del error en docs oficiales del framework (Next.js, Supabase, Vercel AI SDK, etc.) y en GitHub issues del repo del paquete. Para errores de versiones especificas, anclar la busqueda con la version (`<error message> next 16.0.1`).
5. **Leer aprendizajes en `CLAUDE.md`** (seccion Aprendizajes Auto-Refuerzo) por si el mismo error ya fue resuelto antes en otro PRP. Cada aprendizaje viejo es un atajo.
6. **Iterar fixes alternativos.** Si la primera estrategia falla, probar la segunda. La mayoria de errores tienen 2-3 caminos validos — agotarlos antes de declarar el bloqueo.

**Solo despues de agotar los 6 pasos**, evaluar si el error cae en una escalacion legitima:

- (c1) Requiere credencial/cuenta externa que solo el usuario puede aportar → escalar con instrucciones simples (sub-regla d).
- (c2) Descubre que el alcance del PRP es objetivamente erroneo → escalar con A/B/C en lenguaje simple.
- (c3) Accion destructiva no anticipada por el plan → escalar con A/B/C.

Cualquier otro caso: **resolver, no preguntar**.

Tras resolver:

1. **DOCUMENTAR** el aprendizaje (formato abajo).
2. Continuar con la subtarea.

**Formato de documentacion:**

```markdown
### [YYYY-MM-DD]: [Titulo corto]
- **Error**: [Que fallo exactamente]
- **Fix**: [Como se arreglo]
- **Aplicar en**: [Donde mas aplica este conocimiento]
```

| Tipo | Documentar en | Quien |
|------|---------------|-------|
| Especifico de subtarea | PRP (seccion Aprendizajes) | bucle al fallar/arreglar |
| **Especifico de una fase, afecta otras fases del brief** | **Brief origen (campo `Aprendizajes para fases siguientes` de la fase afectada)** | **bucle al cerrar PRP** |
| Aplica a multiples features | Skill relevante (`.claude/skills/*/SKILL.md`) | bucle al fallar/arreglar |
| Aplica a TODO el proyecto | `CLAUDE.md` (seccion Aprendizajes) | bucle al cerrar PRP, si transversal |

El conocimiento persiste. El mismo error NUNCA ocurre dos veces en este proyecto ni en proyectos futuros.

### PASO 4: TRANSICIONAR A SIGUIENTE FASE

- Confirmar que fase actual esta REALMENTE completa
- NO asumir que todo salio como se planeo
- Volver a PASO 2 con la siguiente fase
- El contexto ahora INCLUYE lo construido

Repetir hasta completar todas las fases.

### PASO 5: VALIDACION FINAL + HOUSEKEEPING + PROPAGACION

Esta skill enforces los 4 housekeeping al cerrar — no son opcionales. Forman parte del contrato del bucle.

#### 5.1 Validacion tecnica

- Testing end-to-end del sistema completo (los comandos derivados de la Directiva de Stack heredada — para Praxis default: `npx tsc --noEmit`, `npm run build`, `npm test`).
- Validacion visual con Playwright si aplica.
- Confirmar que el problema ORIGINAL esta resuelto.

#### 5.2 Marcar el PRP como COMPLETADO

Cambiar la linea `> **Estado**: ...` del PRP a `> **Estado**: COMPLETADO`.

#### 5.3 Documentar aprendizajes — con filtro discriminativo (PRP-040)

Recorrer los aprendizajes capturados durante la ejecucion y rutearlos segun la matriz de PASO 3.5, **pero con filtro duro antes de tocar `CLAUDE.md` y `README.md`**. La regla canonica desde PRP-040: solo lo **estrictamente indispensable** se propaga a esos archivos. Lo tactico-iterativo queda en el PRP cerrado (siempre auditable con `git log`) y la **Auto memory nativa de Claude Code** (GA desde v2.1.59, ON por defecto, vive en `~/.claude/projects/<encoded>/memory/`) captura lo que el modelo considere util para sesiones futuras — sin que el agente Praxis duplique ese trabajo.

**Un aprendizaje SI se propaga a `CLAUDE.md` solo si cumple al menos uno de estos cinco criterios**:

1. **Invalida una regla canonica del `CLAUDE.md` actual** — contradice o reemplaza una doctrina previa. Sin propagar, el agente seguiria leyendo la regla vieja para siempre.
2. **Describe una limitacion arquitectural permanente del producto** (no de la iteracion) — algo que cualquier desarrollo futuro debe respetar.
3. **Cambia un contrato de API/seguridad/distribucion** — formato de payload cifrado, watermark, schema de release, marcadores de CLAUDE.md, paths canonicos, etc.
4. **Introduce una primitiva nueva del producto** que merece su propia seccion — un nuevo modo, un nuevo sistema, una nueva convencion.
5. **Es replicable a 3+ futuros features distintos** — un patron general aplicable mas alla del PRP que lo descubrio, no un fix puntual.

**Un aprendizaje NO se propaga a `CLAUDE.md`** si encaja en cualquiera de estos casos (la mayoria):
- Bug especifico ya arreglado en el commit — `git log -p` y el PRP cerrado lo cuentan completo.
- Refactor cosmetico sin consecuencias arquitecturales.
- Decision de naming/styling que el agente puede re-derivar leyendo el codigo actual.
- Fix que solo afecto esa iteracion y no es replicable.
- Aprendizaje tactico de "como se resolvio este problema concreto" — queda en el PRP cerrado, Auto memory de Claude lo captura si lo considera util.

**Criterios para `README.md`** (todavia mas estrictos — solo lo que afecta al usuario externo):
- El cambio afecta como el alumno USA el producto.
- El cambio afecta como se instala / actualiza / configura.
- El cambio modifica una promesa publica del producto.

**Matriz de ruteo (tras aplicar el filtro)**:

- Especificos de subtarea → seccion `## Aprendizajes` del PRP (ya estan ahi si se documentaron en el momento del fallo). **No requieren filtro** — el PRP es su home natural.
- Especificos de una fase, afectan otras fases del brief → propagar al brief origen (ver 5.5 abajo). **No requieren filtro** — el campo `Aprendizajes para fases siguientes` es su home natural.
- Aplican a multiples features → skill relevante (`.claude/skills/*/SKILL.md`). **Filtro suave**: solo si el aprendizaje cambia el comportamiento de la skill, no si es anecdota.
- Transversales al proyecto → `CLAUDE.md` (seccion Aprendizajes). **Filtro duro**: aplicar los 5 criterios de arriba. Esperado: 1-3 entries por PRP cerrado, no 5-10+.
- Visibles al usuario externo → `README.md`. **Filtro extra duro**: solo si cumple los criterios de README especificos.

**Auto memory: dejar que Claude capture lo tactico**

Cualquier alumno con Claude Code v2.1.59+ tiene Auto memory activa por defecto. El agente Praxis NO debe duplicar ese trabajo: las soluciones tacticas, los fixes especificos, los workarounds de iteracion ya quedan en el PRP cerrado (auditable) y Auto memory del propio Claude los capta si los considera utiles para sesiones futuras. La doctrina Praxis solo gestiona el conocimiento **estrategico** — el resto es responsabilidad del sistema nativo del cliente.

Self-check del agente antes de escribir en `CLAUDE.md`: *"¿Este aprendizaje cumple al menos uno de los 5 criterios? ¿O lo estoy propagando por habito heredado de PRPs viejos?"* Si la respuesta es "habito", NO propagar.

#### 5.4 Actualizar README y documentacion afectada

Auditar `README.md` y cualquier doc relevante (`CLAUDE.md`, READMEs en `src/features/<feature>/`, etc.) y actualizar lo que haya cambiado.

#### 5.5 Actualizar el brief origen (si lo hay) — cierre coordinado del brief entero

Si la seccion `## Origen` del PRP referencia un brief, el agente actualiza el brief directamente sin pedir confirmacion (Regla 6 sub-regla a). Como el PRP cubre **todas** las fases del brief, el cierre es siempre coordinado sobre el brief entero — no hay modos ni ramas:

1. Recorrer TODAS las fases del `## Alcance por Fases` del brief.
2. Para cada una: cambiar `Estado: EN PROGRESO → COMPLETADO` (o `PENDIENTE → COMPLETADO` si no se habia marcado en la aprobacion), llenar `Completada: YYYY-MM-DD` con la fecha de hoy, y `Iniciada: YYYY-MM-DD` si estaba vacia.
3. Distribuir los aprendizajes acumulados del PRP entre los campos `Aprendizajes para fases siguientes` y `Ajustes a la Directiva de Stack` de las fases correspondientes — agrupar por afinidad tematica con cada fase del brief. Si un aprendizaje es global a varias fases, ponerlo en la primera fase afectada y referenciarlo desde las siguientes.
4. **No propagar aprendizajes a `CLAUDE.md` aqui** — eso ya se hizo (o no) en PASO 5.3 aplicando el filtro discriminativo. Esta seccion solo toca el brief.
5. Listar en el reporte final del PASO 5.7 exactamente que se propago al brief, para que el usuario lo audite en su tiempo y edite si discrepa.

Si el PRP no tiene brief origen, omitir este paso.

#### 5.6 Commit + push (autonomo, sin pedir nada al usuario)

Por la Regla 6 sub-regla (e), el agente ejecuta git autonomamente. Nunca le pide al usuario que haga commit ni push.

1. `git add` de los archivos modificados durante la ejecucion (excluir secretos, archivos en `.gitignore`, archivos del usuario que se hayan stasheado).
2. `git commit -m "<conventional commit referenciando el PRP>"` siguiendo el estilo del repo.
3. `git push origin <rama configurada>` (default `main`).
4. Si el push falla por divergencia con remote → `git pull --rebase` + retry. Si hay conflictos → resolver con la informacion del PRP + commits recientes; solo escalar (c3) si la resolucion afectaria archivos del usuario fuera del scope.
5. Si hubo un stash temporal del usuario (caso B del analisis git tree del PASO 0) → `git stash pop` ahora; si conflicto → escalar (c3) con explicacion simple.

#### 5.7 Reporte final al usuario

Citar brief origen + PRP ejecutado para cerrar el circulo:

```
Ejecute @.claude/PRPs/PRP-XXX-{kebab}.md, derivado de
@docs/BRIEF-{tema}.md (cubre todas sus fases). Aprendizajes propagados al
brief origen. README + docs actualizados. Commit + push hechos.
```

Si no hay brief origen, adaptar:

```
Ejecute @.claude/PRPs/PRP-XXX-{kebab}.md (planificacion directa, sin brief
origen). Aprendizajes registrados en el PRP. README + docs actualizados.
Commit + push hechos.
```

---

## Uso de MCPs en por fases

Los MCPs se usan **durante la ejecucion**, no como pasos del plan. **Mapeo de contexto**: `supabase` (`list_tables`, `execute_sql` para verificar estructura) + codebase (Grep/Glob/Read para patrones existentes). **Ejecucion de subtareas**: `next-devtools` (`get_errors`, `get_logs` tras escribir codigo), `playwright` (`screenshot`, `click/fill` para validar UI/flujos), `supabase` (`apply_migration`, `execute_sql` para BD).

---

## Errores Comunes a Evitar

Tres anti-patrones del bucle por fases con ejemplos concretos viven en [`references/anti-patterns.md`](references/anti-patterns.md): (1) generar todas las subtareas al inicio, (2) MCPs como pasos obligatorios, (3) no re-mapear contexto entre fases. Leer al sentir tentacion de pre-planear o automatizar el uso de MCPs.

---

## Checklist por fase + Principios operacionales

**Antes de marcar una fase completada**: subtareas terminadas, MCPs aplicables consultados (next-devtools, playwright, supabase), funcionalidad cumple lo del PRP. **Antes de transicionar**: contexto re-mapeado incluyendo lo construido, dependencias identificadas.

**Principios** (orden de importancia): fases primero + subtareas just-in-time; mapeo obligatorio antes de subtareas; MCPs como herramientas (no pasos fijos); TodoWrite activo; validacion por fase; contexto acumulativo entre fases.

---

*"La precision viene de mapear la realidad, no de imaginar el futuro."*
*"El sistema que se blinda solo es invencible."*
