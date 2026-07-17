'use client'

/**
 * Hook adapter MC ↔ daemon AIOS.
 *
 * Reemplaza `useChat` de `@ai-sdk/react` para hablar con el daemon AIOS via su
 * SSE custom (no UI Stream del Vercel AI SDK). Esto preserva agent entera:
 *   - SOUL/USER/HEARTBEAT cargados en el subagente del SDK Claude Code
 *   - 13 skills preloaded (incluye recall PRP-026)
 *   - Memory Tool nativo del SDK (PRP-025)
 *   - Tools reales (Bash, Read, Edit, MCP Supabase/Vercel/Playwright)
 *   - Sesiones cross-superficie con Telegram + CLI
 *
 * El hook produce el shape `{ messages, sendMessage, status, regenerate,
 * interrupt }` con `messages[].parts: MessagePart[]` que los componentes
 * AI Elements consumen directo en Fase 2+.
 *
 * Estado React:
 *   - `messages: Message[]` — lista append-only de la conversación
 *   - `status: 'idle' | 'streaming' | 'error'` — flippea durante el ciclo
 *   - `error: string | null` — propaga errorText del proxy/daemon
 *
 * Reglas: cero `setState` dentro de effects (PRP-003/005/012/020). Los flips
 * de state ocurren dentro de `sendMessage` (handler) consumiendo el
 * `AsyncGenerator` del adapter SSE en un `for-await`. Cleanup del AbortController
 * en un `useEffect` con cleanup function — esto es legítimo (cleanup, no setState).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseSSEStream } from '../api/sse-adapter'
import { deriveSourcePartsFromToolOutput } from '../lib/web-search-output-parser'
import type {
  ChatStatus,
  Message,
  MessagePart,
  SSEEvent,
  ToolPart,
} from '../contracts/messages'

/**
 * PRP-032 Sub-fase 3 — extrae texto legible de un tool_output con isError=true.
 * Anthropic API permite output como string o array de bloques `{type:'text',text}`;
 * normaliza a string truncado para `errorText` del ToolPart visual.
 */
function extractErrorText(output: unknown): string | undefined {
  if (output === null || output === undefined) return undefined
  if (typeof output === 'string') return output.slice(0, 500)
  if (Array.isArray(output)) {
    const txt = output
      .filter((b): b is { type: 'text'; text: string } => {
        const o = b as Record<string, unknown>
        return o?.['type'] === 'text' && typeof o['text'] === 'string'
      })
      .map((b) => b.text)
      .join('\n')
      .trim()
    return txt.length > 0 ? txt.slice(0, 500) : undefined
  }
  try {
    return JSON.stringify(output).slice(0, 500)
  } catch {
    return undefined
  }
}

export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

export type SendOptions = {
  /** ID lógico de la conversación del frontend. El daemon lo mapea a un sessionId SDK. */
  chatSessionId?: string
  /** Effort del SDK Claude Code (default `max` coherente con `agents/marley.md`). */
  effort?: EffortLevel
  /**
   * URL firmado de imagen attached (Supabase Storage `chat-attachments` bucket).
   * El daemon lo recibe en el body, construye un prompt multimodal para el SDK
   * Claude Code, y lo persiste en `chat_messages.metadata.image_url` via
   * always-push receiver.
   */
  imageUrl?: string
  /** URL firmado de audio attached (paralelo a imageUrl). */
  audioUrl?: string
  /**
   * PRP-032 Sub-fase 5 — branching/regenerate. Cuando presente, el daemon trata
   * este turn como rama hermana: NO appendea el user message localmente (el
   * caller ya lo tiene), trata el SDK con fresh-start (sin resume), y propaga
   * `parentMessageId` al always-push receiver para que persista como branch
   * hermana en `chat_messages` (compartiendo parent + branch_index +1).
   */
  branch?: boolean
  /** UUID del USER message que dispara la rama (para branch:true). */
  parentMessageId?: string
}

