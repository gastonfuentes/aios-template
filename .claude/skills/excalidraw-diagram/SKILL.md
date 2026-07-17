---
name: excalidraw-diagram
description: "Genera diagramas Excalidraw como JSON y los persiste a la tabla draw_canvases del Mission Control (URL editable en /draw/<id>) o renderiza a PNG como fallback opcional. Cubre arquitecturas, flowcharts, process maps, sequence diagrams, sketches y diagramas didácticos para videos de YouTube y PRPs. Activar cuando el operador menciona diagrama, flowchart, arquitectura, system diagram, process map, sequence diagram, visualizar, sketch, excalidraw."
allowed-tools: Read, Write, Edit, Bash, Glob
---

# Excalidraw Diagram Generator

> Generar diagramas Excalidraw-compatibles + persistirlos a Mission Control (canónico PRP-034) o PNG (fallback). Source heredado del template `business-os-template` de Daniel Carreón, refactor a Skills 2.0 + integración MC al cerrar PRP-034.

---

## Modo canónico AIOS — escribir a Mission Control (PRP-034)

Default desde PRP-034 (Fase 4 brief master mc-expansion): el diagrama se persiste a la tabla `public.draw_canvases` de Supabase + se abre una pestaña del navegador con el canvas cargado en `/draw/<id>` (editable nativo en Excalidraw embebido).

### Flujo

1. Generar el JSON Excalidraw siguiendo el layout descrito abajo.
2. Ejecutar `node .claude/skills/excalidraw-diagram/scripts/save_to_mc.mjs <ruta-al-json>` (el script lee el JSON, hace INSERT a `draw_canvases` via service-role, e invoca `POST /open-url` del daemon para abrir Safari/Chrome en `https://YOUR_MC_PUBLIC_URL/draw/<id>` o local).
3. El operador ve la pestaña abrirse automáticamente + puede editar el diagrama directo en el lienzo macOS-flavored.

### Cuándo usar este modo

- Diagramas operativos del AIOS (arquitectura, flujos de cron, sequence MC ↔ daemon).
- Diagramas que el operador querrá editar después.
- Diagramas embebidos en briefs/PRPs donde se referencia `https://YOUR_MC_PUBLIC_URL/draw/<id>`.

### Variables de entorno requeridas en `.env` del proyecto

- `MC_SUPABASE_URL`, `MC_SUPABASE_SERVICE_ROLE` (writes con bypass-RLS).
- `OPENCLAW_GATEWAY_TOKEN` + `AGENT_URL` (= `http://127.0.0.1:3099` local o `https://YOUR_DAEMON_PUBLIC_URL` remoto) para invocar `/open-url`.
- `MC_BASE_URL` (`https://YOUR_MC_PUBLIC_URL` prod) para construir la URL final.

---

## Modo fallback — renderizar a PNG

Reservado para cuando el output va a un canal estático (YouTube thumbnail, PRP closed que no admite live edit, snapshot histórico). Ver "Renderizar a PNG" abajo.

---

## Cuando activar

- "Hazme un diagrama de la arquitectura."
- "Necesito un flowchart del flujo de signup."
- "Visualiza el pipeline de YouTube."
- "Sketch del PRP que vamos a ejecutar."
- "Diagrama de secuencia para el daemon ↔ MC."

## Cuando NO activar

- Diagramas conceptuales que se resuelven con texto/lista markdown — no merecen PNG.
- Mermaid en `MarkdownMessage` cuando ya está renderizado en MC (redundancia).
- Wireframes UI complejos — usar `frontend-design` skill (mockups con Tailwind/shadcn) o `image-generation` (mockup visual estilizado).

---

## Cómo funciona

1. Diseñar el layout sobre una grid imaginaria.
2. Generar JSON Excalidraw válido con todas las propiedades requeridas.
3. Guardar como archivo `.excalidraw`.
4. Renderizar a PNG con el script Python bundled en `references/render_excalidraw.py`.

---

## Diseño del layout

Pensar en una cuadrícula:

- Empezar en `(100, 100)` arriba-izquierda.
- Espaciado horizontal: `200px` entre elementos.
- Espaciado vertical: `150px` entre filas.
- Tamaño estándar de rectángulos: `180x90px`.

