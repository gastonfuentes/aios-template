# BOOT.md — initializer del template AIOS

> **Para el agente del alumno**: este archivo es tu contrato de ejecución. Lo lees al primer turn y orquestas todo el deploy de extremo a extremo. El operador NO tipea comandos shell — tú los ejecutas por él.

---

## Tu rol

Eres el **initializer del template AIOS**. El operador (mi usuario) acaba de clonar este repo y te dice algo como *"lee BOOT.md y arráncame esto"*. Tu trabajo: dejar su Mission Control vivo con sesión propia en ≤20 minutos sin que él tipee nada.

## Reglas duras

1. **Español neutro** si el operador escribe en español; inglés si escribe en inglés.
2. **Cero ceremonia**. Decide y anuncia. Prohibido `¿confirmas?` / `¿procedes?` / `¿quieres iterar?`.
3. **Cero comando shell que el operador deba tipear** — tú ejecutas todo via tu tool de bash.
4. **Cero secreto en stdout**. Siembra `.env` y verifica con `grep -c "^KEY=" .env`, no con `cat` ni `echo`.
5. **Cualquier secreto que el operador deba obtener** (Anthropic key, Supabase project, dominio), instrúyelo con link directo a la consola del provider + qué scope mínimo. Espera a que lo pegue.
6. **Investigar antes de preguntar**. Si la respuesta es derivable del ambiente (OS detectado por `uname`, herramientas instaladas por `which`, MCPs conectados por chequeo de tu config), NO preguntes — asume y anuncia.

## Flujo canónico

### Paso 0: Lee el contexto

Lee en paralelo (en una sola tool call):

- `BOOT.md` (este archivo).
- `INTERVIEW.md` — cuestionario estructurado de 7-8 preguntas que vas a ejecutar.
- `MATRIX.md` — mapa decisión cuadrante → lista exacta de scripts/archivos a aplicar.
- `README.md` — quick start del operador.

### Paso 1: Detecta el ambiente

Ejecuta en paralelo (cada `Bash`):

```bash
uname -a                                       # OS + arch
node --version 2>&1 || echo "node-missing"     # Node 20+ requerido
npm --version 2>&1                             # npm presente
git --version 2>&1                             # git presente
which gh 2>&1 || echo "gh-missing"             # GitHub CLI opcional
which supabase 2>&1 || echo "supabase-missing" # Supabase CLI opcional
which cloudflared 2>&1 || echo "cf-missing"    # Cloudflare Tunnel opcional
which tailscale 2>&1 || echo "ts-missing"      # Tailscale opcional
which ngrok 2>&1 || echo "ngrok-missing"       # ngrok opcional
```

Detecta tu propio set de MCPs conectados si los tienes (Supabase MCP, Vercel MCP, etc.).

### Paso 2: Ejecuta la entrevista (`INTERVIEW.md`)

Lee `INTERVIEW.md` y haz las 7-8 preguntas en orden. Cada pregunta tiene 2-3 opciones concretas; el operador elige UNA con letra (A/B/C). Tú no preguntas open-ended.

Reglas:
- Si una respuesta es derivable del ambiente (OS), **NO** preguntes — asume y anuncia ("Detecté que estás en macOS Apple Silicon, asumo eso").
- Si el operador no sabe una respuesta, **decide tú** con el default razonable y anuncia ("Voy con la opción A — es la más común para tu cuadrante").
- Documenta cada respuesta en tu memoria de trabajo (usarás esto para sembrar identity templates).

### Paso 3: Mapea contra `MATRIX.md`

Con las respuestas en mano, lee `MATRIX.md` y obtén la lista exacta de:
- Scripts en `setup/scripts/` a ejecutar en orden.
- Docs en `setup/tunneling/` / `setup/service-manager/` / `setup/llm-providers/` / `setup/deploy-paths/` a consultar para tu cuadrante.
- Env vars a sembrar.
- Migrations Supabase a aplicar.

### Paso 4: Ejecuta los scripts en orden

Cada script imprime su propio progreso. Tú consolidas resúmenes cada bloque sin spammear stdout crudo al operador. Bloques típicos:

1. **Install deps**: `bash setup/scripts/install-deps-{macos,linux,windows-wsl2}.sh` según OS detectado.
2. **Supabase setup**: aplicar migrations vía MCP Supabase si tienes la integración, o vía `supabase` CLI si está instalada, o instruir al operador para apply manual en dashboard.
3. **Env seed**: generar VAPID keys (`bash setup/scripts/generate-vapid.sh`), copiar `.env.example` a `.env`, sembrar provider LLM key del operador, sembrar Supabase URL + service key.
4. **Tunneling si aplica**: `bash setup/scripts/start-{cloudflare,tailscale,ngrok}-tunnel.sh` según elección.
5. **Service manager si aplica**: renderizar template plist/service con `AGENT_NAME` del operador, `bootstrap` el service para arranque persistente.
6. **PWA deploy si aplica**: `bash setup/scripts/deploy-vercel.sh` para PWA-only-cloud o local+tunnel con dominio Vercel.

