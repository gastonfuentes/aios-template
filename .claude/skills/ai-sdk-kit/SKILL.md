---
name: ai-sdk-kit
description: "Agrega features de IA a apps Next.js con Vercel AI SDK v5 + OpenRouter (300+ modelos via una sola API). Cubre primer chatbot, agente que busca en internet, agente con memoria persistente del alumno, RAG con embeddings, generacion de imagenes. Activar cuando el usuario menciona chatbot, asistente, agregar IA, agente que busca, RAG, embeddings, generacion de texto, integrar OpenAI/Anthropic/Gemini, o pide 'mi app inteligente'."
allowed-tools: Read, Write, Edit, Bash
---

# ai-sdk-kit — IA en tu app, organizado por caso de uso

> Vercel AI SDK v5 como capa de abstraccion, OpenRouter como proveedor (acceso a Claude, GPT, Gemini, Llama, Qwen, etc. con una sola API key). Caching nativo + streaming + tool calling cross-provider.

---

## Cuando activar

- "Quiero un chatbot en mi pagina."
- "Mi app necesita un asistente."
- "Que el agente sepa quien es el alumno."
- "Buscar informacion en internet desde la app."
- "RAG / embeddings / vector search."
- "Generar texto/codigo/respuestas."

## Cuando NO activar

- Generar imagenes. Eso es `@.claude/skills/image-kit/SKILL.md`.
- Solo prompts manuales sin SDK (one-shot a una API). Esa es operacion directa con `fetch`.
- Fine-tuning de modelos custom. Fuera de scope — referir a docs de OpenAI/Anthropic.

## Antes de empezar — verifica empiricamente

- [ ] `OPENROUTER_API_KEY` en `.env.local`. Si falta, escalar c1 con `references/setup-openrouter.md`.
- [ ] `npm install ai @ai-sdk/openrouter` instalado. Si no, instalar.
- [ ] Si caso de uso requiere persistencia: `auth-stack` integrado (necesitas `profiles`).
- [ ] Si RAG/embeddings: `supabase-admin` operativo + extension `vector` habilitada.

## Casos de uso (ordenados por progresion del alumno)

### Caso 1: primer chatbot — el "hola mundo" de IA

El alumno YOUR_COMMUNITY empieza aqui. Una pagina simple `/chat` con un input y stream del modelo.

`src/app/api/chat/route.ts`:

```ts
import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openrouter('anthropic/claude-haiku-4-5'),
    system: 'Eres un asistente amable que habla en espanol.',
    messages,
    maxOutputTokens: 1000,
  });

  return result.toUIMessageStreamResponse();
}
```

Cliente `src/app/chat/page.tsx`:

```tsx
'use client';
import { useChat } from '@ai-sdk/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div className="mx-auto max-w-2xl p-4">
      {messages.map((m) => (
        <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Pregunta algo..." />
      </form>
    </div>
  );
}
```

Razon de empezar con Haiku 4.5: rapido, barato (~$0.20/M tokens), suficiente para un primer caso. Cuando el alumno necesite mas calidad, cambiar el `model` string a `anthropic/claude-sonnet-4-6`.

### Caso 2: agente que busca en internet

Tool calling — el modelo decide cuando llamar una funcion `web_search`.

`references/agent-with-search.md` tiene el setup completo. Resumen:

```ts
import { tool } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: openrouter('anthropic/claude-sonnet-4-6'),
  messages,
  tools: {
    web_search: tool({
      description: 'Busca info actual en internet',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const res = await fetch(`https://api.search.example.com?q=${encodeURIComponent(query)}`);
        return await res.json();
      },
    }),
  },
});
```

El AI SDK maneja el loop tool-call automatico — el modelo pide search, ejecutas, devuelves resultado, modelo continua respuesta.

### Caso 3: agente con memoria persistente del alumno

Patron canonico Praxis. El agente lee `profiles` para conocer al usuario, y guarda conversaciones en `conversations` + `messages` para retomarlas.

`references/agent-with-memory.md` tiene el setup completo. Resumen:

```ts
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

