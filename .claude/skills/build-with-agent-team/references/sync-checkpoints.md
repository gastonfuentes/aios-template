# Sync checkpoints — agregar entregas

Al final de cada capa, sincronizar antes de pasar a la siguiente. Sin sync, los agentes de capa N+1 pueden empezar con codigo desactualizado o referencias rotas.

## Que hacer en un checkpoint

1. **Recoger reportes** de cada agente (estado + archivos modificados + aprendizajes).
2. **Verificar tests verdes**: `npm test && npm run validate`.
3. **Detectar conflictos de archivos**: si dos agentes declararon editar el mismo file, alertar.
4. **Propagar aprendizajes** al brief: cada fase actualiza sus campos `Aprendizajes para fases siguientes` y `Ajustes a la Directiva`.
5. **Commit consolidado** con mensaje referenciando todas las PRPs cerradas en la capa.
6. **Solo entonces lanzar la siguiente capa**.

## Mensaje de sync entre agentes

Cuando capa N termina, antes de capa N+1, los agentes de capa N+1 reciben context fresh:

```
Capa N completada. Aprendizajes que aplican a tu fase:

De Fase 1 (auth-engineer):
- <aprendizaje 1>
- <aprendizaje 2>

De Fase 2 (db-engineer):
- <aprendizaje 1>

Archivos que ya existen y NO debes recrear:
- src/lib/supabase/browser.ts
- src/middleware.ts
- supabase/migrations/0001_profiles.sql

Empieza tu PRP con este context. Si encontras conflicto con lo que tu PRP planeaba, escalar.
```

## Detectar conflictos pre-merge

```bash
# Antes de mergear capa N a main:
git diff <main> <capa-N> --name-only | sort | uniq -c | sort -rn

# Si algun archivo aparece >1 vez (varios agentes lo tocaron), alerta:
src/middleware.ts: 2 agentes
src/lib/auth.ts: 1 agente
```

Resolver: revisar diff de cada agente, decidir merge manual o re-asignar trabajo.

## Update del brief

Despues de cada capa, actualizar:

```
### Fase 1: Auth base

- Estado: COMPLETADO
- PRP: PRP-001-auth-base.md
- Iniciada: 2026-05-04
- Completada: 2026-05-05
- Aprendizajes para fases siguientes:
  - Magic-link como default reduce friccion al alumno; mantener en pwa-mobile y web-3d.
  - Tabla profiles con role check ya existe — reusarla, no crear similar.
- Ajustes a la Directiva:
  - (ninguno)
```

Esto preserva conocimiento entre capas y evita que agentes posteriores reinventen ruedas.

## Commit message

```
feat(team): cierre capa 0 — auth + BD core

- PRP-001 auth-base (auth-engineer): COMPLETADO
- PRP-002 db-core (db-engineer): COMPLETADO

Aprendizajes propagados al brief.
Capa 1 (dashboard, pagos) lista para arrancar.
```

## Cuando NO sincronizar

Si una capa tiene un solo agente, no hay sync (hay un solo reporte). Pasa directo al siguiente.

Si dos capas son chicas y consecutivas (cada una 1-2 fases), considerar fusionarlas para reducir overhead.
