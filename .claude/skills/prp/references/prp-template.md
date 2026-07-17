# Template PRP — Product Requirements Prompt

> Template PRP adaptado al flujo Praxis. Basado en el framework **PRPs-agentic-eng** de Rasmus Widing (Wirasm) — github.com/Wirasm/PRPs-agentic-eng.
> La "P" final es de **Prompt**, no "Proposal": un PRP no es un documento de producto tradicional, es un prompt ejecutable para un agente.

---

## Que es un PRP

Un PRP define **que se construye** y **con que contexto** antes de escribir una sola linea de codigo. Es el contrato ejecutable entre humano y agente.

| Seccion | Proposito | Responsable |
|---------|-----------|-------------|
| **Origen** | De donde viene este PRP (brief origen, planificacion directa, etc.) | Agente al generar |
| **Objetivo** | Estado final deseado (primera persona) | Humano |
| **Por Que** | Valor de negocio / usuario (primera persona) | Humano |
| **Que** | Comportamiento + criterios de exito | Humano + agente |
| **Contexto** | Docs externas, codigo existente, gotchas | Agente investiga |
| **Directiva de Stack heredada** | KEEP/ADD/REPLACE/REMOVE/CONFIG copiada del brief origen | Agente al generar |
| **Supuestos heredados** | Lo que tiene que ser verdad antes de ejecutar | Agente al generar |
| **Fuera de Alcance heredado** | Lo que este PRP NO construye | Agente al generar |
| **Aprendizajes heredados de fases previas** | Lecciones transversales de `CLAUDE.md` o de una corrida previa del brief | Agente al generar |
| **Plan de implementacion** | Todas las fases del brief, ordenadas (sin subtareas todavia) | Agente propone |
| **Validacion** | Checks concretos por fase | Agente define |
| **Aprendizajes** | Errores encontrados durante la ejecucion | Agente actualiza |

---

## Flujo

```
1. Humano: "Necesito [feature]" (o presiona + PRP con brief origen)
2. Agente: lee el brief origen si existe, hereda Directiva/Supuestos/Fuera de Alcance/Aprendizajes y TODAS sus fases
3. Agente: investiga contexto, viabilidad, codigo a reutilizar
4. Agente: genera UN PRP-XXX-nombre.md (cubre todas las fases del brief) usando este template
5. Humano: revisa y aprueba (estado pasa a APROBADO)
6. Agente: ejecuta con `bucle-agentico` fase por fase
7. Agente: documenta aprendizajes en el PRP tras cada error
8. Agente: al cerrar, marca todas las fases del brief como COMPLETADO y propaga aprendizajes
```

---

## Nomenclatura

- Archivos: `PRP-[numero]-[descripcion-kebab].md` (numero con padding de 3 digitos: `001`, `002`, ...).
- Estados: `PENDIENTE` -> `APROBADO` -> `EN PROGRESO` -> `COMPLETADO`.

### Un solo PRP que cubre todas las fases

Hay **un solo tipo de PRP**. Cubre TODAS las fases del `## Alcance por Fases` del brief origen como las fases de su `## Plan de implementacion` (`### Fase 1`, `### Fase 2`, ..., `### Fase N`). No hay modos, ni variante monolitica, ni cadena `## Predecesor`, ni "1 PRP por fase". Al cerrar, el `bucle-agentico` marca todas las fases del brief como `COMPLETADO`.

Antes de elegir el numero, ejecutar siempre:

```bash
ls .claude/PRPs/
grep "PRP-" CLAUDE.md
```

El siguiente numero disponible es `max(numeros encontrados en ambas fuentes) + 1`.

---

# TEMPLATE PRP

```markdown
# PRP-XXX: [Titulo]

> **Estado**: PENDIENTE
> **Fecha**: YYYY-MM-DD
> **Proyecto**: [nombre]

---

## Origen

[Una de dos formas:]

[Opcion A — viene de un brief:]
> Derivado de `@docs/BRIEF-{tema}.md`. Cubre TODAS las fases de su `## Alcance por Fases`.
> Hereda Directiva de Stack, Supuestos, Fuera de Alcance, y aprendizajes heredados.

