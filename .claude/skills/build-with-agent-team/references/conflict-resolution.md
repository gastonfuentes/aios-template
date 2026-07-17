# Conflict resolution — cuando dos agentes editaron archivos solapados

## Tipos de conflicto

### 1. Mismo archivo, lineas distintas

Auto-merge funciona casi siempre. `git diff` muestra ambos cambios.

```
src/lib/utils.ts:
  + auth-engineer agrego: function checkAuth() {...}
  + frontend-engineer agrego: function formatDate() {...}
```

Resolver: simplemente aceptar ambos. No hay conflict real.

### 2. Mismo archivo, mismas lineas, cambios distintos

Auto-merge falla. Conflicto real.

```
<<<<<<<<<< auth-engineer
const REDIRECT = '/(app)/dashboard';
==========
const REDIRECT = '/dashboard';
>>>>>>>>>> frontend-engineer
```

Resolver: identificar cual es la convention canonica del proyecto. Si el brief declara una, usar esa. Si no, el agente con mas autoridad sobre el archivo gana (auth-engineer en este caso, porque maneja redirects de auth).

### 3. Archivos derivados de uno principal

```
src/lib/supabase/types.ts (auto-generado por db-engineer)
src/features/auth/use-profile.ts (consumido por auth-engineer, importa types)
```

Si db-engineer regenero types y los nombres cambiaron, auth-engineer ve compile errors. Sync checkpoint deberia haberlo cazado.

Resolver: re-correr `supabase gen types` y ajustar imports en consumers. Si auth-engineer ya cerro su PRP, abrir uno chico de "fix consumers de types regenerados".

### 4. Migraciones en orden incorrecto

```
0001_create_profiles.sql (auth-engineer)
0002_create_lessons.sql (frontend-engineer, asume profiles existe)
0003_add_role_to_profiles.sql (auth-engineer, despues)
```

Si frontend-engineer aplico 0002 antes de auth-engineer aplicar 0001, BD tiene tabla `lessons` con FK a `profiles` que no existe.

Resolver: cancelar 0002 y 0003, re-correr en orden 0001 → 0002 → 0003. Idealmente, dependencias claras en el brief evitan este caso.

## Como prevenir conflictos

1. **File ownership explicito**: cada PRP declara que archivos toca. Sync checkpoint detecta solapes antes de empezar.
2. **Abstraction barriers**: agentes editan dentro de su feature folder (`src/features/auth/`, `src/features/dashboard/`). Lib comun (`src/lib/`) solo lo edita un owner designado.
3. **Migraciones secuenciales con numero**: el numero incremental fuerza orden total. Si dos agentes intentan crear `0002_*.sql` simultaneo, conflict obvio.
4. **No editar shared types entre agentes**: si dos features comparten un type, uno lo define, el otro lo importa.

## Escalacion al usuario

Solo escalar conflicto al usuario en estos casos (Regla 6 sub-regla c3):

- El conflicto requiere decision de producto (cual de dos behaviors es el deseado).
- El conflicto deja la app en estado roto y los archivos del usuario fuera del scope se ven afectados.

Para todo conflicto tecnico (auto-merge, files unicos, types regenerables), resolver autonomamente.

Mensaje canonico de escalacion:

```
Encontre un conflicto entre dos partes del proyecto que necesita tu decision:

  • Parte A (auth): redirige a "/(app)/dashboard" tras login
  • Parte B (frontend): redirige a "/dashboard"

¿Cual prefieres mantener?

  A) "/(app)/dashboard" (con prefijo de grupo Next.js)
  B) "/dashboard" (sin prefijo)

Ambos funcionan; es decision de convencion.
```

Voz Juan Lara — sin jerga tecnica innecesaria, opciones claras (A/B).
