# INTERVIEW.md — cuestionario del agente al operador

> El agente del alumno (consumido desde `BOOT.md`) ejecuta este cuestionario en orden estricto. 7-8 preguntas con 2-3 opciones concretas cada una. Cero pregunta open-ended.

---

## Reglas para el agente

- **Una pregunta a la vez**. Espera respuesta antes de avanzar.
- **2-3 opciones máximo** con letra (A/B/C) + descripción corta.
- Si una respuesta es **derivable del ambiente** (OS detectado, herramientas instaladas), **NO preguntes** — asume y anuncia.
- Si el operador no sabe, **decide tú** con default razonable y anuncia.
- **Skip preguntas no aplicables** según respuestas previas (ej. si elige local-only, NO preguntar tunneling).
- **Documenta cada respuesta** para sembrar identity templates al final.

---

## Pregunta 1 — Identidad del agente

> **Pregunta**: ¿Cómo te llamas tú y cómo quieres que se llame tu agente principal (el que va a vivir en tu Mission Control y responderte 24/7)?

**Formato esperado**: nombre del operador + nombre del agente.

**Ejemplo de respuesta válida**: *"Soy María García y mi agente se va a llamar Echo"*.

**Acción del agente**: registra `{{OPERATOR_NAME}} = "María García"` + `{{AGENT_NAME}} = "Echo"` + `{{AGENT_NAME_LOWERCASE}} = "echo"`.

---

## Pregunta 2 — Dispositivos donde usarás tu Mission Control

> **Pregunta**: ¿En qué dispositivos vas a usar tu Mission Control?
>
> A) Solo esta laptop, no necesito acceso desde móvil ni desde otra red.
> B) Laptop + móvil + cualquier red — quiero acceder desde mi iPhone/Android cuando salgo.
> C) Voy a deployar a un VPS production-grade para mí o para un cliente.

**Acción del agente** según respuesta:
- **A** → cuadrante `local-only`. Skip pregunta 5 (tunneling).
- **B** → cuadrante `local-tunnel`. Continuar a pregunta 5.
- **C** → cuadrante `vps-linux`. Continuar a pregunta 5 (para SSL termination).

**Caso extra**: si el operador no quiere infra local en absoluto y prefiere todo en Vercel (degradando capabilities), ofrece **D) PWA-only cloud — Vercel + Supabase, sin daemon. Pierdo crons 24/7 + Telegram bot + voice, pero no tengo que mantener nada always-on**. Cuadrante `pwa-only-cloud`.

---

## Pregunta 3 — LLM provider que tienes a la mano

> **Pregunta**: ¿Qué LLM provider vas a usar para tu agente?
>
> A) Claude Code CLI con plan Pro/Max de Anthropic — quiero la mejor calidad y ya tengo el CLI instalado.
> B) Anthropic API directa — pago por token, control fino, sin Claude Code CLI.
> C) OpenRouter — una sola key para 300+ modelos (Anthropic, OpenAI, Google, Mistral...), costos agresivos.

**Acción del agente**:
- **A** → `LLM_PROVIDER=claude-code-sdk` (default del template, preserva Memory Tool nativo).
- **B** → `LLM_PROVIDER=anthropic-api`. Pide al operador su `ANTHROPIC_API_KEY` (link a console.anthropic.com/settings/keys).
- **C** → `LLM_PROVIDER=openrouter`. Pide al operador su `OPENROUTER_API_KEY` (link a openrouter.ai/keys).

Si el operador no tiene ninguno, recomienda **C** (OpenRouter) por barrera de entrada más baja — registro gratis + créditos iniciales.

---

## Pregunta 4 — Supabase project

> **Pregunta**: ¿Ya tienes un Supabase project o creamos uno?
>
> A) Ya tengo un Supabase project — te paso URL + service role key.
> B) Créamelo tú vía MCP Supabase si tienes la integración conectada.
> C) Ayúdame a crear uno manualmente con screenshots (te guío paso a paso en supabase.com).

