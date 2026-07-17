# Claude Code CLI

> **TL;DR**: El provider default del template. Preserva Memory Tool nativo del SDK Anthropic + cwd-shared sessions cross-superficie. Requiere plan Pro/Max de Anthropic. Mejor calidad de razonamiento + tools nativas.

---

## Instalación

```bash
npm install -g @anthropic-ai/claude-code
```

Versión mínima recomendada: `^2.1.138`. El SDK underlying `@anthropic-ai/claude-agent-sdk` queda pineado exact en el daemon (`agent-server/package.json`) para garantizar compat cross-update.

---

## Login

```bash
claude
# Primera vez: abre browser, OAuth con tu cuenta Anthropic
# Selecciona tu plan (Pro o Max)
```

El login persiste en `~/.claude/auth.json` (no tienes que re-login cada sesión).

Verifica con:
```bash
claude --version          # debería imprimir 2.1.x+
ls ~/.claude/auth.json    # debe existir
```

---

## Plan requerido

| Plan Anthropic | Compatible con AIOS |
|---|---|
| Pro ($20/mes) | ✓ Suficiente single-operator |
| Max ($100/mes o $200/mes) | ✓ Recomendado si haces deploy diario + muchas iteraciones |
| Free / Trial | ✗ Rate limits insuficientes |

Costos del daemon van **dentro de tu plan flat** — no pagas por token adicional. Esa es la principal ventaja vs API directa.

---

## Integración con BOOT.md

El template usa Claude Code CLI como provider default cuando detecta `which claude` exitoso durante el bootstrap. El adapter LLM cross-provider (`agent-server/src/adapters/llm/claude-code-sdk.ts`) implementa el `query()` contract del SDK directo, preservando:

- **Memory Tool nativo**: scope `project` activo via `memory: project` en frontmatter del subagente.
- **Cwd-shared sessions**: CLI + Telegram + MC PWA comparten state vía `cwd: PROJECT_ROOT`.
- **Reasoning summarized**: `thinking: { type: 'adaptive', display: 'summarized' }` opcional.
- **Settings hot-read**: cambios en `.claude/settings.json` se aplican sin rebuild del daemon.

---

## Env vars sembradas

```bash
# agent-server/.env
LLM_PROVIDER=claude-code-sdk
# No requiere API key adicional — el CLI maneja auth via ~/.claude/auth.json
```

```bash
# .claude/settings.json (versionado en repo)
{
  "agent": "<agent-name-lowercase>",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

---

## Modelos disponibles

El CLI expone los modelos de tu plan:
- `claude-opus-4-7` (default agente, mejor razonamiento)
- `claude-sonnet-4-5` (más rápido, mejor para cron jobs / extractors)
- `claude-haiku-4` (más rápido aún, para tasks simples)

El daemon selecciona el modelo via `options.model` override en `query()` calls específicos (ej. cron de consolidación usa Sonnet cheap; chat principal usa Opus).

---

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `claude: command not found` | CLI no instalado o PATH no incluye `/opt/homebrew/bin` | Re-instalar con `npm i -g`; verificar PATH |
| `Auth required` al primer query | OAuth expiró | Re-correr `claude` y aceptar OAuth |
| Daemon rate limit | Plan Pro insuficiente para uso intensivo | Upgradear a Max o reducir frecuencia de crons |
| Memory Tool no recall | Filename mismatch agentType ↔ `.claude/agent-memory/<agent>/` | Verificar `.claude/agents/<name>.md` filename matchea `agentType` |

---

## Cuándo elegirlo

✓ Tienes plan Pro o Max de Anthropic.
✓ Quieres Memory Tool nativo sin reimplementar via Supabase.
✓ Trabajas desde Mac/Linux con CLI cómodo.
✓ Necesitas cross-superficie sessions (MC + Telegram + CLI).

✗ No quieres pagar plan flat — usa [openrouter](openrouter.md) con pay-per-token.
✗ Necesitas modelos non-Anthropic (Gemini, Llama, Mistral) → [openrouter](openrouter.md).
