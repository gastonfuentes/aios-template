# Voz y tono — distincion canonica briefs vs PRPs vs skills

Resumen ejecutivo del Apartado 2 del STYLE-GUIDE. Para los detalles, ver `injectable/agentic/skills/STYLE-GUIDE.md`.

## Briefs (`BRIEF-*.md`)

**Primera persona del usuario.**

> "Quiero refactorizar 12 skills..."
> "Mi vision es..."
> "He decidido que..."

El brief ES la voz del autor articulando su intencion. Cualquier IA que lo escribe canaliza al usuario.

## PRPs (`PRP-XXX-*.md`)

**Primera persona del usuario heredada SOLO en `## Origen`, `## Objetivo`, `## Por Que`.**

El resto del PRP (Que, Contexto, Directiva, Plan, Anti-patrones, Aprendizajes) es **impersonal tecnico**.

```markdown
## Objetivo
> Voz: primera persona. Heredada del brief.

Quiero refactorizar las skills...

## Que
> Voz: impersonal. Es contrato tecnico.

Las 12 skills refactoreadas tienen frontmatter validado, body imperativo en
espanol, bundle canonico Skills 2.0.
```

## Skills — frontmatter `description`

**Tercera persona estricta. Pushy. WHAT + WHEN.**

✅ Bien:

```yaml
description: "Configura autenticacion con Supabase Auth + magic-link + RLS para apps Next.js. Activar cuando el usuario menciona login, signup, autenticacion, magic-link, o protección de rutas."
```

❌ Mal:

```yaml
description: "Yo te ayudo a configurar autenticacion."  # primera persona
description: "Puedes usar esto para autenticacion."    # segunda persona
description: "Skill para autenticacion."               # vaga sin triggers
```

## Skills — body del SKILL.md y archivos en `references/`

**Voz imperativa al agente que ejecuta la skill, con why explicito.**

✅ Bien:

```markdown
Crea la tabla profiles con RLS habilitada antes del primer write. Razon:
Supabase no permite re-aplicar RLS retroactivamente sin migracion compleja.
```

❌ Mal:

```markdown
Yo siempre creo la tabla profiles primero.       # primera persona del autor
Tu vas a crear la tabla profiles primero.        # segunda persona narrativa
NEVER write before enabling RLS!!!               # MUSTs sin razon
```

## La identidad Praxis NO viene del pronombre

Viene de cuatro fuentes:

1. **Idioma espanol** 100% (siglas tecnicas permitidas: PRP, MCP, RLS, URL, JSON, OAuth, AI SDK, Brief, Next.js, React, Tailwind, Supabase, Vercel, Zod, Zustand, npm, git, GitHub, VS Code, Cursor, Windsurf, Antigravity, Claude, Claude Code).
2. **Ejemplos del dominio YOUR_COMMUNITY** (alumno Vibe Coding, primer SaaS, comunidad Skool, broadcast WhatsApp).
3. **Cross-references explicitas** entre skills hermanas con hand-off concreto.
4. **Explicaciones del why** detras de instrucciones criticas — no ordenes, sino razones.

## Cuando estas escribiendo y dudas

Pregunta canonica: ¿esto es una **prompt ejecutable** dentro del agente, o es una **narrativa** que el usuario lee?

- Prompt ejecutable → impersonal/imperativa con why.
- Narrativa al usuario → voz del operador primera persona (ver PRP-027 + Reglas de copy publico en CLAUDE.md inyectado).

Ambos contratos coexisten. Las skills son siempre prompts ejecutables. Sidebar/READMEs/notificaciones son narrativa.
