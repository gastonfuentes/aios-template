# Structured output — extraer JSON desde texto

`generateObject` con un schema Zod fuerza al modelo a devolver JSON valido. Util cuando necesitas datos parseables, no respuesta libre.

## Casos comunes

### Extraer datos de contacto

```ts
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: openrouter('anthropic/claude-haiku-4-5'),
  schema: z.object({
    nombre: z.string(),
    email: z.string().email().optional(),
    telefono: z.string().optional(),
    empresa: z.string().optional(),
  }),
  prompt: `Extrae los datos de contacto de este texto: "${textoLibre}"`,
});

console.log(object); // { nombre: 'Juan', email: 'juan@x.com', ... }
```

### Clasificar intent del usuario

```ts
const { object } = await generateObject({
  model: openrouter('anthropic/claude-haiku-4-5'),
  schema: z.object({
    intent: z.enum(['support', 'sales', 'billing', 'feedback', 'other']),
    urgency: z.enum(['low', 'medium', 'high']),
    summary: z.string().max(200),
  }),
  prompt: `Clasifica este mensaje: "${userMessage}"`,
});

// Routing automatico segun intent
```

### Extraer estructura de un brief

```ts
const briefSchema = z.object({
  titulo: z.string(),
  objetivo: z.string(),
  audiencia: z.array(z.string()),
  features_principales: z.array(z.string()).max(5),
  presupuesto_aprox: z.string().optional(),
});

const { object } = await generateObject({
  model: openrouter('anthropic/claude-sonnet-4-6'),
  schema: briefSchema,
  prompt: `Extrae los componentes del brief de este texto: "${conversacion}"`,
});
```

## Streaming structured output

Para casos donde el output es grande y quieres ir mostrando partes:

```ts
import { streamObject } from 'ai';

const { partialObjectStream } = streamObject({
  model: openrouter('anthropic/claude-sonnet-4-6'),
  schema: z.object({
    sections: z.array(z.object({
      heading: z.string(),
      body: z.string(),
    })),
  }),
  prompt: 'Genera 5 secciones de un blog post sobre IA en español.',
});

for await (const partial of partialObjectStream) {
  console.log(partial); // partial es Type<DeepPartial<typeof schema>>
}
```

## Cuando NO usar structured output

- Respuestas conversacionales — usa `streamText`.
- Outputs muy grandes (>5K tokens) — el JSON inflate hace el cost subir innecesariamente.
- Schemas dinamicos que cambian per-request — el caching no funciona.

## Eleccion de modelo

- Haiku 4.5 es suficiente para extraccion simple (datos de contacto, clasificacion).
- Sonnet 4.6 para schemas complejos con razonamiento (extraer estructura inferida desde texto ambiguo).
