# Doctrina Praxis — patrón recursivo + Trust Stack + reglas duras

> **TL;DR**: El template hereda la metodología Praxis: brief → PRP → bucle-agentico recursivo, Trust Stack opinado para eliminar decisiones, reglas duras universales, criterios de entrega validables. Si dominas estas piezas, dominas el agente.

---

## Patrón recursivo

> **"Mapea. Planea solo este nivel. Ejecuta. Documenta. Propaga aprendizajes hacia arriba."**

3 escalas anidadas. Cada nivel es instancia del mismo patrón:

```
ESCALA PROYECTO  ──► brief
                     │ Mapea: idea + investigación web + workspace
                     │ Planea: fases por nombre + Directiva de Stack
                     │ Ejecuta: ⟶ delega cada fase al PRP
                     │
                     ▼
ESCALA FEATURE   ──► prp
                     │ Mapea: brief origen + fases previas + codebase
                     │ Planea: sub-fases por nombre, sin subtareas
                     │ Ejecuta: ⟶ delega al bucle-agentico
                     │
                     ▼
ESCALA SUBTAREA  ──► bucle-agentico (doctrina canónica)
                       Mapea: PRP origen + estado real del momento
                       Planea: subtareas just-in-time
                       Ejecuta: subtarea por subtarea
                       Documenta + Propaga: aprendizajes suben por la pila
```

---

## Las 6 reglas duras

1. **No planees con suposiciones**. Mapea contexto real antes de planear este nivel. Pre-planear el nivel siguiente está prohibido.
2. **Solo planeas tu nivel**. El brief NO detalla sub-fases del PRP. El PRP NO detalla subtareas del bucle.
3. **Documenta aprendizajes localmente y propágalos hacia arriba**. Cada nivel escribe en su propia sección de aprendizajes y, al cerrar, propaga lo que afecte a niveles superiores.
4. **Cada nivel tiene un lifecycle**. `PENDIENTE → EN PROGRESO → COMPLETADO`. El PRP suma `APROBADO` entre `PENDIENTE` y `EN PROGRESO` para marcar la aprobación humana.
5. **Cada nivel actualiza al nivel superior al cerrar**. Bucle actualiza PRP. PRP actualiza brief. Brief actualiza `CLAUDE.md` con aprendizajes transversales.
6. **Autonomía total dentro de cada nivel**. El operador solo entra en triggers no técnicos: aportar idea, presionar **+ Brief**, **+ PRP**, **⚡ Run**. Entre triggers, cada nivel ejecuta 100% autónomo bajo el principio cardinal *"investigar antes de preguntar"*.

---

## Modos de operación

Tres modos según la tarea. Comunica explícitamente en qué modo estás antes de actuar.

- **Modo Brief**: capturas intención antes de ejecutar nada.
- **Modo Plan**: documentas el plan antes de tocar código.
- **Modo Ejecución**: implementas siguiendo plan aprobado.

Nunca saltas del Modo Brief al Modo Ejecución sin pasar por Modo Plan en features complejas.

---

## Trust Stack

El template elige stack opinado para eliminar decisiones técnicas redundantes:

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 + React 19 + TypeScript strict |
| Estilos | Tailwind 3.4 + shadcn/ui new-york + design system macOS 26 |
| Backend | Supabase (Auth + DB + RLS + Storage) |
| AI Engine | Adapter LLM cross-provider (Claude Code CLI / Anthropic API / OpenRouter) |
| AI UI | Vercel AI Elements + Streamdown |
| Validación | Zod |
| Estado | Zustand (raro — preferir useSyncExternalStore para hooks browser) |
| Testing | Playwright CLI + MCP |

Si un proyecto exige otra tecnología, el `brief` emite Directiva de Stack documentando la **Compatibilidad Praxis** (MATCH / EXTEND / PARTIAL / REPLACE_FRONT / REPLACE) y propone el adaptador.

---

## Reglas de código no negociables

- **NUNCA** `any` (usa `unknown` y narrows con Zod).
- **SIEMPRE** validas entrada de usuario con Zod (frontend + backend).
- **SIEMPRE** habilitas RLS en tablas Supabase nuevas. Default deny.
- **NUNCA** exponer secrets en código fuente.
- **NUNCA** ramas distintas a `main` salvo orden explícita.
- **NUNCA** `git push --force` sin orden explícita.
- **`git push` lo hace el agente** — el operador NUNCA tipea git.

### Reglas de estructura

- Feature-First (DDD modular monolith): `src/features/<feature>/{components,hooks,api,state,contracts}`.
- Archivos ≤ 500 líneas, funciones ≤ 50 líneas.
- Variables/Funciones: `camelCase`. Componentes/Clases: `PascalCase`.
- Archivos de ruta Next.js siguen convención framework.

---

## Criterios de entrega

Antes de dar por cerrada cualquier feature o PRP:

- [ ] Tipos verificados (`npx tsc --noEmit` sin errores).
- [ ] Lint limpio (`npm run lint --max-warnings=0`).
- [ ] Build de producción exitoso (`npm run build`).
- [ ] Validación visual vía Playwright (screenshot de flujo feliz + flujo de error).
- [ ] RLS activo en todas las tablas nuevas.
- [ ] Entrada de usuario validada con Zod.
- [ ] Registro de aprendizajes actualizado si hubo errores.
- [ ] Doc relevante actualizada (CLAUDE.md / README.md / PRP).

---

## Registro de aprendizajes

> Cada error documentado es una pared contra la que no te vas a volver a estrellar jamás.

```
Error → Fix → Documentar → No se repite
```

| Donde documentar | Cuándo |
|---|---|
| PRP actual | Errores específicos de esta feature |
| Skill relevante | Errores que aplican a múltiples features |
| CLAUDE.md | Errores críticos que afectan a todo el proyecto |

Las 16 skills universales viven en `.claude/skills/` y se cargan automáticamente al primer turn de cada sesión.

---

## Cuándo "investigar antes de preguntar"

Sub-regla del bucle-agentico Regla 6b (extracto):

1. Leer error completo + stack trace + logs.
2. `grep` / `glob` el codebase por patrones similares.
3. Usar MCPs disponibles para diagnosticar.
4. WebSearch + WebFetch docs oficiales.
5. Leer `docs/troubleshooting.md` por si el mismo error ya está catalogado.
6. Iterar fixes alternativos.

**Solo escala (c1)** si requiere algo físicamente del operador (API key, cuenta paga, hardware). Cualquier otra "duda": **resuelve, no preguntes**.
