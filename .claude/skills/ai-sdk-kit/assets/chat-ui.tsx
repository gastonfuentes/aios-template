'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';

interface ChatUIProps {
  conversationId?: string;
  apiEndpoint?: string;
}

export function ChatUI({ conversationId, apiEndpoint = '/api/chat' }: ChatUIProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: conversationId ? `${apiEndpoint}/${conversationId}` : apiEndpoint,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <p>Empieza la conversacion escribiendo abajo</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-[#0a84ff] to-[#00d9ff] text-white'
                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
            </div>
          ))
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Escribe tu mensaje..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none focus:ring-2 focus:ring-[#00d9ff]/20 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-gradient-to-r from-[#0a84ff] to-[#00d9ff] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isLoading ? '...' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}