export type UseagentChatOptions = {
  /** Mensajes iniciales para SSR hydration (PRP-029 Sub-fase 5). */
  initialMessages?: Message[]
  /** chatSessionId inicial (del URL `?session=<uuid>` o equivalente). */
  initialChatSessionId?: string
  /**
   * Callback opcional invocado cuando el hook auto-genera un `chatSessionId`
   * nuevo (primer mensaje de una conversación virgen). El consumer (típicamente
   * `<ChatLayout>` PRP-030) lo usa para refetchear el sidebar de historial y
   * que la nueva sesión aparezca sin esperar al `visibilitychange` listener.
   * Cero llamadas si el hook arrancó con `initialChatSessionId` (sesión ya viva).
   */
  onSessionCreated?: (chatSessionId: string) => void
}

export type UseagentChatReturn = {
  messages: Message[]
  status: ChatStatus
  error: string | null
  chatSessionId: string | undefined
  /** Manda un mensaje del usuario al daemon y consume el stream SSE. */
  sendMessage: (text: string, opts?: SendOptions) => Promise<void>
  /** Aborta el stream activo (si lo hay). */
  interrupt: () => void
  /** Re-ejecuta el último user message. Fase 1: TODO. Fase 5 implementa branching real. */
  regenerate: () => void
  /** Limpia el state local (NO afecta sesión del daemon — usar `/newchat` proxy si se quiere clearing real). */
  reset: () => void
}

const PROXY_URL = '/api/chat/stream'

/**
 * UUID v4 client-side. Usa `crypto.randomUUID()` (disponible en todos los
 * browsers modernos + Node 19+ + Edge). Fallback NO necesario en Mission
 * Control (Safari iOS 15.4+, Chrome 92+ — todos garantizan crypto.randomUUID).
 */
