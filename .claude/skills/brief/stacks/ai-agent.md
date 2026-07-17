# Stack Recipe: ai-agent

> **Compatibilidad Praxis**: `MATCH`
> **Plataforma objetivo**: Web + background workers

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4
- Supabase (estado del agente, runs, steps, artefactos)
- Vercel AI SDK v5 (tool-use nativo)
- Zod (schemas de herramientas)
- Zustand

## ADD
- `@ai-sdk/react` (`useChat`, `useObject` para outputs estructurados)
- `@openrouter/ai-sdk-provider` (eleccion de modelo por costo/latencia)
- `@inngest/nextjs` o Trigger.dev (orquestacion de runs largos)
- `bullmq` + Redis si autohosted (colas)
- `playwright` si el agente navega web
- `sandbox-vm` o Vercel Sandbox (si ejecuta codigo)
- Opcional: LangSmith / Langfuse (tracing)

## REPLACE
- Ninguno.

## REMOVE
- Ninguno.

## CONFIG
- Tablas: `agent_runs`, `run_steps`, `tool_calls`, `artifacts`
- RLS: el usuario solo ve sus runs
- Job queue: Inngest functions en `src/inngest/`
- Streaming de progreso con Server-Sent Events o WebSocket
- Variables: `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `OPENROUTER_API_KEY`

## Archivos Praxis a eliminar
- Ninguno.

## Archivos nuevos a crear
- `src/features/agent/tools/*.ts` (cada herramienta con schema Zod)
- `src/features/agent/runner.ts` (loop del agente)
- `src/inngest/functions/runAgent.ts`
- `src/app/api/agent/runs/route.ts`
- `supabase/migrations/**_agent_schema.sql`

## IDE / Toolchain externo requerido
- Inngest CLI (o Trigger.dev)
- OpenRouter / OpenAI API key
