# Anatomia de un SKILL.md exitoso

Disecion seccion por seccion de una skill bien escrita. Usar este analisis al disenar la propia.

## Frontmatter

```yaml
---
name: auth-stack
description: "Configura autenticacion con Supabase Auth + magic-link como camino primario, tabla profiles con RLS, middleware de proteccion de rutas, y multi-rol opcional para apps Next.js. Activar cuando el usuario menciona login, signup, autenticacion, sesion de usuario, magic-link, profiles, RLS, proteger rutas, multi-rol, o flujos como 'que mis alumnos puedan entrar', 'crear cuenta', 'recuperar contraseña'."
allowed-tools: Read, Write, Edit, Bash, mcp__claude_ai_Supabase__apply_migration, mcp__claude_ai_Supabase__execute_sql, mcp__claude_ai_Supabase__list_tables
---
```

Por que funciona:

- `name`: kebab-case, leaf de la carpeta `auth-stack/`, no contiene reserved words.
- `description`: tercera persona (`Configura...` no `Yo configuro`). WHAT explicito (Supabase Auth + magic-link + RLS + middleware + multi-rol). WHEN explicito (lista de 9-10 triggers concretos). Pushy pero no agressive — termina con frases reales del usuario entre quotes.
- `allowed-tools`: declara explicito que MCPs y comandos son legitimos. Reduce el surface de error.

## Frase ejecutiva

> "Encadena en una sola corrida: tabla profiles con RLS, magic-link, middleware de rutas protegidas, y los hooks que el resto de skills (emails, payments, pwa) consumen."

Por que funciona: en una sola frase declara el output (que se construye), el modo (en una corrida), y el lugar en el ecosistema (lo que las skills hermanas consumen). Cualquier agente que la lee sabe inmediatamente si es o no la skill correcta para su tarea.

## Cuando activar

- "Necesito login para mis alumnos."
- "Que el usuario pueda entrar con su email."
- "Quiero que solo los registrados vean el dashboard."
- "Agrega magic-link / signup / password reset."
- "Necesito profiles / multi-rol / admin vs alumno."
- "Proteger rutas privadas."

Por que funciona: 6 triggers reformulados como frases del usuario. Cada uno cubre un sub-caso distinto. Suma cobertura sin redundancia.

## Cuando NO activar

- El proyecto ya tiene auth funcional y solo necesita un campo nuevo en `profiles`. Edita la tabla directo con `supabase-admin`.
- El usuario quiere SSO empresarial con SAML/SCIM. Eso queda fuera del scope de Supabase Auth basico — escalar a docs oficiales.

Por que funciona: declara explicito sus limites + cita la skill correcta para cada caso edge. Previene undertriggering de hermanas + previene overtriggering de si misma.

## Antes de empezar

```
- [ ] Variables de entorno presentes: NEXT_PUBLIC_SUPABASE_URL, ...
- [ ] Dependencias instaladas: @supabase/supabase-js, @supabase/ssr.
- [ ] Existe src/lib/supabase/browser.ts y server.ts.
- [ ] El proyecto Supabase no tiene aun la tabla profiles.
```

Por que funciona: pre-requisitos verificables empiricamente. El agente puede ejecutar cada chequeo y resolver autonomo (Regla 6 sub-regla b — investiga antes de preguntar). Cero ambiguedad sobre que cuenta como "listo para empezar".

## Flujo principal — pasos imperativos con why

```markdown
### Paso 1: tabla `profiles` con RLS habilitada

Crea la tabla `profiles` con RLS activada **antes del primer write**.
Razon: Supabase no permite re-aplicar RLS retroactivamente sin migracion
compleja, y cualquier insert previo queda accesible publico.
```

Por que funciona:

- Imperativo claro ("Crea").
- Why explicito ("Razon: ...").
- Sin MUSTs/NEVERs en mayusculas — la razon hace que el agente cumpla, no la orden.

## Cross-references con hand-off concreto

```
- @.claude/skills/emails-transactional/SKILL.md — encadenar despues de signup.
  Hand-off: el trigger handle_new_user puede llamar una funcion edge que
  despache sendEmail({ template: 'welcome', to: new.email }).
```

Por que funciona: no solo dice "esta skill se relaciona con X". Dice **donde** se conecta (el trigger), **que** pasa la una a la otra (event con email), y **bajo que template**. Cualquier agente que ejecuta auth-stack sabe exactamente que enchufar de emails-transactional.

## Validacion al cerrar

```
- [ ] Tabla con RLS
- [ ] Cliente puede signin
- [ ] RLS bloquea writes ajenos
```

Por que funciona: 3 checks que cubren los 3 modos de falla mas comunes. Cualquiera de los 3 fallando = la skill no cerro correcto. Mas de 3 en una skill simple es overhead; menos es cobertura insuficiente.

## Anti-patrones que esta skill evita

❌ Frontmatter con description en primera persona ("Yo configuro auth...").
❌ Body que mezcla codigo extenso (>50 lineas SQL inline). Solucion: split a `references/` o `assets/`.
❌ "Cuando NO activar" vacio. Cualquier skill madura tiene casos edge legitimos.
❌ Cross-references genericas ("usa otras skills cuando relevante"). Sin hand-off concreto, no sirve.
❌ Validacion vaga ("verifica que funciona"). Comandos verificables o checklist concreto.

## Cuanto tiempo toma escribir una

Una skill bien hecha: 30-90 minutos. Mas no significa mejor — significa probablemente sobre-engineered. Si lleva mas, cuestionar si el caso de uso justifica skill propia o si encaja en una existente.
