# Anatomía de `.claude/memory/`

> Este documento define qué archivo carga qué tipo de info, qué frontmatter usar, dónde escribir cada cosa, y cuándo dividir un archivo. Léelo cuando dudes dónde poner una memoria nueva.

---

## Mapa de archivos

### Raíz — archivos nominativos por dominio

| Archivo | Qué carga | `update_frequency` | `volatility` |
|---------|-----------|--------------------|--------------|
| `business-context.md` | Modelo de negocio, audiencias, productos (YOUR_COMMUNITY, YOUR_AGENCY, YouTube, herramientas propias), prioridades estratégicas, métricas norte (ej. meta MRR). | low | stable |
| `preferencias.md` | Voz, idioma, formato preferido (Markdown vs prosa), atajos de comunicación, estilo de respuesta esperado, herramientas/IDE preferidas. | low | stable |
| `tech-stack.md` | Trust Stack AIOS (Next.js 16 + Supabase + Vercel + máquina principal del operador daemon + grammY + better-sqlite3 + cron) + decisiones técnicas heredadas (los 7 fixes obligatorios, hook guard, weekly rotation, etc.). | medium | evolving |
| `people.md` | Personas clave: nombre + rol + cómo aparecen + último contacto. Daniel Carreón (autor del template), mentores, colaboradores, contactos de comunidad. | low | evolving |
| `decisiones.md` | **APPEND-ONLY**. Una decisión estratégica por bloque, con fecha. Pricing, scope cuts, pivotes, decisiones de producto. | high | snapshot |
| `errores-aprendidos.md` | **APPEND-ONLY**. Errores resueltos durante la operación con fix + dónde aplica. Análogo a la sección "Aprendizajes" de `CLAUDE.md` pero con contexto operativo, no técnico-de-PRP. | high | snapshot |
| `MEMORY.md` | Índice operativo navegable. Max 200 líneas. Se carga al activar la skill. **No es memoria** — es contenido. | medium | evolving |
| `README.md` | Documentación de cómo funciona la memoria, leyenda de frontmatter, cómo editar a mano si hace falta. | low | stable |

### `proyectos-activos/`

Un archivo `.md` por iniciativa multi-mes en curso. Día 1: `praxis.md`, `your-community-slug.md`, `aios.md`. Cuando arranque un proyecto nuevo (ej. `cutflow-v2.md`), agregar archivo aquí con frontmatter sembrado y `update_frequency: medium`, `volatility: evolving`.

### Carpetas incidentales (Daniel pattern)

| Carpeta | Qué guarda | Cuándo escribir aquí en lugar de raíz nominativa |
|---------|------------|--------------------------------------------------|
| `user/` | Hechos sueltos sobre el operador. Ej. "Juan vive en Guadalajara", "prefiere violeta sobre azul". | Cuando el hecho no encaja claramente en `business-context.md` ni `preferencias.md`. |
| `feedback/` | Correcciones específicas del operador a comportamiento del agente con explicación del POR QUÉ. | Cuando el operador corrige al agente y explica la razón — vivir aquí en lugar de pisar `preferencias.md`. |
| `project/` | Estado de iniciativas en curso con fechas absolutas. | Cuando un proyecto activo se mueve día a día y `proyectos-activos/<archivo>.md` es muy abstracto. |
| `reference/` | Patrones descubiertos, dónde encontrar cosas en el codebase, soluciones recurrentes. | Cuando el conocimiento es operativo (rutas, comandos, atajos) y no decisional. |

Cada archivo en una carpeta incidental se nombra `<descripcion-kebab>.md` (ej. `user/juan-vive-guadalajara.md`, `reference/comando-reiniciar-daemon.md`). Frontmatter idéntico a los archivos nominativos.

### `historial/`

Snapshots mensuales `<YYYY-MM>.md` generados por el cron `monthly-memory-snapshot`. **No editar a mano** — se regeneran si se borran (re-correr el cron manualmente desde `/cron`).

---

## Frontmatter canónico

Todo archivo `.md` bajo `.claude/memory/` excepto `README.md`, `MEMORY.md` y los `.gitkeep` arranca con:

```yaml
---
last_updated: YYYY-MM-DD
update_frequency: low | medium | high
volatility: stable | evolving | snapshot
---
```

- `last_updated`: ISO date del último cambio sustantivo. Update al editar contenido (no al cambiar frontmatter solo). En `decisiones.md` y `errores-aprendidos.md` es opcional — si está, refleja la fecha del último append.
- `update_frequency`: cuán seguido cambia este archivo en condiciones normales.
  - `low`: 1-2 veces al año.
  - `medium`: mensual o por release.
  - `high`: semanal o más.
- `volatility`: qué tipo de cambio espera el archivo.
  - `stable`: contenido base, raras revisiones (`business-context.md`, `preferencias.md`, `README.md`).
  - `evolving`: el contenido entero crece y se reorganiza con el tiempo (`tech-stack.md`, `people.md`, `proyectos-activos/*`).
  - `snapshot`: cada cambio es un nuevo bloque al final, sin reorganización (`decisiones.md`, `errores-aprendidos.md`, `historial/*`).

---

## Regla de naming

- Archivos nominativos en raíz: `<dominio>.md` (ej. `business-context.md`, `tech-stack.md`). No usar `business_context.md` ni `BusinessContext.md`. Lowercase + guion medio.
- Archivos en carpetas incidentales: `<descripcion-corta-kebab>.md`. La descripción debe permitir entender el contenido sin abrir el archivo. Mal: `nota-1.md`. Bien: `comando-reiniciar-daemon.md`.
- Archivos en `historial/`: `<YYYY-MM>.md` exactamente. El cron lo respeta.
- Archivos en `proyectos-activos/`: `<proyecto-kebab>.md`. Match con el nombre que el operador usa al hablar del proyecto (ej. `praxis.md`, no `extension-vscode.md`).

---

## Umbral de tamaño

- Archivos > 300 líneas: agregar Table of Contents al inicio (Skills 2.0 best practice — Claude usa `head -100` cuando previene leer todo y se pierde info).
- Archivos > 500 líneas: dividir en dos. Sufijo numérico (`tech-stack-1.md`, `tech-stack-2.md`) o por dominio (`tech-stack-frontend.md`, `tech-stack-daemon.md`).
- Antes de dividir, evaluar si la mitad nueva merece subir a archivo nominativo de raíz o bajar a una carpeta incidental.

---

## Cuándo crear archivo nuevo en raíz vs en carpeta incidental

- **Nuevo archivo en raíz nominativo**: solo si el dominio NO encaja en ninguno existente y se espera que el archivo crezca con uso (varias entradas a lo largo del tiempo). Ejemplo: `clientes-agencia.md` si YOUR_AGENCY empieza a tener una cartera estable.
- **Nuevo archivo en carpeta incidental**: el dominio existente cubre el caso pero el hecho específico es lo suficientemente puntual como para no inflar el archivo nominativo. Ejemplo: "el operador reformatea el SSD del máquina principal del operador cada 6 meses" → `user/juan-reformatea-mac-mini.md` en lugar de pisar `preferencias.md`.

Si hay duda, default a carpeta incidental — es más fácil promover a raíz nominativo después que rebajar.
