# Ejemplos de PRP — derivado de brief vs planificacion directa

> Dos ejemplos completos para referencia. Cargar cuando se necesite ver concreto como queda un PRP. En el modelo unificado, UN solo PRP cubre TODAS las fases del brief origen como sus fases de implementacion (`### Fase 1..N` en `## Plan de implementacion`).

---

## Tabla de contenidos

- [Ejemplo 1 — PRP derivado de un brief](#ejemplo-1--prp-derivado-de-un-brief)
- [Ejemplo 2 — PRP por planificacion directa (sin brief)](#ejemplo-2--prp-por-planificacion-directa-sin-brief)
- [Mapeo brief → PRP](#mapeo-brief--prp)

---

## Ejemplo 1 — PRP derivado de un brief

**Contexto**: el alumno tiene `BRIEF-saas-reservas-dentales.md` con 5 fases en `## Alcance por Fases` (Auth, Agenda, Pagos, Recordatorios, Panel). Todas en `PENDIENTE`. El alumno presiona **+ PRP**.

**Decisiones del agente**:

- **Paso 0 — leer el brief**: recorre `## Alcance por Fases`, lee las 5 fases con sus objetivos high-level, dependencias y aprendizajes. UN solo PRP va a cubrir las 5 fases como sus fases de implementacion.
- **Hereda integro del brief**: TL;DR, Directiva de Stack completa (Next.js + Supabase + Stripe + Resend + WhatsApp Cloud API), Supuestos, Fuera de Alcance.
- **Investigacion del codebase**: workspace recien iniciado por Praxis, scaffold base presente, `src/features/` solo tiene `auth/`, `dashboard/`, `.template/` por defecto. No hay logica de clinicas todavia.

**Output** (extracto):

```markdown
# PRP-001: SaaS de Reservas para Clinicas Dentales

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-05
> **Proyecto**: SaaS Reservas Dentales

---

## Origen

> Derivado de `@docs/BRIEF-saas-reservas-dentales.md` (cubre las 5 fases del Alcance por Fases).
> Hereda Directiva de Stack, Supuestos y Fuera de Alcance del brief.

## Objetivo

Quiero un SaaS de reservas dentales multi-tenant: cada clinica gestiona su agenda,
recordatorios automatizados (email + WhatsApp), pagos online y panel del odontologo,
con los datos aislados por RLS desde el primer write.

## Por Que

| Problema | Solucion |
|----------|----------|
| Sin auth multi-tenant solido, cualquier feature posterior (agenda, pagos) cruza datos entre clinicas | Construir auth + profiles + RLS antes de que entre data real |
| Dolor del odontologo de "no se que pasa con los datos de mi clinica" | RLS by default desde dia 1, auditable con un solo SELECT |

**Valor**: la base no negociable. La agenda y los pagos se apoyan sobre el auth multi-tenant.

## Que

### Criterios de exito
- [ ] Una clinica nueva puede registrarse con email + password (Supabase Auth).
- [ ] El primer usuario de cada clinica queda como `owner` y puede invitar staff (`dentist` / `receptionist`).
- [ ] El odontologo configura disponibilidad; los pacientes reservan online.
- [ ] Recordatorios automaticos por email + WhatsApp antes de cada cita.
- [ ] Pagos online de la suscripcion de la clinica.
- [ ] Las consultas a `clinics`, `profiles`, `appointments` cumplen RLS — ningun usuario ve datos de otra clinica.

### Comportamiento esperado

Flujo: signup → onboarding (datos de la clinica) → invitacion al primer dentista →
configuracion de agenda → reservas de pacientes → recordatorios → cobro de la suscripcion.

### Casos borde

Email ya registrado en otra clinica, sesion expirada, intento de cambio de rol por no-owner,
solapamiento de citas, fallo de envio de WhatsApp, pago rechazado.

---

## Directiva de Stack heredada

### KEEP
- Next.js 16 + React 19 + Supabase Auth + Tailwind 3.4 + Zod + Zustand + Playwright

### ADD
- @stripe/stripe-js + stripe-node, resend + react-email, @whatsapp/business-api, date-fns-tz

### CONFIG
- Habilitar email confirmations en Supabase project.
- RLS encendida por defecto en todas las tablas creadas.

[... resto del PRP ...]

## Plan de implementacion

> Una fase del plan por cada fase del brief. Las dependencias entre fases vienen del brief.

### Fase 1: Auth + Profiles + RLS multi-tenant
- **Objetivo**: clinica se registra, staff entra por rol, datos aislados por RLS.
- **Validacion**: `SELECT` simulando 2 clinicas distintas, cada una solo ve lo suyo.

### Fase 2: Agenda + reservas
- **Objetivo**: el odontologo configura disponibilidad; los pacientes reservan online.
- **Depende de**: Fase 1.

### Fase 3: Pagos online
- **Objetivo**: cobro de la suscripcion de la clinica con Stripe.
- **Depende de**: Fase 1.

### Fase 4: Recordatorios email + WhatsApp
- **Objetivo**: recordatorio automatico antes de cada cita por ambos canales.
- **Depende de**: Fase 2.

### Fase 5: Panel del odontologo + validacion final
- **Objetivo**: dashboard del odontologo + sistema funcionando end-to-end.
- **Validacion**:
  - [ ] Criterios de exito cumplidos.
  - [ ] `npx tsc --noEmit`, `npm run build`, `npm test`, Playwright pasan.

---

## Aprendizajes

(Vacia al crear — el bucle la rellena durante la ejecucion.)

---

## Anti-patrones

- No commitear secrets de Supabase service_role key al repo.
- No olvidarse `ENABLE ROW LEVEL SECURITY` antes del primer write.
[...]
```

**Output guardado en**: `.claude/PRPs/PRP-001-saas-reservas-dentales.md` con estado `PENDIENTE`.

Al aprobar el PRP (`PENDIENTE → APROBADO`), `prp` actualiza el brief origen: las 5 fases del `## Alcance por Fases` apuntan a `PRP: PRP-001-saas-reservas-dentales.md`. Al ejecutar (Run), el bucle las va marcando `EN PROGRESO` / `COMPLETADO` segun avanza, y al cerrar las marca todas `COMPLETADO` en un paso coordinado.

---

## Ejemplo 2 — PRP por planificacion directa (sin brief)

**Contexto**: no hay brief en el proyecto. El alumno presiona **+ PRP** (o usa Run sobre la skill `prp` directo) con: *"Necesito agregar autenticacion con Google OAuth a mi app."*

**Decisiones del agente**:

- **Paso 0 — sin brief**: no encuentra brief en `$ARGUMENTS` ni en `docs/`. Activa planificacion directa: investiga el workspace, y si quedan dudas criticas hace UNA batch de 1-3 preguntas en lenguaje cotidiano.
- **Directiva**: aplica el default Praxis (Next.js + Supabase) y lo anuncia en el PRP.
- **Investigacion del codebase**: `src/features/auth/` existe con login email/password; falta el proveedor OAuth.

**Output** (extracto):

```markdown
# PRP-002: Login con Google OAuth

> **Estado**: PENDIENTE
> **Fecha**: 2026-05-05
> **Proyecto**: SaaS Reservas Dentales

---

## Origen

> No hay brief origen — planificacion directa.
> Directiva: default Praxis (Next.js + Supabase). Supuestos y Fuera de Alcance definidos aqui.

## Objetivo

Quiero que los usuarios puedan entrar con su cuenta de Google ademas del
login email/password que ya existe.

## Por Que

| Problema | Solucion |
|----------|----------|
| El signup email/password tiene friccion; muchos abandonan | Ofrecer Google OAuth como entrada de un click |

**Valor**: menos friccion en el alta, mas conversiones de signup.

## Que

### Criterios de exito
- [ ] El usuario ve un boton "Continuar con Google" en login y signup.
- [ ] El primer login con Google crea el profile como el flujo email/password.
- [ ] Un usuario con email ya registrado se vincula a su cuenta existente.

[... resto del PRP ...]

## Plan de implementacion

### Fase 1: Configurar el proveedor Google en Supabase
- **Objetivo**: OAuth client configurado + redirect URLs.
- **Validacion**: login de prueba en local.

### Fase 2: Boton + flujo en la UI
- **Objetivo**: boton "Continuar con Google" en login/signup + manejo del callback.
- **Validacion**: Playwright sobre el flujo completo de OAuth.
```

**Output guardado en**: `.claude/PRPs/PRP-002-login-google-oauth.md` con estado `PENDIENTE`.

Al aprobar, no hay brief que actualizar — solo el PRP cambia a `APROBADO` cuando el alumno presiona Run.

---

## Mapeo brief → PRP

| Aspecto | Derivado de un brief | Planificacion directa (sin brief) |
|---------|----------------------|-----------------------------------|
| `## Origen` | Cita el brief y que cubre todas sus fases | "No hay brief origen — planificacion directa" |
| Fases del brief → Plan | Cada fase del `## Alcance por Fases` se vuelve una `### Fase N` del Plan | El agente define las fases del Plan desde la idea + codebase |
| Directiva de Stack | Heredada integra del brief | Default Praxis (anunciado en el PRP) |
| Aprendizajes heredados | Concatenacion de los `Aprendizajes para fases siguientes` del brief, si los hay | Vacio |
| Update al brief al aprobar | Si — las fases del brief apuntan al PRP | No — no hay brief |
| Numero de PRPs por brief | 1 (cubre todas las fases) | 1 |
