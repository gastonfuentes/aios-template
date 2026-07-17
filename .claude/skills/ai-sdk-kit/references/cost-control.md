# Cost control — no quemes credito

## Eleccion adaptativa de modelo

No usar Sonnet/GPT-4 para cosas que Haiku resuelve. Patron canonico:

```ts
function pickModel(taskComplexity: 'simple' | 'medium' | 'complex') {
  switch (taskComplexity) {
    case 'simple': return openrouter('anthropic/claude-haiku-4-5');
    case 'medium': return openrouter('anthropic/claude-haiku-4-5');
    case 'complex': return openrouter('anthropic/claude-sonnet-4-6');
  }
}
```

Detectar complejidad heuristicamente:

- Mensaje > 500 tokens o multi-step → complex.
- Mensaje conversacional simple → simple.
- Tarea de extraccion estructurada → simple-medium.

## Caching

Anthropic prompt caching reduce costo del input cacheable a ~10% del precio normal. AI SDK lo expone:

```ts
const result = streamText({
  model: openrouter('anthropic/claude-sonnet-4-6'),
  system: largeSystemPrompt, // cacheado automatico si > 1024 tokens
  messages,
  providerOptions: {
    anthropic: {
      cacheControl: { type: 'ephemeral' }, // 5min TTL
    },
  },
});
```

Use cuando system prompt + tools + context es grande y se reusa entre requests del mismo user.

## Limit por user

Tabla de tracking:

```sql
create table public.ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  tokens_input bigint not null default 0,
  tokens_output bigint not null default 0,
  cost_cents integer not null default 0,
  primary key (user_id, date)
);
```

Middleware antes de procesar request:

```ts
const today = new Date().toISOString().split('T')[0];
const { data: usage } = await supabase
  .from('ai_usage')
  .select('cost_cents')
  .eq('user_id', user.id)
  .eq('date', today)
  .maybeSingle();

const dailyCap = 100; // $1.00 USD por user por dia
if (usage && usage.cost_cents > dailyCap) {
  return Response.json({ error: 'daily limit reached' }, { status: 429 });
}
```

Despues del response, actualizar:

```ts
onFinish: async ({ usage, providerMetadata }) => {
  const cost = calculateCost(usage, modelName);
  await supabase.rpc('increment_ai_usage', {
    p_user_id: user.id,
    p_tokens_in: usage.inputTokens,
    p_tokens_out: usage.outputTokens,
    p_cost_cents: Math.round(cost * 100),
  });
},
```

## Mostrar uso al user

```tsx
// En settings
<div>
  <p className="text-sm">Uso de IA este mes</p>
  <p className="text-2xl font-bold">${usage.cost_dollars}</p>
  <p className="text-xs text-zinc-500">
    {usage.tokens_total.toLocaleString()} tokens
  </p>
</div>
```

Transparencia previene "donde se fueron mis creditos" en soporte.

## Stop runaway loops

Si tu app tiene tools que pueden disparar tools (recursivo), agregar:

```ts
const result = streamText({
  /* ... */
  maxSteps: 5, // hard cap on tool call iterations
});
```

Sin esto, un modelo confundido puede entrar en loop tool→tool→tool y agotar tokens.
