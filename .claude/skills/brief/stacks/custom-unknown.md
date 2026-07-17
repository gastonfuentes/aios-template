# Stack Recipe: custom-unknown

> **Compatibilidad Praxis**: — (depende del resultado de la investigacion)
> **Plataforma objetivo**: — (a definir con el usuario)

## Cuando se usa

Fallback cuando la idea del usuario **no encaja** en ninguno de los 27 tipos catalogados. En ese caso la skill:

1. Hace **investigacion libre** con WebSearch + WebFetch (minimo 5 busquedas).
2. Identifica 1–2 stacks candidatos.
3. Documenta el razonamiento en el brief.
4. Deja la Directiva de Stack **explicita** aunque sea ad-hoc — PRP debe poder ejecutarla.

## KEEP / ADD / REPLACE / REMOVE / CONFIG

La skill los completa **durante la investigacion**, no por adelantado. Plantilla:

```markdown
## Directiva de Stack Tecnico (custom)

### Clasificacion
- **Tipo descubierto**: [nombre del nicho]
- **Compatibilidad con Praxis**: [MATCH / EXTEND / PARTIAL / REPLACE_FRONT / REPLACE]
- **Razon**: [1-2 lineas de por que]

### KEEP
- [listado de lo que se mantiene del stack Praxis]

### ADD
- [libs/herramientas nuevas con version y razon]

### REPLACE
- [Praxis.X → Nuevo.Y]

### REMOVE
- [paquetes/archivos a quitar]

### CONFIG
- [cambios de configuracion]

### Archivos Praxis a eliminar
- [rutas]

### Archivos nuevos a crear
- [rutas]

### IDE / Toolchain externo requerido
- [herramientas fuera del workspace]
```

## Reglas al usar este fallback

- **Minimo 5 busquedas web** (vs 3 de los tipos catalogados) — el contexto es mas debil.
- **NUNCA inventar URLs** ni citar fuentes que no se consultaron.
- Citar al menos **2 ejemplos de stacks similares** (repos publicos, articulos tecnicos, docs oficiales).
- Si despues de investigar queda ambiguedad grande, **preguntar al usuario** antes de redactar el brief (no adivinar).

## Archivos Praxis a eliminar
— (a decidir en investigacion)

## Archivos nuevos a crear
— (a decidir en investigacion)

## IDE / Toolchain externo requerido
— (a decidir en investigacion)
