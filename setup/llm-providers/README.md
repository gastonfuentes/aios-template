# LLM Providers — comparativa

> **TL;DR**: 3 providers oficialmente soportados + Codex CLI opt-in comunidad. El voto del template depende de si ya pagas plan flat Anthropic, si quieres pay-per-token, o si quieres unified API multi-provider.

---

## Comparativa

| Provider | Pricing | Memory Tool | Modelos | Setup time | Mejor para |
|---|---|---|---|---|---|
| **Claude Code CLI** | Plan flat Pro $20 / Max $100 | ✓ Nativo SDK | Anthropic only | ~5 min | Uso intensivo diario, calidad máxima |
| **Anthropic API** | Pay-per-token | ⚠ via Supabase | Anthropic only | ~3 min | Uso esporádico, deploy cliente con facturación |
| **OpenRouter** | Pay-per-token + 5% | ⚠ via Supabase | 300+ cross-provider | ~3 min | Barrera entrada baja, multi-provider failover |
| **Codex CLI** (opt-in) | OpenAI Plus $20 | ⚠ via Supabase | OpenAI only | ~5 min | Operadores OpenAI loyal — no oficial v1 |

---

## Voto del template

### Para uso intensivo + plan Anthropic ya pagado
**Claude Code CLI**. Memory Tool nativo + cwd-shared sessions cross-superficie + plan flat predictible. Doc: [claude-code-cli.md](claude-code-cli.md).

### Para uso esporádico o deploy cliente
**Anthropic API directa**. Pay-per-token control fino, perfecto para facturar al cliente tokens reales sin compartir plan. Doc: [anthropic-api.md](anthropic-api.md).

### Para barrera de entrada baja o multi-provider
**OpenRouter**. 300+ modelos con una sola key, routing inteligente, failover automático, tier free para algunos modelos. Doc: [openrouter.md](openrouter.md).

### Para operadores OpenAI loyal (opt-in v1)
**Codex CLI**. No oficialmente soportado en v1 del template — un adapter comunitario puede aparecer en futuro. Por ahora, recomendamos [OpenRouter](openrouter.md) con `openai/gpt-5` o `openai/o1` como modelo primario.

---

## Cómo decide el agente

Durante la entrevista (`INTERVIEW.md` Pregunta 3), el agente ofrece A/B/C según contexto. Si no tienes ninguno, el agente recomienda **OpenRouter** por barrera de entrada más baja.

Los 3 providers son **intercambiables runtime** — el adapter LLM cross-provider del daemon (`agent-server/src/adapters/llm/`) implementa el mismo contract `query()` para los 3. Cambiar provider = cambiar `LLM_PROVIDER` env var + reiniciar daemon. Cero refactor de código.
