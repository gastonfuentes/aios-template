# OpenRouter

> **TL;DR**: Una sola key para 300+ modelos (Anthropic + OpenAI + Google + Mistral + Meta + xAI + más). Routing inteligente entre providers. Barrera de entrada más baja del template — registro gratis con créditos iniciales.

---

## Obtener API key

1. Crea cuenta en [openrouter.ai](https://openrouter.ai) (login Google/GitHub).
2. Carga créditos en [openrouter.ai/credits](https://openrouter.ai/credits) (mínimo $5; algunos modelos gratis sin créditos).
3. Genera key en [openrouter.ai/keys](https://openrouter.ai/keys) — **Create Key** → nombre arbitrario.
4. Copia el `sk-or-...` — visible solo una vez.

---

## Env vars sembradas

```bash
# agent-server/.env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxx
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5   # default; lista completa abajo
OPENROUTER_FALLBACK_MODELS=openai/gpt-5,google/gemini-2.5-pro   # opcional, OpenRouter failovers automático
```

El adapter [agent-server/src/adapters/llm/openrouter.ts](../../agent-server/src/adapters/llm/openrouter.ts) consume la API compatible OpenAI de OpenRouter y mapea `query()` cross-provider.

---

## Modelos sugeridos

| Caso | Modelo recomendado | Costo aprox / 1M tok |
|---|---|---|
| Chat principal (razonamiento) | `anthropic/claude-opus-4.7` | $15 in / $75 out |
| Default daemon | `anthropic/claude-sonnet-4.5` | $3 in / $15 out |
| Extractors / crons cheap | `anthropic/claude-haiku-4` | $0.80 in / $4 out |
| Alternativa OpenAI | `openai/gpt-5` | varía |
| Alternativa Google | `google/gemini-2.5-pro` | $1.25 in / $5 out |
| Gratis (rate-limited) | `meta-llama/llama-3.3-70b:free` | $0 |

Catálogo completo: [openrouter.ai/models](https://openrouter.ai/models).

---

## Routing inteligente

OpenRouter ofrece **fallback automático** si el provider primario falla:

```bash
# .env
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5
OPENROUTER_FALLBACK_MODELS=openai/gpt-5,google/gemini-2.5-pro
```

Si Anthropic rate-limita, OpenRouter prueba OpenAI; si falla, prueba Google. Cero código adicional en el daemon.

---

## Diferencias vs otros providers

| | OpenRouter | Anthropic API | Claude Code CLI |
|---|---|---|---|
| Modelos disponibles | 300+ cross-provider | Solo Anthropic | Solo Anthropic |
| Pricing | Pay-per-token + 5% markup OpenRouter | Pay-per-token | Plan flat |
| Memory Tool nativo | ✗ via Supabase | ✗ via Supabase | ✓ nativo |
| Setup time | 3 min | 3 min | 5 min |
| Failover automático | ✓ | ✗ | ✗ |

El 5% markup de OpenRouter es el costo del unified API + routing. Para single-operator es marginal.

---

## Troubleshooting

| Síntoma | Causa | Fix |
|---|---|---|
| `401 Unauthorized` | Key mal copiada o créditos = 0 | Verificar key + load créditos |
| `400 model not found` | Slug mal escrito (case-sensitive) | Verificar en [openrouter.ai/models](https://openrouter.ai/models) |
| Costos altos | Fallback a modelo caro (GPT-5) | Restringir `OPENROUTER_FALLBACK_MODELS` a tier cheap |
| Latency alta | Provider downstream lento | Cambiar modelo primario o reorder fallbacks |

---

## Cuándo elegirlo

✓ Bajo costo de entrada (créditos iniciales + tier free).
✓ Quieres comparar modelos sin múltiples cuentas.
✓ Necesitas failover entre providers.
✓ Trabajas con modelos non-Anthropic ocasionalmente.

✗ Plan flat Anthropic ya pagado → [Claude Code CLI](claude-code-cli.md) sale más barato.
✗ Quieres Memory Tool nativo → [Claude Code CLI](claude-code-cli.md).
