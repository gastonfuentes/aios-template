# Stack Recipe: ai-chatbot

> **Compatibilidad Praxis**: `MATCH`
> **Plataforma objetivo**: Web (con UX movil optimizada)

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4
- Supabase (persistir conversaciones, usuarios, mensajes)
- Vercel AI SDK v5 (streaming nativo, tool-use, multi-proveedor)
- Zod + Zustand

## ADD
- `@ai-sdk/openai` + `@ai-sdk/anthropic` o `@openrouter/ai-sdk-provider`
- `@ai-sdk/react` (`useChat`, `useCompletion`)
- `react-markdown` + `remark-gfm` + `rehype-highlight` (renderizar respuestas)
- `react-textarea-autosize` (textarea que crece)
- Opcional: `@vercel/kv` o Upstash Redis (rate limiting)
- Opcional: `tiktoken-node` (estimacion de tokens)

## REPLACE
- Ninguno.

## REMOVE
- Ninguno.

## CONFIG
- Tablas: `chats`, `messages` (con `role`, `content`, `tool_calls`, `token_usage`)
- RLS: el usuario solo ve sus chats
- Rate limiting por usuario con Upstash / Redis
- Variables: `OPENROUTER_API_KEY` (o el proveedor elegido)
- Streaming con Server Actions + `experimental_StreamingReactResponse` o `useChat`

## Archivos Praxis a eliminar
- Ninguno.

## Archivos nuevos a crear
- `src/features/chat/components/ChatWindow.tsx`
- `src/features/chat/components/MessageBubble.tsx`
- `src/features/chat/api/route.ts` (endpoint streaming)
- `supabase/migrations/**_chat_tables.sql`

## IDE / Toolchain externo requerido
- Cuenta en OpenRouter / OpenAI / Anthropic con API key.
