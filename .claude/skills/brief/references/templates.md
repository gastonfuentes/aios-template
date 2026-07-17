# Plantilla de brief

> Esta es la estructura canónica que la skill `brief` rellena en el Paso 6 del proceso. Cargar bajo demanda cuando se entra a redactar. Hay **un solo tipo de brief**; la profundidad (cuántas fases, cuánto detalle) la escala el agente según la idea (Paso 1).

---

## Estructura del brief

```markdown
# Brief: [Titulo]

> Fecha: [YYYY-MM-DD]

## TL;DR

[3 lineas prompt-ready que cualquier IA (o `/prp`) pueda leer como resumen completo. Incluir: que se construye, para quien, stack principal, diferenciador.]

## Mi Vision

[2-4 parrafos en primera persona. Que quiero construir y por que. Integrar hallazgos de la investigacion como decisiones propias informadas. Para una feature acotada, basta 1-2 parrafos directos al grano.]

## Contexto e Investigacion

[Que descubri. Competidores, mejores practicas, decisiones tecnicas clave. Redactar como "He investigado...", "Despues de analizar..." — tono de fundador informado.]

## Directiva de Stack Tecnico

> **Esta es la directiva inicial.** El PRP, al planearse, puede refinarla con la realidad actual del codebase. Los ajustes acumulados se documentan en el campo `Ajustes a la Directiva de Stack` de cada fase del `## Alcance por Fases`. Al cerrar el PRP, los ajustes se propagan aqui automaticamente. Esta directiva es un **starting point evolutivo**, no un contrato fijo.

### Clasificacion
- **Tipo**: [<tipo>]
- **Plataforma objetivo**: [lista]
- **Compatibilidad con Praxis**: [MATCH / EXTEND / PARTIAL / REPLACE_FRONT / REPLACE]

### KEEP
- [items que se conservan del stack Praxis]

### ADD
- [paquetes/herramientas nuevos con version y razon breve — "ninguno" si no aplica]

### REPLACE
- [Praxis.X → Nuevo.Y — razon — "ninguno" si no aplica]

### REMOVE
- [paquetes/archivos a quitar — "ninguno" si no aplica]

### CONFIG
- [cambios de configuracion requeridos — "ninguno" si no aplica]

### Archivos Praxis a eliminar
- [rutas especificas — "ninguno" si no aplica]

### Archivos nuevos a crear
- [rutas nuevas]

### IDE / Toolchain externo requerido
- [herramientas fuera del workspace: Xcode, Android Studio, certs, etc. — "ninguno" si no aplica]

## Alcance por Fases

> Esta seccion es el **diario vivo del proyecto** y la fuente de las fases del PRP. El brief siempre se convierte en **un solo PRP** que toma estas fases como su `## Plan de implementacion`. Escala el numero de fases al trabajo: un proyecto completo tiene varias fases coordinadas; una feature acotada, una o dos. Cada fase mantiene los campos estructurados que `prp` y `bucle-agentico` consultan y actualizan automaticamente.

### Fase 1: [Nombre]
- **Estado**: PENDIENTE
- **Objetivo high-level**: [una linea, que se logra al cerrar esta fase]
- **Depende de**: —
- **Aprendizajes para fases siguientes**: — (poblado al cerrar el PRP)
- **Ajustes a la Directiva de Stack**: — (poblado al cerrar el PRP, si aplica)
- **Iniciada**: —
- **Completada**: —

### Fase 2: [Nombre]
- **Estado**: PENDIENTE
- **Objetivo high-level**: [una linea]
- **Depende de**: [Fase 1, si aplica]
- **Aprendizajes para fases siguientes**: —
- **Ajustes a la Directiva de Stack**: —
- **Iniciada**: —
- **Completada**: —

### Fase N: [Nombre]
- **Estado**: PENDIENTE
- **Objetivo high-level**: [una linea]
- **Depende de**: [fases previas, si aplica]
- **Aprendizajes para fases siguientes**: —
- **Ajustes a la Directiva de Stack**: —
- **Iniciada**: —
- **Completada**: —

## Supuestos (deben ser verdad)

- [ ] [Supuesto 1 verificable]
- [ ] [Supuesto 2 verificable]

## Fuera de Alcance (NO construir en este brief)

- [Item 1 explicito]
- [Item 2 explicito]

## Evaluacion

| Dimension | Nivel | Nota |
|-----------|-------|------|
| Complejidad tecnica | [Baja/Media/Alta] | [1 linea] |
| Riesgo / dependencias externas | [Bajo/Medio/Alto] | [1 linea] |
| Esfuerzo estimado | [N fases] | [1 linea] |
| Costos externos recurrentes | [$/mes aprox] | [1 linea] |

## Fuentes Consultadas

- [URL 1] — [que encontre ahi]
- [URL 2] — [que encontre ahi]
- [URL N] — [que encontre ahi]
```

---

## Reglas de redaccion

- SIEMPRE primera persona: "Quiero...", "He decidido...", "Despues de investigar..."
- NUNCA tercera persona: NO "El usuario necesita...", NO "Se recomienda..."
- Tono: profesional pero natural, como un fundador informado.
- Integrar investigacion como conocimiento propio, no como citas academicas.
- Ser especifico y accionable — un solo PRP debe poder salir directo de este brief.
- Escalar la profundidad: una feature acotada lleva una o dos fases y bloques de Directiva con "ninguno"; un proyecto completo lleva varias fases y una Directiva completa. La estructura no cambia.
