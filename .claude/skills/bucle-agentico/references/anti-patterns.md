# Anti-patrones del bucle por fases

> Tres errores comunes que rompen la garantia del patron recursivo. Cargar al sentir tentacion de pre-planear, automatizar uso de MCPs, o saltar el re-mapeo de contexto entre fases.

---

## Tabla de anti-patrones

| # | Error | Patron MAL (asi NO) | Patron BIEN (asi SI) |
|---|-------|--------------------|--------------------|
| 1 | **Generar todas las subtareas al inicio** | Fase 1: Auth (10 subtareas detalladas) → Fase 2: Roles (8 subtareas basadas en SUPOSICIONES) → Fase 3: Permisos (12 subtareas basadas en SUPOSICIONES). | Fase 1, 2, 3 declaradas SIN subtareas. Al entrar a Fase 1: mapear contexto → generar subtareas → ejecutar. Al entrar a Fase 2: mapear contexto (incluye lo que ya construi) → generar subtareas → ejecutar. Repetir. |
| 2 | **MCPs como pasos obligatorios del plan** | Plan: 1) tomar screenshot, 2) escribir codigo, 3) tomar screenshot, 4) verificar errores, 5) tomar screenshot. | Plan: 1) implementar componente LoginForm, 2) implementar validacion, 3) conectar con auth service. Durante ejecucion, usar MCPs (Playwright para visual, Next.js MCP para errores, Supabase para BD) cuando el JUICIO lo indique — no como pasos fijos. |
| 3 | **No re-mapear contexto entre fases** | Fase 1 completada → ejecutar directo Fase 2 con el plan original (subtareas pre-pensadas en abstracto). | Fase 1 completada → MAPEAR contexto de Fase 2 (que incluye lo que YA construi en Fase 1) → generar subtareas con info real → ejecutar. |

---

## Por que rompen la garantia del patron recursivo

1. **Pre-planear el nivel siguiente** (anti-patron 1) viola la **Regla 1** del patron: "No planees con suposiciones. Mapea contexto real antes de planear este nivel. Pre-planear el nivel siguiente esta prohibido — eso es trabajo del nivel siguiente cuando entre."
2. **MCPs como pasos** (anti-patron 2) confunde herramientas con plan. Los MCPs son **herramientas de diagnostico/validacion** que el agente usa cuando el juicio lo indica durante la ejecucion. No son pasos del plan — el plan describe QUE construir, no COMO se valida.
3. **No re-mapear** (anti-patron 3) viola la **Regla 1** desde otra angulo: el contexto al entrar a Fase 2 NO es el contexto de cuando se planeo Fase 2 al inicio. Es el contexto post-Fase 1, que incluye lo que REALMENTE se construyo. Saltarse este re-mapeo regresa el bucle al modelo tradicional con suposiciones.

---

## Como detectar que estoy cayendo en uno de estos anti-patrones

- Si me sorprendo escribiendo subtareas detalladas de Fase 2 mientras planeo Fase 1 → anti-patron 1.
- Si mi plan menciona "tomar screenshot" o "verificar con Playwright" como un paso fijo en lugar de durante ejecucion segun juicio → anti-patron 2.
- Si al cerrar Fase 1 voy a saltar directo al plan original de Fase 2 sin volver a mirar el codebase → anti-patron 3.

En cualquiera de los tres casos: parar, volver al PASO 1 del flujo, regenerar el plan correctamente.
