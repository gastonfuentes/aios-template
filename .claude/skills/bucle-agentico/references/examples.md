# Ejemplo completo de un ciclo del bucle-agentico

> Caso completo: PRP aprobado → ejecucion fase por fase → cierre con propagacion al brief y CLAUDE.md. Cargar para ver concreto el contrato del bucle de punta a punta.

---

## Tabla de contenidos

- [Setup del ejemplo](#setup-del-ejemplo)
- [PASO 0 — Mapear contexto del PRP + git tree](#paso-0--mapear-contexto-del-prp--git-tree)
- [PASO 0.5 — Verificar supuestos empiricamente](#paso-05--verificar-supuestos-empiricamente)
- [PASO 0.7 — Anunciar mapeo y arrancar](#paso-07--anunciar-mapeo-y-arrancar)
- [Fase 0 implicita — aplicar delta de Directiva](#fase-0-implicita--aplicar-delta-de-directiva)
- [Fase 1 — mapeo + subtareas + ejecucion](#fase-1--mapeo--subtareas--ejecucion)
- [Fase 2 — mapeo nuevo + subtareas con contexto acumulado](#fase-2--mapeo-nuevo--subtareas-con-contexto-acumulado)
- [PASO 5 — Validacion final + housekeeping + propagacion](#paso-5--validacion-final--housekeeping--propagacion)
- [Resultado en disco al cerrar](#resultado-en-disco-al-cerrar)

---

## Setup del ejemplo

**Brief origen**: `BRIEF-saas-reservas-dentales.md` (5 fases en el Alcance por Fases). Para este ejemplo, el PRP cubre la primera fase del brief (Auth + Profiles + RLS multi-tenant); las demas fases del PRP se omiten por brevedad y siguen el mismo patron.

**PRP**: `PRP-001-saas-reservas-dentales.md`, generado por la skill `prp` desde el brief. Estado actual: `APROBADO` (el alumno aprobo y presiono ⚡ Run).

El PRP tiene 4 fases internas (en el `## Plan de implementacion`):
- Fase 1: Schema + RLS
- Fase 2: Signup + onboarding
- Fase 3: Invitaciones de staff
- Fase 4: Validacion final

**Directiva del PRP heredada del brief** (extracto):
- KEEP: Next.js + Supabase + Tailwind + Zod + Zustand + Playwright
- ADD: ninguno especifico de esta fase
- CONFIG: habilitar email confirmations en Supabase project; RLS encendida por defecto en todas las tablas

---

## PASO 0 — Mapear contexto del PRP + git tree

El bucle abre el archivo del PRP y extrae:

- Estado: `APROBADO` → flippea a `EN PROGRESO` (el ⚡ Run del usuario es la confirmacion).
- Plan de implementacion: 4 fases listadas arriba.
- Directiva, Supuestos, Fuera de Alcance heredados.
- Aprendizajes heredados: vacio (es el unico PRP del brief).

**Analisis git tree** (Regla 6 sub-regla e):
- `git status --short`: limpio.
- Continuar sin acciones git.

---

## PASO 0.5 — Verificar supuestos empiricamente

Supuestos heredados del PRP:

- [x] **"Supabase project esta creado"** → `supabase mcp list_projects` → existe `praxis-clinica-prod`. ✓
- [x] **"`@supabase/ssr` esta instalado"** → `npm ls @supabase/ssr` → version 0.5.2 instalada. ✓
- [ ] **"El usuario tiene cuenta paga en Resend"** → no verificable empiricamente. Asumir verdadero (fue aprobado en el PRP); anotar en reporte final.

Cero escalaciones c1/c2/c3. Continuar.

---

## PASO 0.7 — Anunciar mapeo y arrancar

```
Empezando ejecucion de @.claude/PRPs/PRP-001-saas-reservas-dentales.md.

- Estado del PRP: APROBADO -> EN PROGRESO.
- Fases: Schema+RLS, Signup+onboarding, Invitaciones, Validacion final.
- Fase 0 implicita (delta de Directiva): SI — CONFIG dice habilitar email confirmations + RLS por defecto. Aplicar antes de Fase 1.
- Aprendizajes heredados aplicables: ninguno (unico PRP del brief).
- Supuestos verificados: 2/3 (1 no-verificable empiricamente, asumido valido).
- Tras todas las fases, PASO 5 ejecuta validacion final + housekeeping.

Voy.
```

---

## Fase 0 implicita — aplicar delta de Directiva

CONFIG no esta vacio → Fase 0 implicita corre antes de Fase 1.

**Mapeo de contexto de Fase 0 implicita**:
- Supabase MCP: `get_advisors` → reporta que email confirmations estan deshabilitadas.
- Supabase MCP: `list_tables` → no hay tablas todavia (proyecto recien creado).

**Subtareas generadas just-in-time**:
1. Habilitar email confirmations en Supabase (via dashboard config — escalar c1 al usuario con instruccion clara).
2. Documentar en CLAUDE.md (raiz) que las tablas se crean con `ENABLE ROW LEVEL SECURITY` desde la primera migracion.

Ejecutar. Fase 0 implicita cierra.

---

## Fase 1 — mapeo + subtareas + ejecucion

**Mapeo de contexto** (PASO 2):
- Supabase MCP: `list_tables` → vacio (Fase 0 implicita no creo tablas).
- Codebase: `src/features/auth/` ya tiene scaffold (login + signup), pero asume single-tenant. Hay que adaptar.

**Subtareas generadas just-in-time** (PASO 2 → PASO 3):

1. Crear migration `001_clinics_profiles.sql` con tablas `clinics`, `profiles`, `invitations` + RLS habilitada + policies.
2. Aplicar migration via Supabase MCP `apply_migration`.
3. Verificar RLS con queries simulando 2 clinicas distintas.

Ejecutar. Si hay error → PASO 3.5 (Auto-Refuerzo).

**Caso real de Auto-Refuerzo** (escenario hipotetico para el ejemplo):

Al ejecutar la migration, falla con `policy "clinic_isolation" already exists`. Aplicar protocolo de investigacion:

1. Leer error completo: la policy quedo de un intento previo abortado.
2. Grep codebase: no hay otra mencion.
3. Supabase MCP `execute_sql`: `SELECT * FROM pg_policies WHERE tablename='clinics'` → confirma que la policy quedo orfana.
4. WebSearch: docs Supabase confirma `DROP POLICY IF EXISTS` como fix idempotente.
5. CLAUDE.md aprendizajes: ningun aprendizaje previo cubre esto.
6. Fix: agregar `DROP POLICY IF EXISTS clinic_isolation ON clinics;` al inicio de la migration.

Re-aplicar. ✓ Funciona.

**Documentar el aprendizaje** en el PRP (seccion `## Aprendizajes`):

```markdown
### 2026-05-05: Migration con CREATE POLICY falla si quedan policies orfanas

- **Error**: `policy "clinic_isolation" already exists` al re-aplicar migration tras intento abortado.
- **Fix**: prefijar `DROP POLICY IF EXISTS <name> ON <table>;` antes de cada `CREATE POLICY` para hacer la migration idempotente.
- **Aplicar en**: cualquier migration de Supabase que cree policies — patron defensivo para retry safety.
```

Fase 1 completada. Subtareas todas verde en TodoWrite.

---

## Fase 2 — mapeo nuevo + subtareas con contexto acumulado

**Mapeo de contexto NUEVO** (no reutilizar el de Fase 1 — Regla 1):

- Supabase MCP: `list_tables` → AHORA muestra `clinics`, `profiles`, `invitations` con RLS activa.
- Codebase: `src/features/auth/` aun no consume las nuevas tablas.

**Subtareas generadas just-in-time** (CON el contexto de lo que Fase 1 construyo):

1. Adaptar `src/features/auth/components/SignupForm.tsx` para crear clinic + profile en la misma transaccion al signup.
2. Crear `useClinic()` hook en `src/features/auth/hooks/`.
3. Validar visualmente con Playwright que el signup crea registros y aplica RLS.

Ejecutar. Fase 2 cierra.

(Fases 3 y 4 omitidas en este ejemplo por brevedad — siguen el mismo patron.)

---

## PASO 5 — Validacion final + housekeeping + propagacion

### 5.1 Validacion tecnica

- `npx tsc --noEmit` → ✓
- `npm run build` → ✓
- `npm test` → 12 tests verde
- Playwright smoke test → ✓ (signup + login + RLS isolation)

### 5.2 Marcar el PRP como COMPLETADO

`PRP-001-saas-reservas-dentales.md`: `> **Estado**: EN PROGRESO` → `> **Estado**: COMPLETADO`.

### 5.3 Documentar aprendizajes

- **Especifico de subtarea**: el aprendizaje sobre `DROP POLICY IF EXISTS` ya quedo en `## Aprendizajes` del PRP (durante PASO 3.5).
- **Especifico de fase del brief**: ninguno transversal — el aprendizaje del DROP POLICY es tactico, no afecta a las otras fases del brief.
- **Aplica a multiples features**: NO — es muy especifico de policies de Supabase. Si emergiera 2-3 veces mas, considerar moverlo a `supabase-admin/SKILL.md`.
- **Transversal del proyecto**: NO en este caso.

### 5.4 Actualizar README + docs afectados

- `README.md` raiz: agregar mencion al modelo de auth multi-tenant.
- `src/features/auth/README.md`: documentar `useClinic()` hook.

### 5.5 Actualizar el brief origen

El PRP cubre todas las fases del brief. Al cerrar, el bucle marca TODAS las fases del `## Alcance por Fases` de `BRIEF-saas-reservas-dentales.md` como `COMPLETADO` en un paso coordinado, apuntando al PRP y registrando los aprendizajes propagables. Ejemplo de la Fase 1:

```markdown
### Fase 1: Auth + Profiles + RLS multi-tenant
- **Estado**: EN PROGRESO -> COMPLETADO
- **PRP**: PRP-001-saas-reservas-dentales.md
- **Aprendizajes para fases siguientes**: Migrations de Supabase con CREATE POLICY deben ser idempotentes (DROP POLICY IF EXISTS antes). Aplicar en Fase 2 (agenda) que va a crear policies sobre appointments.
- **Ajustes a la Directiva de Stack**: Agregar `DROP POLICY IF EXISTS` como patron defensivo en CONFIG de migrations.
- **Iniciada**: 2026-05-05
- **Completada**: 2026-05-05
```

### 5.6 Commit + push

```bash
git add .
git commit -m "feat(auth): multi-tenant auth + profiles + RLS (PRP-001)"
git push origin main
```

### 5.7 Reporte final al usuario

```
Ejecute @.claude/PRPs/PRP-001-saas-reservas-dentales.md, derivado de
@docs/BRIEF-saas-reservas-dentales.md. Aprendizajes propagados al brief
origen — las fases de agenda heredaran el patron de migrations idempotentes.
README + auth/README.md actualizados. Commit + push hechos.
```

---

## Resultado en disco al cerrar

```
proyecto-saas-reservas-dentales/
├── docs/
│   └── BRIEF-saas-reservas-dentales.md      (fases del Alcance por Fases marcadas COMPLETADO)
├── .claude/
│   └── PRPs/
│       └── PRP-001-saas-reservas-dentales.md  (Estado: COMPLETADO)
├── src/
│   └── features/
│       └── auth/
│           ├── components/SignupForm.tsx   (adaptado multi-tenant)
│           ├── hooks/useClinic.ts          (nuevo)
│           └── README.md                   (nuevo)
├── supabase/
│   └── migrations/
│       └── 001_clinics_profiles.sql        (idempotente, RLS activa)
└── README.md                                (mencion al modelo de auth multi-tenant)
```

El sistema esta funcionando end-to-end, el conocimiento esta documentado para fases siguientes, y el commit + push autonomo cierra el ciclo. El alumno solo presiono ⚡ Run una vez.
