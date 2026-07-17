# Agente que busca en internet

Tool calling — el modelo decide cuando llamar `web_search` y combina los resultados con su respuesta.

## Provider de busqueda

OpenRouter no tiene busqueda built-in. Tres opciones canonicas:

1. **Tavily Search** (`https://tavily.com`) — pensado para LLMs, $5/mes plan free.
2. **Brave Search API** (`https://brave.com/search/api`) — $0 hasta 2K queries/mes.
3. **SerpApi** (`https://serpapi.com`) — Google results, $50/mes.

Default Praxis: Tavily. Diseñada para AI, retorna chunks pre-formateados.

## Setup

```env
TAVILY_API_KEY=tvly-xxxxx
```

```ts
import { streamText, tool } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openrouter('anthropic/claude-sonnet-4-6'),
    system: 'Eres un asistente que puede buscar en internet cuando necesite info actual.',
    messages,
    tools: {
      web_search: tool({
        description: 'Busca informacion actual en internet. Usa solo cuando el usuario pregunta algo que requiere datos recientes.',
        parameters: z.object({
          query: z.string().describe('La query de busqueda en lenguaje natural'),
        }),
        execute: async ({ query }) => {
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query,
              max_results: 5,
            }),
          });
          const data = await res.json();
          return {
            results: data.results.map((r: { title: string; url: string; content: string }) => ({
              title: r.title,
              url: r.url,
              snippet: r.content,
            })),
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

## El loop tool-call

El AI SDK lo maneja automatico:

1. User pregunta "que pasa en YOUR_COMMUNITY hoy?".
2. Modelo decide llamar `web_search({ query: 'YOUR_COMMUNITY novedades hoy' })`.
3. Tu `execute` corre y devuelve resultados.
4. SDK pasa los resultados al modelo como `tool` message.
5. Modelo continua y genera respuesta usando los resultados.

Todo en un solo stream — el cliente solo ve la respuesta final.

## Limitar el uso del tool

Sin limites, el modelo puede llamar `web_search` para cosas que ya sabe (math, conceptos basicos), gastando tokens y latencia. El system prompt restrictivo ayuda:

```
Solo llama web_search cuando:
- El usuario pregunta sobre eventos recientes (despues de tu cutoff de entrenamiento).
- El usuario pide datos cuantitativos especificos (precios, cifras, estadisticas).
- El usuario menciona "ultimo", "actual", "hoy", "esta semana".

NO llames web_search para:
- Definiciones de conceptos.
- Explicaciones generales.
- Cosas que el contexto ya cubre.
```

Esto reduce ~40% de tool calls innecesarios en testing real.

## Multi-step tools

Modelos sofisticados (Sonnet 4.6+, GPT-4) pueden encadenar tools:

```
search → leer URL especifica → search nuevamente con info refinada → respuesta final
```

El SDK maneja el loop con `experimental_continueSteps: true`. Para casos sencillos, dejar el default.
