# Setup OpenRouter — una API key, 300+ modelos

OpenRouter es un agregador de proveedores. Una sola API key te da acceso a Claude, GPT-4, Gemini, Llama, Qwen, DeepSeek, Mistral, etc. Pricing pass-through (cobra como cada provider, mas ~5% routing fee).

## 1. Crear cuenta

`https://openrouter.ai/signin`. Login con Google o email.

## 2. Cargar credito

Dashboard → Credits → Add. Minimo $5. Se descuenta segun uso real (input tokens + output tokens segun precio del modelo).

Plan free: ~$0.50 de credito gratuito + acceso a algunos modelos free-tier (Llama, Gemini Flash). Suficiente para probar el primer chatbot.

## 3. Generar API key

Dashboard → Keys → Create Key. Nombrala `praxis-prod`. Copia el valor (empieza con `sk-or-`).

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
```

## 4. Modelos canonicos para el catalogo Praxis

Eleccion por caso de uso (ranking actualizado mayo 2026):

| Caso | Modelo recomendado | Razon |
|---|---|---|
| Chatbot rapido y barato | `anthropic/claude-haiku-4-5` | $0.20/M input, $1.00/M output. Calidad alta. |
| Asistente sofisticado | `anthropic/claude-sonnet-4-6` | $3/M input, $15/M output. Razonamiento complejo. |
| Tareas con tool calling | `anthropic/claude-sonnet-4-6` | Manejo robusto de tools y context grande. |
| Generacion de imagenes via texto | `google/gemini-2.0-flash-exp:free` o `google/gemini-image-generation` | Multimodal output. |
| Embeddings | `openai/text-embedding-3-small` | $0.02/M tokens. 1536 dim, suficiente para RAG. |
| Modelos free-tier para experimentar | `meta-llama/llama-3.3-70b-instruct:free` | Rate limited pero $0. |

## 5. Switching de modelo a runtime

Cambiar el string del modelo (no requiere redeploy):

```ts
const model = process.env.MODEL_OVERRIDE
  ? openrouter(process.env.MODEL_OVERRIDE)
  : openrouter('anthropic/claude-haiku-4-5');
```

## 6. Cost control

OpenRouter dashboard muestra spend en tiempo real. Configurar alerts:

- Email cuando spend supera X.
- Auto-pause cuando supera Y para evitar runaway costs.

Plus: cross-ref `references/cost-control.md` para tecnicas de caching, eleccion adaptativa, y limites por user.

## 7. Rate limits

Dependen del modelo. Generalmente 50-200 RPM. Si tu app tiene mas trafico, configurar:

```ts
const result = streamText({
  model: openrouter('anthropic/claude-sonnet-4-6'),
  messages,
  // Si rate limited, fallback automatico a haiku
  experimental_continueSteps: true,
});
```

O implementar queue propia si el caso es batch.
