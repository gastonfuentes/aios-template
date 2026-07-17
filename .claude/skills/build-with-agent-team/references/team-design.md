# Team design — roles especializados

## Roles canonicos para un brief de SaaS estandar

| Role | Responsabilidad | Skills que invoca |
|---|---|---|
| `auth-engineer` | Setup auth + RLS + middleware | auth-stack, supabase-admin |
| `db-engineer` | Migraciones + tablas + indices | supabase-admin |
| `frontend-engineer` | UI components + layouts + temas | frontend-design |
| `payments-engineer` | Checkout + webhook + portal | payments-polar |
| `notifications-engineer` | Emails + push | emails-transactional, pwa-mobile |
| `ai-engineer` | Chatbot + RAG + agentes | ai-sdk-kit |
| `qa-engineer` | Tests E2E + visual regression | playwright-cli |
| `landing-engineer` | Hero scroll-driven + SEO | web-3d, frontend-design |

Roles son semanticos para humanos; el `subagent_type` real puede ser `general-purpose` para todos. La especializacion la da el system prompt + skills relevantes referenciadas.

## Cuantos agentes maximo

Limites operativos:

- **2-3 agentes**: caso comun. Sobrecarga minima de coordinacion.
- **4-6 agentes**: posible para briefs grandes. Sync checkpoint cada 1-2 capas.
- **>6 agentes**: rate limits + complejidad de merge. Considerar dividir en sub-briefs.

## Anti-patron: agentes que se solapan

❌ `auth-engineer` y `frontend-engineer` ambos editando `src/middleware.ts`. Conflicto inevitable.

✓ `auth-engineer` define el middleware en su PRP. `frontend-engineer` consume el resultado pero no lo modifica.

Reglas de oro para particionar trabajo:

1. **File ownership**: cada archivo lo edita un solo agente.
2. **Dependencias claras en el brief**: la dependencia debe ser explicita, no implicita.
3. **Sync explicito en PRPs**: si dos agentes deben coordinar un punto especifico, ese punto vive en uno solo, el otro lo consume.

## Plantilla de mensaje al agente

```
Ejecuta @.claude/PRPs/PRP-XXX-{nombre}.md siguiendo la doctrina del bucle-agentico.

Tu rol: <role>.
Tu PRP: <path>.
Dependes de: <list de PRPs previos completados>.
Sync checkpoint con: <list de roles paralelos>.

Al terminar:
1. Reporta estado final (COMPLETADO / EN PROGRESO con motivo).
2. Lista archivos modificados (output de git diff --stat).
3. Aprendizajes propagables al brief origen (formato campo `Aprendizajes para fases siguientes`).
4. Posibles conflictos detectados con otros roles (si vste algo solapado).

Cuando reportes "COMPLETADO" volvemos a sincronizar antes de la siguiente capa.
```