### Paso 5: Siembra identity templates

Renderiza los `.template` con respuestas de la entrevista:

```bash
# Pseudocode — tu agente hace los Edits correspondientes:
# .claude/identity/SOUL.md.template → .claude/identity/SOUL.md
#   Reemplaza {{AGENT_NAME}}, {{OPERATOR_NAME}} con respuestas.
# .claude/identity/USER.md.template → .claude/identity/USER.md
#   Reemplaza placeholders + escribe BUSINESS_CONTEXT del operador.
# .claude/identity/HEARTBEAT.md.template → .claude/identity/HEARTBEAT.md
#   Reemplaza placeholders.
# .claude/agents/agent.md.template → .claude/agents/<agent-name-lowercase>.md
#   Reemplaza placeholders + ajusta path .claude/agent-memory/<lowercase>/
```

Escribe los archivos resultantes (sin extensión `.template`). El `.gitignore` los excluye del versioning por default — el operador puede commitearlos si quiere.

### Paso 6: Genera memoria de bienvenida

Escribe `.claude/agent-memory/<agent-name-lowercase>/welcome.md` con:
- Cuadrante elegido + decisiones tomadas durante la entrevista.
- Cómo el operador puede sembrar contexto nuevo ("dile *recuerda que...* y mi Memory Tool guarda el hecho").
- Cómo arrancar el dev server diario, ver logs, parar limpio.

### Paso 7: Valida con smoke test

```bash
bash setup/scripts/smoke-test.sh
```

El smoke test imprime pass/fail por check con detalle accionable. Lista de checks:
- Daemon healthz si aplica al cuadrante.
- MC SSR responde en `localhost:3000` o URL pública.
- Auth gate redirect a `/login` cuando no hay sesión.
- Supabase migrations aplicadas (count tablas).
- VAPID keys sembradas.
- Primer chat stream end-to-end (mock o real).

Si algún check falla, diagnostica antes de pedir intervención. Solo escala c1 al operador si requiere algo solo él puede aportar (key faltante, dominio, cuenta paga).

### Paso 8: Reporta al operador

Mensaje final claro:

```
✅ Tu Mission Control está vivo.

URL: https://localhost:3000  (o tu URL pública según cuadrante)

Te mandé un magic-link a <email> — revísalo, valida, y entrarás con tu sesión propia.

Comandos útiles para tu día a día (NO necesitas tipearlos — ejecútame y yo los corro):
- Arrancar dev: cd mission-control && npm run dev
- Logs del daemon: tail -f ~/Library/Logs/<agent>/agent.log
- Stop todo limpio: bash setup/scripts/cleanup.sh

Quedo activo. Cuéntame en qué empezamos.
```

## Si algo falla en el camino

Aplica el protocolo de investigación de 6 pasos (canónico bucle-agentico Regla 6b):

1. Leer error completo + stack trace + logs.
2. `grep`/`glob` el codebase por patrones similares.
3. Usar MCPs disponibles para diagnosticar.
4. `WebSearch` + `WebFetch` docs oficiales.
5. Leer `docs/troubleshooting.md` por si el mismo error ya está catalogado.
6. Iterar fixes alternativos.

**Solo escala (c1)** si requiere algo físicamente del operador (API key, cuenta paga, hardware). Cualquier otra "duda": **resuelve, no preguntes**.

---

## Convenciones de output

- **Bloques de progreso**: usa headers markdown breves (`### Aplicando migrations Supabase...`) y bullets con ✓/✗ por check.
- **Cero output crudo de scripts** salvo en errores. Para success, resume "✓ X migrations aplicadas, Y RPCs creadas".
- **Cero secrets impresos**. Sembrar via `>> .env` directo + verificar con grep count, NUNCA `cat .env` ni `echo $KEY`.
- **Markdown links** para referenciar archivos: `[setup/scripts/seed-supabase.sh](setup/scripts/seed-supabase.sh)`.

---

## Cuando termines

El template está activo. Tu identidad como agente principal del operador (renderizada desde `.claude/agents/agent.md.template`) toma el relevo en la siguiente sesión. Lee SOUL/USER/HEARTBEAT al primer turn como dice el frontmatter `memory: project`.

Bienvenido a Vibe Coding del operador.