function generateSessionId(): string {
  return crypto.randomUUID()
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Devuelve una copia del array `messages` con el mensaje cuyo `id === messageId`
 * reemplazado por el resultado de `updater(message)`. Si el mensaje no existe,
 * retorna `messages` sin cambios. Patrón inmutable React.
 */
function updateMessage(
  messages: Message[],
  messageId: string,
  updater: (m: Message) => Message,
): Message[] {
  const idx = messages.findIndex((m) => m.id === messageId)
  if (idx === -1) return messages
  const next = messages.slice()
  next[idx] = updater(next[idx]!)
  return next
}

/**
 * Append-or-merge: si la última `parts[]` del mensaje target es del mismo tipo
 * que la nueva (ej. text → text), concatena el text en lugar de pushear un
 * MessagePart nuevo. Esto evita explotar `parts.length` con cada `text_delta`.
 */
function appendOrMergeTextPart(
  parts: MessagePart[],
  delta: string,
): MessagePart[] {
  const last = parts[parts.length - 1]
  if (last && last.type === 'text') {
    const merged: MessagePart = { type: 'text', text: last.text + delta }
    return [...parts.slice(0, -1), merged]
  }
  return [...parts, { type: 'text', text: delta }]
}

/**
 * PRP-032 Sub-fase 2 — append-or-merge específico para reasoning parts.
 * Si la última part del mensaje es ya un `reasoning`, concatena el text.
 * Si no, pushea una part `reasoning` nueva. Patrón canónico paralelo a
 * `appendOrMergeTextPart` para mantener `parts.length` bajo control durante
 * el streaming de thinking_delta (que típicamente llega en 100+ deltas).
 */
function appendOrMergeReasoningPart(
  parts: MessagePart[],
  delta: string,
): MessagePart[] {
  const last = parts[parts.length - 1]
  if (last && last.type === 'reasoning') {
    const merged: MessagePart = { type: 'reasoning', text: last.text + delta }
    return [...parts.slice(0, -1), merged]
  }
  return [...parts, { type: 'reasoning', text: delta }]
}

export function useAgentChat(options: UseagentChatOptions = {}): UseagentChatReturn {
  const [messages, setMessages] = useState<Message[]>(options.initialMessages ?? [])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [chatSessionId, setChatSessionId] = useState<string | undefined>(
    options.initialChatSessionId,
  )

  // Refs para abort + lookups durante el stream sin re-renders.
  const abortRef = useRef<AbortController | null>(null)
  const lastUserTextRef = useRef<string | null>(null)
  const currentAssistantIdRef = useRef<string | null>(null)
  const chatSessionIdRef = useRef<string | undefined>(options.initialChatSessionId)
  const toolPartIndexRef = useRef<Map<string, { messageId: string; partIdx: number }>>(
    new Map(),
  )

  // Ref sincronizado con la prop `onSessionCreated` para evitar stale closure
  // sin tener que listar la prop como dep del `useCallback(sendMessage, [...])`
  // (lo que causaría re-creación del handler en cada render del consumer).
  // La sincronización va dentro de un useEffect — actualizar `.current` en
  // render dispara `react-hooks/refs` (regla canónica Praxis PRP-020). El
  // effect sin deps array corre cada render, manteniendo el ref alineado con
  // la prop más reciente sin penalty.
  const onSessionCreatedRef = useRef<UseagentChatOptions['onSessionCreated']>(
    options.onSessionCreated,
  )
  useEffect(() => {
    onSessionCreatedRef.current = options.onSessionCreated
  })

  // Cleanup: si el componente desmonta mid-stream, aborta el fetch.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const applyEvent = useCallback(
    (event: SSEEvent, assistantId: string) => {
      switch (event.type) {
        case 'init':
          // No mutación visual; el sessionId del SDK queda en el daemon.
          // Si quisiéramos exponerlo en UI (debug), pushearíamos un MessagePart custom.
          return

        case 'text_delta':
          setMessages((prev) =>
            updateMessage(prev, assistantId, (m) => ({
              ...m,
              parts: appendOrMergeTextPart(m.parts, event.text),
            })),
          )
          return

        // PRP-032 Sub-fase 2 — reasoning summarized del SDK Claude Code.
        // Llega ANTES del text_delta del assistant. UI `<Reasoning>` se auto-abre
        // con pulsing animation y colapsa cuando llega el primer text_delta o result.
        case 'thinking_delta':
          setMessages((prev) =>
            updateMessage(prev, assistantId, (m) => ({
              ...m,
              parts: appendOrMergeReasoningPart(m.parts, event.text),
            })),
          )
          return

        case 'tool_start': {
          const newPart: ToolPart = {
            type: 'dynamic-tool',
            toolName: event.toolName,
            toolCallId: event.toolId,
            state: 'input-streaming',
          }
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === assistantId)
            if (idx === -1) return prev
            const target = prev[idx]!
            const partIdx = target.parts.length
            toolPartIndexRef.current.set(event.toolId, { messageId: assistantId, partIdx })
            const next = prev.slice()
            next[idx] = { ...target, parts: [...target.parts, newPart] }
            return next
          })
          return
        }

        // PRP-032 Sub-fase 3 — input del tool parseado del SDK. Llega entre
        // tool_start y tool_done. Flippea el ToolPart a 'input-available' +
        // popula `input`. El <Tool> UI desplega `<ToolInput>` con el JSON.
        case 'tool_input': {
          const lookup = toolPartIndexRef.current.get(event.toolId)
          if (!lookup) return
          setMessages((prev) =>
            updateMessage(prev, lookup.messageId, (m) => {
              const part = m.parts[lookup.partIdx]
              if (!part || part.type !== 'dynamic-tool') return m
              const updated: ToolPart = {
                ...part,
                state: 'input-available',
                input: event.input,
              }
              const nextParts = m.parts.slice()
              nextParts[lookup.partIdx] = updated
              return { ...m, parts: nextParts }
            }),
          )
          return
        }

        // PRP-032 Sub-fase 3 — output del tool_result del SDK. Llega ANTES o
        // CON el tool_done. Flippea a 'output-available' o 'output-error' si
        // `isError`. PRP-032 Sub-fase 4 deriva source-url parts cuando toolName
        // ∈ {WebSearch, WebFetch, mcp__*_search} via parser puro.
        case 'tool_output': {
          const lookup = toolPartIndexRef.current.get(event.toolId)
          if (!lookup) return
          setMessages((prev) =>
            updateMessage(prev, lookup.messageId, (m) => {
              const part = m.parts[lookup.partIdx]
              if (!part || part.type !== 'dynamic-tool') return m
              const updated: ToolPart = {
                ...part,
                state: event.isError ? 'output-error' : 'output-available',
                output: event.output,
                ...(event.isError ? { errorText: extractErrorText(event.output) } : {}),
              }
              const nextParts = m.parts.slice()
              nextParts[lookup.partIdx] = updated

              // PRP-032 Sub-fase 4 — derivar source-url parts del WebSearch/WebFetch.
              // Si el tool emite shape de URLs, pushear parts adicionales al final
              // del mensaje (después del Tool part) para que <Sources> las filtre.
              const newSourceParts = deriveSourcePartsFromToolOutput(
                part.toolName,
                event.output,
              )
              const finalParts = newSourceParts.length > 0
                ? [...nextParts, ...newSourceParts]
                : nextParts
              return { ...m, parts: finalParts }
            }),
          )
          return
        }

        case 'tool_done': {
          const lookup = toolPartIndexRef.current.get(event.toolId)
          if (!lookup) return
          setMessages((prev) =>
            updateMessage(prev, lookup.messageId, (m) => {
              const part = m.parts[lookup.partIdx]
              if (!part || part.type !== 'dynamic-tool') return m
              // tool_done sin tool_output previo (caso edge: tool falló silente
              // o el evento user con tool_result no llegó) → flippear a
              // output-available como fallback defensivo.
              if (part.state === 'output-available' || part.state === 'output-error') {
                return m
              }
              const updated: ToolPart = {
                ...part,
                state: 'output-available',
              }
              const nextParts = m.parts.slice()
              nextParts[lookup.partIdx] = updated
              return { ...m, parts: nextParts }
            }),
          )
          return
        }

        case 'result':
          // El daemon postea el texto final. Si nuestro merge incremental ya cubrió
          // todo el texto via text_delta, esto sería redundante. Si no recibimos
          // text_delta (modos no-stream), el `result.text` se vuelve el contenido
          // canónico. Patrón defensivo: si la última text part está vacía o el
          // mensaje no tiene partes text, reemplazar/sumar con result.text.
          setMessages((prev) =>
            updateMessage(prev, assistantId, (m) => {
              const hasText = m.parts.some((p) => p.type === 'text' && p.text.length > 0)
              if (hasText) return m
              return {
                ...m,
                parts: [...m.parts.filter((p) => p.type !== 'text'), {
                  type: 'text',
                  text: event.text,
                }],
              }
            }),
          )
          return

        case 'error':
          setError(event.message)
          return

        case 'interrupt':
          // El daemon confirma abort — ya estamos manejando el estado en el handler.
          return

        case 'compact':
        case 'usage':
        case 'model_changed':
          // No-op visual en Fase 1. Fase 4+ los puede surface al toolbar / status bar.
          return

        default: {
          // Exhaustive check. TypeScript narrowing garantiza que esto es inalcanzable
          // mientras el SSEEventSchema cubra todos los `type` literales.
          const _exhaustive: never = event
          void _exhaustive
        }
      }
    },
    [],
  )

  const consumeStream = useCallback(
    async (
      body: ReadableStream<Uint8Array>,
      assistantId: string,
      signal: AbortSignal,
    ) => {
      try {
        for await (const event of parseSSEStream(body)) {
          if (signal.aborted) break
          applyEvent(event, assistantId)
        }
      } catch (err) {
        if (signal.aborted) return // abort consumer-driven, no es error
        const msg = err instanceof Error ? err.message : String(err)
        setError(`stream error: ${msg}`)
      }
    },
    [applyEvent],
  )

  const sendMessage = useCallback(
    async (text: string, opts: SendOptions = {}) => {
      // Cancel previous stream if alive (último gana, espejando el patrón del daemon).
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      toolPartIndexRef.current.clear()

      const userId = randomId()
      const assistantId = randomId()
      currentAssistantIdRef.current = assistantId
      lastUserTextRef.current = text

      // chatSessionId resolution:
      //   1) opts.chatSessionId si vino explícito (raro; el flujo canónico
      //      sería que ChatPage no lo pase opcionalmente).
      //   2) chatSessionIdRef.current si ya existe (vino de initialChatSessionId
      //      o se generó en un sendMessage previo).
      //   3) genera nuevo UUID v4 y se persiste al ref + state + URL searchParam.
      let sessionId = opts.chatSessionId ?? chatSessionIdRef.current
      const isNewSession = !sessionId
      if (!sessionId) {
        sessionId = generateSessionId()
        chatSessionIdRef.current = sessionId
        setChatSessionId(sessionId)
        // PRP-031 Sub-fase 7 bug-fix #3: NO disparar router.replace aquí.
        // router.replace cambia los searchParams del Server Component → re-render
        // → cambia `initialChatSessionId` prop → cambia `key` del ChatPage en
        // ChatLayout → re-mount → useEffect cleanup aborta el AbortController
        // → stream del primer mensaje se cancela. El defer al `finally` de
        // sendMessage evita el race condition.
        // PRP-030: avisar al consumer (ChatLayout) que apareció una sesión
        // nueva → refetch del sidebar de historial. Ref sincronizado para evitar
        // stale closure y no inflar deps del useCallback.
        try {
          onSessionCreatedRef.current?.(sessionId)
        } catch {
          /* callback usuario, fail-soft */
        }
      }
      void isNewSession // silenciar warning del compilador; valor reservado para futuras telemetrías.

      setError(null)
      setStatus('streaming')

      // PRP-032 Sub-fase 5 — branching: NO appendear user message (ya está en
      // state del regenerate anterior); solo pushear el assistant nuevo que
      // tendrá parentMessageId apuntando al user message original.
      if (opts.branch && opts.parentMessageId) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            parts: [],
            createdAt: nowIso(),
            parentMessageId: opts.parentMessageId,
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          { id: userId, role: 'user', parts: [{ type: 'text', text }], createdAt: nowIso() },
          { id: assistantId, role: 'assistant', parts: [], createdAt: nowIso() },
        ])
      }

      try {
        const res = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            chatSessionId: sessionId,
            ...(opts.effort && { effort: opts.effort }),
            ...(opts.imageUrl && { imageUrl: opts.imageUrl }),
            ...(opts.audioUrl && { audioUrl: opts.audioUrl }),
            // PRP-032 Sub-fase 5 — branching flags propagados al daemon. El
            // daemon hace fresh-start del SDK (sin resume) + propaga
            // parentMessageId al always-push receiver.
            ...(opts.branch && opts.parentMessageId
              ? { branch: true, parentMessageId: opts.parentMessageId }
              : {}),
          }),
          signal: ac.signal,
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`)
          setError(`proxy error ${res.status}: ${errText.slice(0, 200)}`)
          setStatus('error')
          return
        }

        if (!res.body) {
          setError('proxy returned empty body')
          setStatus('error')
          return
        }

        await consumeStream(res.body, assistantId, ac.signal)
        if (ac.signal.aborted) {
          // No flippeamos a 'error' — abort es intencional.
        }
        setStatus('idle')
      } catch (err) {
        if (ac.signal.aborted) {
          setStatus('idle')
          return
        }
        const msg = err instanceof Error ? err.message : String(err)
        setError(`fetch error: ${msg}`)
        setStatus('error')
      } finally {
        // PRP-031 Sub-fase 7 bug-fix #3 v2: sincronizar URL con el sessionId
        // recién generado vía `window.history.replaceState` (NO router.replace).
        //
        // `router.replace` de Next dispara re-render del Server Component
        // → cambia `initialChatSessionId` prop → cambia `key` del ChatPage en
        // ChatLayout → re-mount → state local (messages) se pierde antes de
        // que el always-push haya escrito a Supabase. Resultado visible: el
        // operador envía mensaje, lo ve aparecer streaming, y desaparece al
        // terminar (re-mount con initialMessages = []).
        //
        // `window.history.replaceState` cambia la URL del browser SIN avisar
        // a Next → cero re-render del Server Component → cero re-mount.
        // El URL queda actualizado para que el refresh preserve session
        // y para que el sidebar de historial enlace correctamente.
        //
        // Solo sincronizar si fue una sesión nueva.
        if (isNewSession && sessionId && typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, '', `/ai-agent?session=${sessionId}`)
          } catch {
            /* edge case sin window.history — no-op */
          }
        }
      }
    },
    [consumeStream],
  )

  const interrupt = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')

    // Fire-and-forget hint al daemon (espejando UX de Telegram bot). El proxy
    // route /api/chat/interrupt cae en Fase 4+. Si todavía no existe, este
    // fetch retorna 404 silente — el AbortController ya hizo el trabajo.
    void fetch('/api/chat/interrupt', { method: 'POST' }).catch(() => {
      /* proxy aún no creado en Fase 1 — no-op */
    })
  }, [])

  /**
   * PRP-032 Sub-fase 5 — branching/regenerate real.
   *
   * Identifica el último USER message del state local (el padre de las
   * branches) + el último ASSISTANT message (la rama previa). Llama
   * `sendMessage(lastUserText, { branch: true, parentMessageId: lastUserId })`
   * que el daemon trata como fresh-start del SDK (sin resume) y propaga
   * `parentMessageId` al always-push receiver, persistiendo el nuevo assistant
   * como rama hermana en `chat_messages` con `branch_index = max(existing) + 1`.
   *
   * El render del ChatPage agrupa assistant messages con mismo `parentMessageId`
   * en un `<MessageBranch>` con `← N/M →` selector.
   *
   * Trade-off documentado: fresh-start pierde context multi-turn del SDK para
   * esta rama específica. Aceptable porque regenerate es local al último turn
   * del operador (no requiere recordar la conversación previa).
   */
  const regenerate = useCallback(() => {
    if (status === 'streaming') return
    // Buscar el último user message + el último assistant message del state.
    let lastUserMsg: { id: string; text: string } | null = null
    let lastAssistantMsg: { id: string } | null = null
    setMessages((prev) => {
      for (let i = prev.length - 1; i >= 0; i -= 1) {
        const m = prev[i]!
        if (!lastAssistantMsg && m.role === 'assistant') {
          lastAssistantMsg = { id: m.id }
        }
        if (!lastUserMsg && m.role === 'user') {
          const txt = m.parts
            .filter((p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text')
            .map((p) => p.text)
            .join('')
          lastUserMsg = { id: m.id, text: txt }
          break
        }
      }
      return prev
    })
    if (!lastUserMsg || !lastAssistantMsg) return
    const userMsg = lastUserMsg as { id: string; text: string }
    if (!userMsg.text.trim()) return
    void sendMessage(userMsg.text, {
      branch: true,
      parentMessageId: userMsg.id,
    })
  }, [sendMessage, status])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    toolPartIndexRef.current.clear()
    currentAssistantIdRef.current = null
    lastUserTextRef.current = null
    chatSessionIdRef.current = undefined
    setChatSessionId(undefined)
    setMessages([])
    setStatus('idle')
    setError(null)
  }, [])

  return {
    messages,
    status,
    error,
    chatSessionId,
    sendMessage,
    interrupt,
    regenerate,
    reset,
  }
}
