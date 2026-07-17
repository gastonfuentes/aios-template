# Agente con memoria persistente del alumno

Caso canonico Praxis: el agente conoce al usuario por su perfil + recuerda conversaciones pasadas.

## Migracion completa

```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tokens_input integer,
  tokens_output integer,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "convs_self" on public.conversations for all using (auth.uid() = user_id);
create policy "msgs_via_conv" on public.messages
  for all using (
    exists(select 1 from public.conversations where id = messages.conversation_id and user_id = auth.uid())
  );

create index conversations_user_idx on public.conversations(user_id, created_at desc);
create index messages_conv_idx on public.messages(conversation_id, created_at);
```

## Route handler con persistencia

```ts
// src/app/api/chat/[conversationId]/route.ts
import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createClient } from '@/lib/supabase/server';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

export async function POST(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  // Cargar perfil para contexto
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  // Cargar mensajes previos de la conversacion
  const { data: prevMessages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  const { messages: newMessages } = await req.json();
  const allMessages = [...(prevMessages ?? []), ...newMessages];

  // Persistir el mensaje del user antes de generar respuesta
  const userMsg = newMessages[newMessages.length - 1];
  if (userMsg?.role === 'user') {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userMsg.content,
    });
  }

  const result = streamText({
    model: openrouter('anthropic/claude-sonnet-4-6'),
    system: buildSystemPrompt(profile),
    messages: allMessages,
    onFinish: async ({ text, usage }) => {
      // Persistir respuesta del modelo
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: text,
        tokens_input: usage.inputTokens,
        tokens_output: usage.outputTokens,
      });
      // Actualizar timestamp de la conversacion
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    },
  });

  return result.toUIMessageStreamResponse();
}

function buildSystemPrompt(profile: { full_name?: string; role?: string } | null): string {
  if (!profile) return 'Eres un asistente amable que habla en espanol.';

  return `
    Eres un asistente amable que habla en espanol.
    Estas hablando con ${profile.full_name ?? 'un usuario'}.
    Su rol es: ${profile.role ?? 'student'}.
    ${profile.role === 'creator' ? 'Adapta tu tono a alguien que crea contenido.' : 'Adapta tu tono a alguien que aprende.'}
    Si saluda, responde con su nombre.
  `.trim();
}
```

## Sidebar de conversaciones

```tsx
// src/app/(app)/chat/sidebar.tsx
import { createClient } from '@/lib/supabase/server';

export async function ChatSidebar() {
  const supabase = await createClient();
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);

  return (
    <aside className="w-64 border-r p-4">
      <button className="w-full rounded-lg bg-praxis-gradient py-2 text-white">
        Nueva conversacion
      </button>
      <ul className="mt-4 space-y-1">
        {convs?.map((c) => (
          <li key={c.id}>
            <Link href={`/chat/${c.id}`} className="block rounded p-2 hover:bg-zinc-100">
              {c.title ?? 'Sin titulo'}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

## Generar titulo automatico

Despues de los 2-3 primeros mensajes, generar un titulo corto via `generateText`:

```ts
import { generateText } from 'ai';

const { text: title } = await generateText({
  model: openrouter('anthropic/claude-haiku-4-5'),
  prompt: `Genera un titulo de maximo 6 palabras para esta conversacion: ${firstMessages.join('\n')}`,
});

await supabase.from('conversations').update({ title: title.trim() }).eq('id', conversationId);
```

Use Haiku (no Sonnet) — la tarea es trivial y barata.

## Limites operativos

- Cap de mensajes por conversacion: ~50. Mas alla, context window se llena. Implementar "compactacion": Haiku resume los primeros 30 mensajes en 1-2 parrafos, los reemplaza en el array.
- Cap de conversaciones por user: ~200. Auto-archivar las inactivas >90 dias en una tabla `conversations_archive`.
- Costo per user: trackear `tokens_input + tokens_output` y mostrar al alumno en su settings ("usaste $0.42 este mes").