[Opcion B — planificacion directa, sin brief previo:]
> No hay brief origen — planificacion directa. Las secciones heredadas (Directiva de Stack, Supuestos, Fuera de Alcance, Aprendizajes heredados) quedan vacias.

---

## Objetivo

> Voz: primera persona. Heredada del brief — habla como el humano dueño del producto.

[Estado final deseado en 1-2 oraciones, primera persona. Testeable.
Ejemplo: "Quiero que mi clinica tenga un sistema de reservas online donde
los pacientes elijan especialista, fecha y hora sin llamar."]

## Por Que

> Voz: primera persona. Hereda el porque del brief.

| Problema | Solucion |
|----------|----------|
| [Dolor del usuario] | [Como lo resuelve esta feature] |

**Valor**: [Impacto medible — conversion, tiempo, costo. Primera persona si aplica:
"Necesito reducir 60% las llamadas de mi recepcionista para que atienda mejor a quienes vienen presencialmente."]

## Que

> Voz: impersonal. Es contrato tecnico.

### Criterios de exito
- [ ] [Criterio medible 1]
- [ ] [Criterio medible 2]
- [ ] [Criterio medible 3]

### Comportamiento esperado

[Flujo principal — happy path, en prosa]

### Casos borde

[Errores previsibles, timeouts, estados vacios, permisos, etc.]

---

## Contexto

> Voz: impersonal.

### Documentacion externa
- [URL 1] — que usar de aqui
- [URL 2] — que usar de aqui

### Codigo existente a consultar
- `src/features/[existente]/` — patron a seguir
- `src/core/adapters/[X]/` — cliente ya configurado

### Gotchas conocidas
- [Trampa 1 — ej: Chart.js requiere dynamic import por SSR]
- [Trampa 2 — ej: Supabase RLS debe habilitarse antes del primer write]

### Modelo de datos (si aplica)

```sql
CREATE TABLE [tabla] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE [tabla] ENABLE ROW LEVEL SECURITY;
```

---

## Directiva de Stack heredada

> Voz: impersonal. Copia integra del brief origen.
> Si no hay brief origen: "No hay brief origen — usar Trust Stack default Praxis (ver seccion Trust Stack abajo)."

### Clasificacion
- **Tipo**: [<tipo del catalogo del brief>]
- **Compatibilidad con Praxis**: [MATCH / EXTEND / PARTIAL / REPLACE_FRONT / REPLACE]

### KEEP
- [items conservados del stack Praxis]

### ADD
- [paquetes/herramientas nuevos con version]

### REPLACE
- [Praxis.X → Nuevo.Y — razon]

### REMOVE
- [paquetes/archivos a quitar]

### CONFIG
- [cambios de configuracion requeridos]

### Refinamientos a la Directiva durante este PRP
- [cualquier ajuste descubierto durante el mapeo de contexto del codebase actual]

---

## Supuestos heredados

> Voz: impersonal. Lo que tiene que ser verdad antes de que el bucle-agentico arranque.
> Si no hay brief origen: "No hay supuestos heredados — el bucle-agentico verificara solo lo que este PRP declare explicitamente abajo."

- [ ] [Supuesto 1 — copia exacta del brief]
- [ ] [Supuesto 2]

### Supuestos adicionales (especificos de esta fase)
- [ ] [Supuesto descubierto durante el mapeo de contexto, si aplica]

---

## Fuera de Alcance heredado

> Voz: impersonal. Copia exacta del brief origen.
> Si no hay brief origen: "No hay brief origen — Fuera de Alcance vacio. Cualquier limite explicito debe declararse abajo."

- [Item 1 explicito heredado del brief]
- [Item 2 explicito heredado del brief]

### Fuera de Alcance adicional (especifico de esta fase)
- [Item 1 — exclusiones puntuales que aplican solo a este PRP]

---

## Aprendizajes heredados de fases previas

> Voz: impersonal. Aprendizajes transversales de `CLAUDE.md` que apliquen a este trabajo, o de una corrida previa parcial del mismo brief (si alguna fase ya tenia poblado `Aprendizajes para fases siguientes`).
> En el caso normal (brief recien creado, sin brief origen, o primer PRP): "No hay aprendizajes heredados — primer PRP del brief o no hay brief origen."

[Aprendizaje 1 — fecha — aplicar en: ...]
[Aprendizaje 2 — fecha — aplicar en: ...]

---

## Plan de implementacion

> IMPORTANTE: solo definir FASES aqui. Las subtareas se generan al ENTRAR
> a cada fase siguiendo el bucle-agentico (mapear contexto -> generar
> subtareas -> ejecutar). Coherente con la doctrina recursiva: cada nivel
> planea solo su propio nivel.

### Fase 1: [Nombre]
- **Objetivo**: [que se logra al completar esta fase]
- **Validacion**: [como verificar que esta completa]

### Fase 2: [Nombre]
- **Objetivo**: [que se logra]
- **Validacion**: [como verificar]

### Fase N: Validacion final
- **Objetivo**: sistema funcionando end-to-end
- **Validacion**:
  - [ ] Criterios de exito cumplidos
  - [ ] [comandos derivados del tipo de proyecto del brief origen — default cuando no hay brief (este meta-repo): `npm run compile`, `npm test`, `npm run validate`, `npm run package`]

---

## Aprendizajes

> Esta seccion crece con cada error. El conocimiento persiste para futuros PRPs.

### [YYYY-MM-DD]: [Titulo del aprendizaje]
- **Error**: [que fallo]
- **Fix**: [como se arreglo]
- **Aplicar en**: [donde mas aplica]

---

## Anti-patrones

- No crear patrones nuevos si los existentes funcionan
- No ignorar errores de TypeScript / del lenguaje del proyecto
- No hardcodear valores (usar constantes)
- No omitir validacion en inputs (Zod en TS, equivalente en otros lenguajes)
- No commitear secrets

---

*PRP pendiente aprobacion. No se ha modificado codigo.*
```

---

## Trust Stack (referencia — meta-repo de Praxis)

> **Condicional**: incluir esta seccion en un PRP solo si la `Compatibilidad con Praxis` heredada del brief es `MATCH` o `EXTEND`. Para `PARTIAL`, `REPLACE_FRONT`, o `REPLACE`, **omitir esta seccion** y referenciar la Directiva heredada arriba como fuente de verdad del stack.
>
> **Importante**: este meta-repo NO es un proyecto Next.js — es la extension de VS Code que construye Praxis. El Trust Stack default de PRPs generados aqui es el stack de la extension, no el del alumno (Next.js + Supabase + Tailwind). Si articulas un proyecto satelite que SI use el Trust Stack del alumno, declaralo explicitamente en la Directiva del brief origen.

| Capa | Tecnologia |
|------|------------|
| Lenguaje | TypeScript 5.7+ strict (nada de `any`) |
| Plataforma | VS Code Extension API 1.85+ (cross-IDE: VS Code, Cursor, Windsurf, Antigravity) |
| Bundler | esbuild 0.24+ (`npm run compile`, `npm run watch`) |
| Tests | Vitest 2.1+ (`npm test` — 386 tests, ~500ms) |
| Empaquetado | vsce (`npm run package` produce el `.vsix`) |
| FS | `vscode.workspace.fs` (NUNCA `fs` de Node — rompe remote workspaces) |
| Backend (membresia + payload chunks) | Supabase (Edge Functions + tablas `praxis_*`) |

---

**Fuente del framework PRP:** Rasmus Widing (Wirasm) — https://github.com/Wirasm/PRPs-agentic-eng
