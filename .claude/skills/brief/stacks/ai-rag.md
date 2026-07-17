# Stack Recipe: ai-rag

> **Compatibilidad Praxis**: `MATCH`
> **Plataforma objetivo**: Web + ingestion background

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4
- Supabase (pgvector nativo para embeddings)
- Vercel AI SDK v5
- Zod + Zustand

## ADD
- Extension `pgvector` en Supabase
- `@supabase/supabase-js` con funciones RPC para similarity search
- `@ai-sdk/openai` (embeddings `text-embedding-3-small`/`-large`) o equivalente
- `langchain` (text-splitters) o `@mastra/core` si se prefiere mas tipado
- `pdf-parse` / `mammoth` / `unstructured-io` (parsers de docs)
- `@inngest/nextjs` (ingestion pipeline)
- Opcional: `cohere-rerank` o Voyage rerank (mejorar relevancia)

## REPLACE
- Ninguno.

## REMOVE
- Ninguno.

## CONFIG
- Migration: `CREATE EXTENSION vector;`
- Tabla `documents` con columna `embedding vector(1536)`
- Index: `USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`
- RPC `match_documents(query_embedding, threshold, count)`
- Ingestion pipeline: parser → chunker → embedder → upsert
- Cache de queries frecuentes (Upstash / kv)

## Archivos Praxis a eliminar
- Ninguno.

## Archivos nuevos a crear
- `src/features/rag/ingestion/pipeline.ts`
- `src/features/rag/retrieval/search.ts`
- `src/features/rag/retrieval/rerank.ts`
- `src/app/api/chat/route.ts` (RAG chat endpoint)
- `supabase/migrations/**_pgvector.sql`
- `src/inngest/functions/ingestDocument.ts`

## IDE / Toolchain externo requerido
- Supabase CLI (habilitar pgvector)
- Cuenta proveedor embeddings (OpenAI / Voyage / Cohere)
