# Playbook: ai-agent

## Targets obligatorios
- **Agent loop pattern**: plan → act → observe → reflect (ReAct, Plan-and-Execute, Reflexion).
- **Tool use con Vercel AI SDK v5**: schema Zod por tool, error handling, parallel tool calls.
- **Duracion de runs**: jobs sincronos (Vercel function timeout 60s Hobby / 300s Pro) vs jobs async (Inngest, Trigger.dev, Vercel Cron).
- **Modelos**: costo/latencia/quality tradeoff por tipo de paso (planning vs execution).
- **Observabilidad**: Langfuse, LangSmith, o logs propios con step-by-step traces.

## Targets opcionales
- **Memory long-term**: vector DB (pgvector) para "recordar" runs previos.
- **Human-in-the-loop**: pausar el agente y esperar aprobacion humana.
- **Multi-agent orchestration**: CrewAI, LangGraph.

## Busquedas sugeridas
- "AI SDK v5 tool use patterns"
- "ReAct vs Plan-and-Execute agent loop"
- "Inngest vs Trigger.dev 2026"
- "LLM agent observability Langfuse"

## Fuentes primarias
- https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling
- https://inngest.com/docs
- https://langfuse.com/docs

## Riesgos a investigar activamente
- **Runaway cost**: agente en loop infinito. Implementar max_steps + budget per run.
- **Tool failures**: que pasa si una tool tira error — retry con backoff + fallback.
- **State corruption** entre steps si hay concurrencia — idempotency keys.