**Acción del agente**:
- **A** → pide `SUPABASE_URL` (formato `https://<ref>.supabase.co`) + `SUPABASE_SERVICE_ROLE_KEY` (linkea a tu Supabase project settings → API).
- **B** → si tienes MCP Supabase conectado, ejecuta `mcp__supabase__create_project` con nombre `<agent-name>-mc` y región US East. Si no tienes MCP, escala a opción C.
- **C** → imprime instrucciones markdown con screenshots (1. Ir a supabase.com → New Project → Free tier → US East → ... 2. Settings → API → copia URL + service_role key → pégamelas aquí).

Tras tener URL + key, aplica las migraciones en `supabase/migrations/` (vía MCP, CLI, o instrucción manual al operador).

---

## Pregunta 5 — Tunneling (solo si elegiste B/C en Pregunta 2)

> **Pregunta**: ¿Qué herramienta de tunneling prefieres para exponer tu daemon al móvil/internet?
>
> A) Cloudflare Tunnel — gratis ilimitado, pero requiere dominio propio en Cloudflare DNS.
> B) Tailscale Funnel — gratis hasta 100 devices, sin dominio (te da subdominio `*.ts.net`), MagicDNS.
> C) ngrok — el más conocido, gratis con URL random cada restart, paid para custom domain.

**Acción del agente**:
- **A** → consulta `setup/tunneling/cloudflare.md` y ejecuta `bash setup/scripts/start-cloudflare-tunnel.sh`.
- **B** → consulta `setup/tunneling/tailscale.md` y ejecuta `bash setup/scripts/start-tailscale-funnel.sh`.
- **C** → consulta `setup/tunneling/ngrok.md` y ejecuta `bash setup/scripts/start-ngrok-tunnel.sh`.

Si el operador no tiene dominio propio, recomienda **B** (Tailscale) — sweet spot sin compra de dominio.

---

## Pregunta 6 — Telegram bot + voice (opt-in)

> **Pregunta**: ¿Quieres bot de Telegram para hablar con tu agente desde el celular + voice STT/TTS para mandarle notas de voz?
>
> A) Sí, dame los pasos para crear el bot + dame las keys de voice providers.
> B) No por ahora — me quedo con la PWA solamente, sumo Telegram después si lo necesito.

**Acción del agente**:
- **A** → instrucciones para `TELEGRAM_BOT_TOKEN` (vía @BotFather) + `ALLOWED_CHAT_ID` + `GROQ_API_KEY` (groq.com) + `ELEVENLABS_API_KEY` (elevenlabs.io). Sembrar en `.env` del daemon.
- **B** → skip. El daemon arranca fail-soft sin Telegram (log WARN, daemon vivo).

---

## Pregunta 7 — Datos demo sembrados

> **Pregunta**: ¿Quieres que siembre datos demo para que veas tu Mission Control vivo desde el primer login (1 chat de bienvenida + 1 cron job ejemplo + 1 canvas Draw con diagrama + 3 notifications de onboarding)?
>
> A) Sí, sembrar — quiero ver el MC con contenido desde el primer login.
> B) No, arranco vacío — prefiero empezar limpio.

**Acción del agente**:
- **A** → ejecuta `psql ... < supabase/seed-demo.sql` o vía MCP Supabase `execute_sql`.
- **B** → skip seed.

---

## Pregunta 8 — Contexto del operador

> **Pregunta**: Describe en 3-4 líneas tu contexto de trabajo o negocio:
>
> - A qué te dedicas (creator solo, agencia, empresa, estudiante).
> - Cuáles son tus audiencias principales.
> - Qué quieres lograr con tu Mission Control (organizar trabajo personal, atender clientes, monitorear métricas, automatizar tareas).
> - Stack tecnológico de tu negocio si aplica.

**Acción del agente**: registra como `{{BUSINESS_CONTEXT}}` (texto libre del operador). Lo siembras en `.claude/identity/USER.md` + opcionalmente en `.claude/memory/business-context.md` como bullet list resumida.

---

## Cuando termines la entrevista

Procede al **Paso 3** de `BOOT.md` — mapear contra `MATRIX.md` y ejecutar los scripts correctos para el cuadrante elegido.
