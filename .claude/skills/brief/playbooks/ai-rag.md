# Playbook: ai-rag

## Targets obligatorios
- **Embedding model**: `text-embedding-3-small` (1536d, barato) vs `-large` (3072d, mejor), Voyage, Cohere.
- **Chunking strategy**: fixed-size vs semantic vs hybrid. Overlap 10-20%.
- **Pgvector vs dedicated DB**: Supabase pgvector vs Pinecone/Qdrant/Weaviate.
- **Reranking**: Cohere Rerank o Voyage Rerank despues del retrieval initial.
- **Ingestion pipeline**: parsing (PDF/DOCX/HTML) → chunking → embedding → upsert.

## Targets opcionales
- **Hybrid search**: BM25 (Postgres FTS) + vector para mejor recall.
- **Query transformation**: HyDE, multi-query, query decomposition.
- **Evaluation**: metrics con ragas o Promptfoo.

## Busquedas sugeridas
- "pgvector vs Pinecone 2026 benchmark"
- "RAG chunking strategies"
- "Cohere Rerank vs Voyage rerank"
- "HyDE RAG technique"

## Fuentes primarias
- https://supabase.com/docs/guides/ai/vector-embeddings
- https://docs.cohere.com/docs/rerank
- https://www.pinecone.io/learn/chunking-strategies/

## Riesgos a investigar activamente
- Queries que no encuentran nada relevante — fallback: "no tengo info sobre X".
- Embeddings desactualizados cuando el modelo cambia — plan de re-indexacion.
- Privacy: si los docs contienen PII, no embebes literal — redact o tokenize.
