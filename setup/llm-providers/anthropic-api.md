# Anthropic API directa

> **TL;DR**: Pagas por token consumido. Control fino de costos vs plan flat. Memory Tool reimplementado via Supabase (no nativo). Sin Claude Code CLI dependency.

---

## Obtener API key

1. Crea cuenta en [console.anthropic.com](https://console.anthropic.com).
2. Settings → API Keys → **Create Key**.
3. Scope: `User API Key` (suficiente single-operator).
4. Copia el `sk-ant-...` — solo se muestra una vez.
5. Carga créditos prepagados en Billing (mínimo $5).

---

## Env vars sembradas

```bash
# agent-server/.env
LLM_PROVIDER=anthropic-api
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4-5   # default; override por call si quieres Opus
```

El adapter [agent-server/src/adapters/llm/anthropic-api.ts](../../agent-server/src/adapters/llm/anthropic-api.ts) consume el SDK oficial `@anthropic-ai/sdk` y mapea el contract `query()` cross-provider.

---

## Modelos default

| Modelo | Use case | Input $ / 1M tok | Output $ / 1M tok |
|---|---|---|---|
| `claude-opus-4-7` | Chat principal, razonamiento complejo | $15 | $75 |
| `claude-sonnet-4-5` | Default daemon, cron jobs, extractors | $3 | $15 |
| `claude-haiku-4` | Tasks simples, summaries | $0.80 | $4 |

Costos típicos single-operator (~30 chats/día + 4 crons): **$10-40/mes**. Menos que Pro flat ($20) en uso bajo; más en uso intensivo.

---

## Diferencias vs Claude Code CLI

| | API directa | CLI (claude-code-sdk) |
|---|---|---|
| Pricing | Pay-per-token | Plan flat Pro/Max |
| Memory Tool | Reimplementado via Supabase | Nativo del SDK |
| Cross-superficie sessions | Manual via session_id | Automático cwd-shared |
| Reasoning summarized | ✓ Soportado | ✓ Soportado |
| Setup time | 3 min (solo key) | 5 min (CLI install + OAuth) |
| Tool use (MCPs) | ⚠ via SDK manual | ✓ Nativo del CLI |

---

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `401 Unauthorized` | Key mal copiada o sin créditos | Verificar key en console + load credits |
| `429 rate limited` | Tier 1 default (5 req/min Opus) | Upgradear tier en console (gratis, tras uso inicial) |
| `400 invalid model` | Modelo deprecated o typo | Verificar lista en [docs.anthropic.com/models](https://docs.anthropic.com/en/docs/about-claude/models) |
| Costos altos inesperados | Opus default en cron jobs | Override a Sonnet/Haiku en `options.model` |

---

## Cuándo elegirlo

✓ Quieres pay-per-use sin plan flat.
✓ Uso esporádico (no tienes Pro plan justificado).
✓ Vas a deployar para cliente y quieres facturar tokens reales.

✗ Uso intensivo diario → [Claude Code CLI](claude-code-cli.md) con plan flat sale más barato.
✗ Necesitas modelos non-Anthropic → [openrouter](openrouter.md).
