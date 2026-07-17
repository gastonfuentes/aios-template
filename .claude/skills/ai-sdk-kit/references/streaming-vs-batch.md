# Streaming vs batch — cuando elegir cada uno

## streamText (default conversacional)

Devuelve tokens en tiempo real al cliente. UX: el alumno ve la respuesta aparecer palabra por palabra.

Usar cuando:

- Chatbot interactivo.
- Tool calling con respuesta progresiva.
- Cualquier cosa donde el usuario espera al UI.

```ts
const result = streamText({ model, messages });
return result.toUIMessageStreamResponse();
```

Requiere endpoint que soporte streaming (route handlers de Next.js si por default). Si tu hosting no permite streams (algunos serverless legacy), fallback a `generateText`.

## generateText (batch)

Devuelve la respuesta completa en una sola promise. UX: spinner mientras genera, luego muestra todo.

Usar cuando:

- Tareas en background (sin UI esperando).
- Procesamiento batch (ej. 1000 documentos a clasificar).
- Logica server-side donde el resultado se guarda en BD antes de mostrarse.

```ts
const { text } = await generateText({
  model,
  prompt: 'Genera resumen de...',
});

await supabase.from('summaries').insert({ content: text });
```

## generateObject / streamObject

Para JSON estructurado. La eleccion stream vs batch sigue la misma logica:

- `streamObject` cuando el cliente puede usar partes mientras se genera (ej. UI que va llenando un formulario).
- `generateObject` cuando solo necesitas el objeto completo.

## Performance trade-offs

| Metric | Stream | Batch |
|---|---|---|
| Time to first token | ~500ms | N/A |
| Time to complete | igual | igual |
| Server cost | igual | igual |
| Client perception | rapido | lento si > 3s total |
| Implementacion | mas complejo | simple |

Default Praxis: stream para conversational, batch para background.

## Manejo de errores

Stream:

```ts
const result = streamText({ /* ... */ });

result.toDataStreamResponse({
  onError: (error) => {
    console.error('stream error:', error);
    return 'Error generando respuesta. Vuelve a intentar.';
  },
});
```

Batch:

```ts
try {
  const { text } = await generateText({ /* ... */ });
} catch (error) {
  if (error instanceof Error && error.message.includes('rate_limit')) {
    // Retry con backoff
  }
  throw error;
}
```