const result = streamText({
  model: openrouter('anthropic/claude-sonnet-4-6'),
  system: `Estas hablando con ${profile.full_name}. Es ${profile.role}. Adapta tu tono.`,
  messages,
});
```

Tablas:

```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "convs_self" on public.conversations for all using (auth.uid() = user_id);
create policy "msgs_self" on public.messages
  for all using (
    exists(select 1 from public.conversations where id = messages.conversation_id and user_id = auth.uid())
  );
```

Cross-ref `@.claude/skills/auth-stack/SKILL.md` para resolver `user`, `@.claude/skills/supabase-admin/SKILL.md` para las migraciones.

### Caso 4: RAG con embeddings (busqueda semantica en tu contenido)

Para apps que tienen contenido propio (lecciones, FAQs, docs) y el usuario hace preguntas en lenguaje natural.

`references/rag-pgvector.md` tiene el setup completo. Pasos:

1. Habilitar extension `vector` en Supabase.
2. Tabla `documents` con columna `embedding vector(1536)`.
3. Generar embeddings con `embed` o `embedMany` del SDK.
4. Query con `<=>` (distancia coseno) para top-K relevantes.
5. Pasar resultados como context al `streamText`.

### Caso 5: structured output (extraer JSON desde texto)

`generateObject` con un schema Zod fuerza al modelo a devolver JSON valido.

```ts
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: openrouter('anthropic/claude-sonnet-4-6'),
  schema: z.object({
    nombre: z.string(),
    email: z.string().email(),
    telefono: z.string().optional(),
  }),
  prompt: `Extrae los datos de contacto de: ${textoLibre}`,
});
```

Util para parsing de formularios libres, OCR de docs, etc.

## Si tu Directiva no es Next.js/Supabase

- Cualquier framework Node: el AI SDK es framework-agnostico (`streamText`, `generateText`, `embed`). El frontend puede ser Vue, Svelte, vanilla JS — solo el hook `useChat` es React.
- Backend-only: misma API, sin frontend. Util para batch processing o agentes en background.
- React Native: AI SDK funciona desde Edge Functions; el cliente mobile habla con tu API.

## Cross-references con skills hermanas

- `@.claude/skills/auth-stack/SKILL.md` — `profiles` da contexto al agente. Hand-off: el `system` prompt incluye `profile.full_name` y `profile.role`.
- `@.claude/skills/supabase-admin/SKILL.md` — `conversations` y `messages` para memoria persistente. Hand-off: extension `vector` para RAG.
- `@.claude/skills/image-kit/SKILL.md` — generacion de imagenes via OpenRouter (modelos como Gemini Image). Hand-off: el prompt sale del chat, image-kit ejecuta la generacion.
- `@.claude/skills/playwright-cli/SKILL.md` — testear que el chat responda correctamente sin alucinaciones obvias.

## Archivos lazy-loaded

- `references/setup-openrouter.md` — crear cuenta, conseguir API key, plan inicial vs paid.
- `references/agent-with-search.md` — setup completo del Caso 2 (web search tool).
- `references/agent-with-memory.md` — setup completo del Caso 3 (profiles + conversations).
- `references/rag-pgvector.md` — setup completo del Caso 4 (extension vector + queries).
- `references/structured-output.md` — Caso 5 con Zod schemas para casos comunes.
- `references/cost-control.md` — patron de caching, eleccion de modelo segun caso, limites por user.
- `references/streaming-vs-batch.md` — cuando preferir uno vs otro.
- `assets/chat-ui.tsx` — componente chat completo con paleta YOUR_COMMUNITY.
- `assets/agent-system-prompts.md` — plantillas de system prompts para distintos casos (asistente educativo, agente de ventas, copy editor, etc.).

## Validacion al cerrar

- [ ] Endpoint `/api/chat` devuelve stream sin errores.
- [ ] Frontend renderiza tokens en tiempo real (cada chunk visible).
- [ ] Cost tracking funciona (log de tokens por request).
- [ ] Si memoria: `messages` se persisten + recargan al volver a la conversacion.
- [ ] Rate limit por user (max N requests por hora).
