# RAG con pgvector — busqueda semantica en tu contenido

Caso: tienes lecciones, FAQs, documentacion propia. El alumno hace preguntas en lenguaje natural y quieres que el modelo responda usando solo tu contenido (no su entrenamiento).

## Habilitar extension

```sql
create extension if not exists vector;
```

## Tabla de documentos

```sql
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  source text not null, -- 'leccion', 'faq', 'doc', etc.
  source_id uuid, -- referencia al item original
  content text not null,
  embedding vector(1536), -- 1536 = dimension de text-embedding-3-small
  created_at timestamptz not null default now()
);

create index documents_embedding_idx on public.documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
```

`ivfflat` con 100 lists es buen default hasta ~100K filas. Mas alla, considerar HNSW.

## Generar embeddings al ingestar contenido

```ts
import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createServiceClient } from '@/lib/supabase/admin';

// Single doc
const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'El contenido de la leccion...',
});

await createServiceClient().from('documents').insert({
  source: 'leccion',
  source_id: leccion.id,
  content: leccion.content,
  embedding: embedding,
});

// Batch (mas barato, ~$0.02/M tokens)
const chunks = ['parrafo 1', 'parrafo 2', 'parrafo 3'];
const { embeddings } = await embedMany({
  model: openai.embedding('text-embedding-3-small'),
  values: chunks,
});
```

## Chunking del contenido

Documentos largos no se embeden de un jalon — el modelo tiene contexto limitado y los embeddings pierden precision. Chunking estrategia:

- Parrafos de 200-500 tokens.
- Overlap de 50-100 tokens entre chunks (para no perder context en bordes).
- Cada chunk se embede aparte.

```ts
function chunkText(text: string, maxTokens = 400, overlap = 80): string[] {
  // Approx 4 chars per token. Implementacion ingenua, suficiente para empezar.
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i += maxTokens - overlap) {
    chunks.push(words.slice(i, i + maxTokens).join(' '));
  }
  return chunks;
}
```

Para casos production-grade, usar `langchain` o `llamaindex` chunkers.

## Query semantica

```ts
import { embed } from 'ai';

export async function searchSimilar(query: string, topK = 5) {
  const supabase = createServiceClient();

  // 1. Embed el query
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: query,
  });

  // 2. Buscar top-K mas cercanos
  const { data } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_count: topK,
    match_threshold: 0.7, // distancia coseno minima
  });

  return data ?? [];
}
```

Funcion SQL:

```sql
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_count int,
  match_threshold float
)
returns table (id uuid, content text, similarity float)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

## Chat con context inyectado

```ts
// En tu route handler
const userQuery = messages[messages.length - 1].content;
const relevantDocs = await searchSimilar(userQuery, 5);

const context = relevantDocs.map((d) => d.content).join('\n\n---\n\n');

const result = streamText({
  model: openrouter('anthropic/claude-sonnet-4-6'),
  system: `
    Eres un asistente que responde preguntas usando solo el contexto proporcionado.
    Si la respuesta no esta en el contexto, di "No tengo esa info en mi base".

    Contexto relevante:
    ${context}
  `,
  messages,
});
```

## Re-rank (opcional, mejora calidad)

Top-5 inicial puede tener falsos positivos. Re-ranker (Cohere Rerank, $1/1K queries) reordena por relevancia real:

```ts
const reranked = await fetch('https://api.cohere.ai/v1/rerank', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.COHERE_API_KEY}` },
  body: JSON.stringify({
    model: 'rerank-multilingual-v3.0',
    query: userQuery,
    documents: relevantDocs.map((d) => d.content),
    top_n: 3,
  }),
});
```

Ahorras tokens al inyectar solo top-3 vs top-5, y la calidad sube.
