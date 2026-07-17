# Playbook: ai-chatbot

## Targets obligatorios
- **Modelo(s) objetivo**: GPT-4o/5, Claude 4.7, Gemini 2.0 — tradeoff costo/calidad/latencia.
- **Streaming**: Server Actions + `streamText()` de AI SDK v5, Edge vs Node runtime.
- **Costo por conversacion estimado**: tokens in + out × precio modelo × conversaciones/dia.
- **System prompt estrategia**: rol, limites, tono, negativos.
- **Rate limiting**: por usuario (UI) y por org (billing).

## Targets opcionales
- **Tool use**: funciones que el modelo puede invocar (fetch data, run calculation).
- **Memory**: conversacion persistente + resumenes a largo plazo.
- **Guardrails**: moderation (OpenAI Moderation), profanity filter.

## Busquedas sugeridas
- "Vercel AI SDK v5 streaming patterns"
- "OpenRouter cost comparison 2026"
- "LLM chatbot moderation best practices"

## Fuentes primarias
- https://sdk.vercel.ai/docs
- https://openrouter.ai/docs
- https://platform.openai.com/docs/guides/moderation

## Riesgos a investigar activamente
- **Prompt injection**: user text escapa del system prompt. Use structured delimiters + output validation.
- **Hallucinations**: respuestas falsas confiables. Use RAG si hay base de conocimiento.
- **Abuse**: usuarios minando tokens. Rate limit + captcha si es chatbot publico.