Para diagramas de arquitectura AIOS típicos: tres columnas (Mission Control / Agent Server / Servicios externos) con 2-3 filas verticales.

---

## Generar el JSON

Cada diagrama necesita el wrapper canónico:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "agent",
  "elements": [ ... ],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": null
  },
  "files": {}
}
```

Para el shape de cada `element` (rectangle, ellipse, arrow, text), leer:

- [`references/json-schema.md`](references/json-schema.md) — schema completo Excalidraw con tipos y campos requeridos.
- [`references/element-templates.md`](references/element-templates.md) — templates copy-paste de cada tipo de elemento.

---

## Paleta de colores

Default — alinear con AIOS premium minimal:

| Propósito | Stroke | Fill |
|-----------|--------|------|
| Elementos primarios | `#1971c2` | `#a5d8ff` |
| Elementos secundarios | `#2f9e44` | `#b2f2bb` |
| Warning / atención | `#e8590c` | `#ffc078` |
| Neutral / estructural | `#868e96` | `#dee2e6` |
| Texto sobre fills claros | `#1e1e1e` | — |
| Flechas / conexiones | `#1971c2` | — |

Para diagramas con tema dark (videos YouTube fondo violeta), invertir background a `#0b0b0b` y subir contraste.

---

## Renderizar a PNG

```bash
cd .claude/skills/excalidraw-diagram/references
uv run python render_excalidraw.py /path/to/diagram.excalidraw --output /path/to/output.png --scale 2
```

Setup primera vez (solo una vez por máquina):

```bash
cd .claude/skills/excalidraw-diagram/references
uv sync
uv run playwright install chromium
```

Si `uv` no está instalado, fallback `pip install -r requirements.txt` no funciona — el renderer requiere Playwright + headless Chromium. Documentado como c1 del operador si la primera invocación falla por `uv: command not found`.

---

## Reglas críticas

1. **Cada shape con texto** necesita DOS elementos: el shape + un text element con `containerId` apuntando al shape.
2. **Cada shape con texto contenido** necesita `boundElements: [{"id": "textId", "type": "text"}]`.
3. **Las arrows** necesitan `startBinding` y `endBinding` con los IDs de elementos conectados.
4. **Todos los IDs deben ser únicos** dentro del diagrama. Generar con timestamp + counter o `crypto.randomUUID()`.
5. **`roughness: 0`** para diagramas profesionales limpios. `roughness: 1` para sketches casuales.
6. **`fontFamily: 3`** (monospace) para texto consistente en código/IDs. `fontFamily: 1` (Virgil) para anotaciones humanas.

---

## Donde guardar el archivo

Default AIOS: `mission-control/public/diagrams/<kebab-name>.excalidraw` y el PNG en `mission-control/public/diagrams/<kebab-name>.png`. Esto los hace servibles desde la PWA con URL pública (`/diagrams/<kebab-name>.png`). Para diagramas privados (PRPs internos, brainstorm), `/.claude/diagrams/<kebab-name>.{excalidraw,png}` (gitignored si contiene info sensible — verificar `.gitignore`).

---

## Output esperado

Tras renderizar, dejar al operador:

- El path local del PNG.
- Si está bajo `mission-control/public/`, el URL público (`https://aios-ecosystem-ai.vercel.app/diagrams/<name>.png` después del próximo deploy).
- Embed markdown en la respuesta del SDK: `![<descripción>](<URL>)`.

---

## Cross-references

- [`@.claude/skills/image-generation/SKILL.md`](../image-generation/SKILL.md) — para imágenes generadas con IA (thumbnails, ilustraciones), no diagramas estructurados.
- [`@.claude/skills/frontend-design/SKILL.md`](../frontend-design/SKILL.md) — para wireframes de UI con Tailwind/shadcn.

---

## Reference Files

- [`references/json-schema.md`](references/json-schema.md) — schema Excalidraw completo.
- [`references/element-templates.md`](references/element-templates.md) — templates copy-paste.
- [`references/render_excalidraw.py`](references/render_excalidraw.py) — renderer Python.
- [`references/render_template.html`](references/render_template.html) — HTML template para rendering.
- [`references/pyproject.toml`](references/pyproject.toml) — dependencias Python (`uv sync`).
