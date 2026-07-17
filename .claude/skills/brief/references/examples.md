# Ejemplos de briefs — proyecto amplio vs feature acotada

> Dos ejemplos completos para referencia. Cargar al entrar a Paso 6 cuando se quiera ver concreto como queda un brief redactado. No hay "modos" de brief: siempre se guarda `BRIEF-{tema}.md`; lo unico que cambia es la PROFUNDIDAD (cuantas fases tiene el `## Alcance por Fases`).

---

## Tabla de contenidos

- [Ejemplo 1 — Proyecto amplio (varias fases)](#ejemplo-1--proyecto-amplio-varias-fases)
- [Ejemplo 2 — Feature acotada (una fase)](#ejemplo-2--feature-acotada-una-fase)
- [Patrones de extraccion](#patrones-de-extraccion)

---

## Ejemplo 1 — Proyecto amplio (varias fases)

**Input del usuario** (`$ARGUMENTS`):

> "Quiero construir un SaaS de reservas para clinicas dentales. Mis hijas seran las primeras usuarias. Necesito auth, agenda, recordatorios por email/whatsapp, pagos online, y panel para el odontologo."

**Decisiones del agente al ejecutar**:

- **Profundidad**: amplia (producto completo nuevo, multiples capacidades coordinadas, workspace vacio). El agente decide cuantas fases tendra el `## Alcance por Fases` — aqui 5. Anuncia: *"Voy a generar un brief con varias fases — describes un producto completo con varias capacidades coordinadas y el workspace no muestra un proyecto relacionado en marcha."*
- **Tipo del catalogo**: `web-saas` (auth + multi-tenant + suscripciones + dashboard). Compatibilidad `MATCH` con Praxis.
- **Investigacion web**: 3 busquedas obligatorias del playbook + 1 sobre Google Calendar API + 1 sobre WhatsApp Business API.

**Output** (extracto del brief redactado):

```markdown
# Brief: SaaS de Reservas para Clinicas Dentales

> Fecha: 2026-05-05

## TL;DR

Quiero construir un SaaS de reservas dentales multi-tenant donde cada clinica
gestione su agenda, recordatorios automatizados (email + WhatsApp), pagos online
y panel del odontologo. Stack: Next.js + Supabase + Stripe + Resend + WhatsApp
Cloud API. Diferenciador: integracion nativa con WhatsApp en lugar de SMS,
con plantillas pre-aprobadas para el mercado hispanohablante.

## Mi Vision

Mis hijas seran las primeras usuarias — esto no es un side project, es un
producto que va a operar la clinica de mi familia desde dia uno. He decidido
arrancar con auth + agenda como base no negociable, dejando pagos para Fase 3
porque sin agenda funcionando, los pagos no aportan valor...

## Directiva de Stack Tecnico

### Clasificacion
- **Tipo**: web-saas
- **Plataforma objetivo**: Web responsive, optimizada movil-primero (recepcionista en el celular)
- **Compatibilidad con Praxis**: MATCH

### KEEP
- Next.js 16 + React 19 + Tailwind 3.4
- Supabase (Auth + DB + RLS)
- Vercel AI SDK v5 (para agente de recordatorios contextuales)
- Zod, Zustand, Playwright

### ADD
- @stripe/stripe-js + stripe-node (pagos suscripcion + sesiones one-time)
- resend + react-email (recordatorios email)
- @whatsapp/business-api (recordatorios WhatsApp con plantillas pre-aprobadas)
- date-fns + date-fns-tz (timezones por clinica)

[... resto del brief ...]

## Alcance por Fases

### Fase 1: Auth + Profiles + RLS multi-tenant
- **Estado**: PENDIENTE
- **PRP**: —
- **Objetivo high-level**: Una clinica puede registrarse, los miembros del staff entrar
  con permisos por rol (odontologo / recepcionista), y los datos quedan aislados por RLS.
- **Depende de**: —
- **Aprendizajes heredados**: —
- **Aprendizajes para fases siguientes**: —
- **Ajustes a la Directiva de Stack**: —
- **Iniciada**: —
- **Completada**: —

### Fase 2: Agenda + reservas
- **Estado**: PENDIENTE
- **PRP**: —
- **Objetivo high-level**: El odontologo configura su disponibilidad,
  los pacientes reservan online sin llamar.
- **Depende de**: Fase 1.
[... 5 fases en total ...]
```

**Output guardado en**: `BRIEF-saas-reservas-dentales.md`

Al guardar, el agente anuncia el plan de ejecucion: **un solo PRP** cubrira las 5 fases del brief como sus fases de implementacion. El alumno presiona **+ PRP** una vez para generarlo.

---

## Ejemplo 2 — Feature acotada (una fase)

**Input del usuario** (`$ARGUMENTS`):

> "Quiero agregar un widget de horario de atencion en la pagina de mi clinica. Que se vea en el header, abierto/cerrado en tiempo real."

**Decisiones del agente al ejecutar**:

- **Profundidad**: acotada (una adicion puntual dentro de un alcance ya definido — la clinica ya tiene web). Workspace muestra `src/features/dashboard/`, `package.json` con Next.js 16. El `## Alcance por Fases` tendra **una sola fase**. Anuncia: *"Voy a generar un brief de una fase — describes una adicion puntual al header que ya existe en src/components/."*
- **Tipo del catalogo**: el proyecto ya es `web-saas` (heredado del contexto), la feature en si no necesita re-clasificacion.
- **Investigacion web**: minima — 1 busqueda sobre patrones de "open hours widget" + lectura de codigo existente del header.

**Output**:

```markdown
# Brief: Widget de Horario de Atencion en Header

> Fecha: 2026-05-05

## TL;DR

Quiero un componente que muestre "Abierto ahora" o "Cerrado — abrimos lunes 9am"
en tiempo real en el header de la clinica, leyendo el horario configurado en
Supabase y respetando el timezone de la clinica. Stack delta: cero — usa lo
que ya hay (Next.js + Supabase + Tailwind).

## Mi Vision

Un componente cliente que cada minuto verifica el estado de apertura,
muestra un dot verde/rojo y un texto contextual. Usa el horario semanal
guardado en `clinics.opening_hours` (ya existe). Cero requests adicionales
al servidor — todo se calcula client-side a partir del horario que ya
viene con la pagina.

## Contexto

He visto que el header vive en `src/features/dashboard/components/Header.tsx`
y consume `useClinic()` que ya devuelve `opening_hours`. La unica adicion es
un componente `<OpenStatusBadge />` que se monte adentro del header.

## Directiva de Stack Tecnico

### KEEP
- Next.js 16 + React 19 + Tailwind 3.4 (ya esta)
- Supabase con `clinics.opening_hours` (ya esta)

### ADD
- date-fns-tz (timezone helpers — ~3kb gzipped)

### CONFIG
- Ninguno.

## Alcance por Fases

### Fase 1: Widget de horario de atencion en header
- **Estado**: PENDIENTE
- **PRP**: —
- **Objetivo high-level**: El header muestra "Abierto" / "Cerrado — abrimos <dia> <hora>"
  en tiempo real, respetando el timezone de la clinica, sin pegar al servidor.
- **Depende de**: —
- **Aprendizajes heredados**: —
- **Aprendizajes para fases siguientes**: —
- **Ajustes a la Directiva de Stack**: —
- **Iniciada**: —
- **Completada**: —

[... resto del brief, mucho mas conciso porque es una sola fase ...]
```

**Output guardado en**: `BRIEF-widget-horario-atencion.md`

Al guardar, el agente anuncia el plan: **un solo PRP** cubrira la unica fase del brief. El alumno presiona **+ PRP** una vez.

---

## Patrones de extraccion

Cuando se redacte un brief siguiendo estos ejemplos, extraer del input del usuario para decidir la PROFUNDIDAD (cuantas fases tendra el `## Alcance por Fases`):

| Senal | Implica |
|-------|---------|
| "Quiero construir / Quiero crear" + producto completo | Varias fases |
| "Agregar / Quiero un + componente" en proyecto existente | Una fase |
| Multiples capacidades coordinadas (auth + agenda + pagos) | Varias fases |
| Una sola capacidad acotada (widget, modal, hook) | Una fase |
| Workspace vacio o solo digest | Varias fases (producto nuevo) |
| Workspace con `src/features/<feature>/` y nuevo encaja como adicion | Una fase |

En todos los casos el output es `BRIEF-{tema}.md` con `## Alcance por Fases`, y un solo PRP lo cubrira completo. Cuando hay ambiguedad real sobre la profundidad, ganan las senales de la idea sobre las del workspace. Si aun asi no queda claro, preferir **menos fases** (mas conservador).
