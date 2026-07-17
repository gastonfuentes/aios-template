'use client'

/**
 * ChatPage productivo (PRP-029 → PRP-031 Fase 4 brief master chat-mission-control).
 *
 * Compone AI Elements sobre `useAgentChat` con bottom row "Claude Code style":
 *
 *   - `<Conversation>` + `<ConversationContent>` con StickToBottom (PRP-029).
 *   - `<Message>` + `<MessageContent>` por turno con `<MessageResponse>` markdown (PRP-029).
 *   - `<ConversationEmptyState>` minimal (PRP-029).
 *   - `<PromptInput globalDrop accept multiple maxFileSize>` (PRP-031):
 *       - `<PromptInputAttachments>` arriba del textarea (chips imagen/file).
 *       - `<PromptInputBody>` con textarea autosize + mic button inline derecha.
 *       - Bottom row personalizado byte-exacto al input Claude Code:
 *           [+ action menu] [/ slash decorativo] [<EffortSelect>]  ←left
 *                                                                 right→
 *           [<ModelSelect>] [<MicButton>] [<PromptInputSubmit>]
 *
 * Mid-stream queue + auto-interrupt-on-submit (PRP-031): typing durante stream
 * cambia placeholder a "Queue another message..." y el submit dispara
 * interrupt + sendMessage instant.
 *
 * PRP-032 Sub-fases 1-4 productivo:
 *   - Streaming suave vía `animated` prop nativa Streamdown (blurIn por palabra
 *     120ms cubic-bezier macOS).
 *   - Reasoning real summarized (daemon cableado con
 *     `thinking: { type: 'adaptive', display: 'summarized' }`).
 *   - Tool viz con input/output reales en 4 estados visuales.
 *   - Sources component derivado client-side del tool_output WebSearch/WebFetch.
 */

import { useCallback, useMemo, useState } from 'react'
import { cn } from '@/core/lib/utils'
import { Bot, Brain, Copy, FileText, Mic, MicOff, Plus, RotateCcw, Square } from 'lucide-react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  MessageBranch,
  MessageBranchContent,
  MessageBranchSelector,
  MessageBranchPrevious,
  MessageBranchPage,
  MessageBranchNext,
} from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
// PRP-032 iter post-cierre — NO usamos <Shimmer> de AI Elements porque su
// implementación usa `linear-gradient(var(--color-muted-foreground), ...)` con
// prefix `--color-X` (sintaxis Tailwind v4 que MC no tiene en v3.4) → texto
// invisible. Reemplazado por `<ThinkingIndicator />` custom abajo que usa
// tokens DS macOS 26 (`--label-secondary`, `--label-tertiary`).

/**
 * Indicador "Thinking..." que se muestra inmediatamente después del submit y
 * antes del primer delta del SDK. Cubre los 3-8s de warmup típicos.
 *
 * Composición visual:
 *   - Texto "Thinking" con shimmer gradient horizontal (efecto Apple, mismo
 *     pattern canónico que `.text-brand-aios` del BrandHeader PRP-021).
 *   - 3 puntos pulsantes staggered al estilo ChatGPT/Claude.ai web.
 *
 * CSS keyframes en globals.css (`aios-thinking-shimmer` + `aios-thinking-dot`).
 * `prefers-reduced-motion: reduce` global lo neutraliza automáticamente.
 */
function ThinkingIndicator() {
  return (
    <p className="aios-thinking-shimmer" aria-live="polite">
      <span>Thinking</span>
      <span className="aios-thinking-dot">.</span>
      <span className="aios-thinking-dot">.</span>
      <span className="aios-thinking-dot">.</span>
    </p>
  )
}
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import {
  Sources,
  SourcesContent,
  SourcesTrigger,
  Source,
} from '@/components/ai-elements/sources'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
  PromptInputButton,
  usePromptInputAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
} from '@/components/ai-elements/attachments'
import { TooltipProvider } from '@/core/ui/tooltip'
import { useAgentChat, type EffortLevel } from '../hooks/useAgentChat'
import { useModelSelector } from '../hooks/useModelSelector'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { uploadAttachment } from '../api/attachments'
import type {
  Message as ChatMessage,
  MessagePart,
} from '../contracts/messages'
import { ChatEmptyState } from './ChatEmptyState'

/**
 * Effort options con terminología Anthropic canónica (SDK Claude Code 0.2.128
 * + Anthropic Console). El parameter `effort` del SDK acepta los valores
 * `low / medium / high / max`; los labels y descripciones reflejan el
 * vocabulario "thinking" que Anthropic usa en su API + Console UI.
 */
const EFFORT_OPTIONS: { value: EffortLevel; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Minimal thinking' },
  { value: 'medium', label: 'Medium', description: 'Balanced thinking' },
  { value: 'high', label: 'High', description: 'Extended thinking' },
  { value: 'max', label: 'Max', description: 'Maximum thinking' },
]

/**
 * Filtra modelos duplicados / aliased (operador feedback iter4): "Default
 * (recommended)" del daemon apunta a Opus 4.7 con 1M context, pero el daemon
 * también expone "Opus 4.7" raw como entry separada. Mostrar ambos confunde.
 * Filtramos el `'default'` para que solo aparezca el explícito por nombre.
 */
function filterDuplicateModels<T extends { value: string }>(models: T[]): T[] {
  return models.filter((m) => m.value !== 'default')
}

type ChatPageProps = {
  initialMessages?: ChatMessage[]
  initialChatSessionId?: string
  /**
   * Callback opcional invocado cuando `useAgentChat` auto-genera un
   * `chatSessionId` nuevo (primer envío sin session previa). Pasado al hook
   * directamente. Usado por `<ChatLayout>` (PRP-030) para refetchear el sidebar.
   */
  onSessionCreated?: (chatSessionId: string) => void
}

/**
 * Extrae el texto concatenado de las parts `text` de un Message. Ignora
 * reasoning / dynamic-tool / source-url / attachments (todos renderizados
 * aparte por componentes dedicados — Reasoning / Tool / Sources / chips).
 */
function textOfParts(parts: MessagePart[]): string {
  return parts
    .filter((p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

/**
 * PRP-032 Sub-fase 2 — extrae el texto concatenado de las parts `reasoning`
 * de un Message. El daemon emite `thinking_delta` que el adapter mappea a
 * `parts: [{type: 'reasoning', text}, ...]` con append-or-merge.
 */
function reasoningOfParts(parts: MessagePart[]): string {
  return parts
    .filter((p): p is Extract<MessagePart, { type: 'reasoning' }> => p.type === 'reasoning')
    .map((p) => p.text)
    .join('')
}

/**
 * PRP-032 Sub-fase 3 — filtra los parts de tool del message en orden de
 * aparición (cada uno se renderea con `<Tool>` colapsable).
 */
function toolPartsOfParts(parts: MessagePart[]) {
  return parts.filter(
    (p): p is Extract<MessagePart, { type: 'dynamic-tool' }> => p.type === 'dynamic-tool',
  )
}

/**
 * PRP-032 Sub-fase 4 — filtra las parts source-url del message (derivadas
 * del tool_output de WebSearch / WebFetch / MCP search por el adapter).
 */
function sourcePartsOfParts(parts: MessagePart[]) {
  return parts.filter(
    (p): p is Extract<MessagePart, { type: 'source-url' }> => p.type === 'source-url',
  )
}

/** Filtra parts attachment del message para render como chips visuales. */
function attachmentsOfParts(parts: MessagePart[]) {
  return parts.filter(
    (p): p is Extract<MessagePart, { type: 'image-url' | 'audio-url' }> =>
      p.type === 'image-url' || p.type === 'audio-url',
  )
}

export function ChatPage({
  initialMessages,
  initialChatSessionId,
  onSessionCreated,
}: ChatPageProps) {
  const {
    messages,
    status,
    error,
    chatSessionId,
    sendMessage,
    interrupt,
    regenerate,
  } = useAgentChat({ initialMessages, initialChatSessionId, onSessionCreated })

  const [input, setInput] = useState('')
  const [effort, setEffort] = useState<EffortLevel>('max')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { models, selectedModel, setSelectedModel } = useModelSelector()

  // ─── Voice recorder ─────────────────────────────────────────────────────
  const voice = useVoiceRecorder({
    onTranscribed: (text) => {
      setInput((prev) => (prev.trim() ? `${prev} ${text}` : text))
    },
    onError: (msg) => setUploadError(msg),
  })

  // ─── Submit handler con upload + mid-stream queue + auto-interrupt ──────
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const text = message.text.trim()
      const filesArr = message.files ?? []
      if (!text && filesArr.length === 0) return

      // Mid-stream queue (PRP-031): si hay stream activo, interrumpir y mandar
      // el nuevo turn inmediato (Claude Code style — Ctrl+C + Enter).
      if (status === 'streaming') {
        interrupt()
        // Pequeño delay para que el AbortController propague antes del nuevo POST.
        await new Promise((r) => setTimeout(r, 80))
      }

      // Limpiar input UX-first (PRP-029 polish — el operador ve clear inmediato).
      setInput('')
      setUploadError(null)

      // Subir attachments (Fase 4: 1 image OR 1 audio; multi-file post-Fase 5).
      // Si hay múltiples files con misma categoría, solo el primero pasa; el resto
      // queda visible como chip pero no se sube. Esto evita reescritura del schema
      // del daemon para arrays. Refactor multi-file → PRP propio si el operador lo pide.
      let imageUrl: string | undefined
      let audioUrl: string | undefined
      const sessionForUpload = chatSessionId ?? crypto.randomUUID()

      for (const f of filesArr) {
        const url = f.url
        const mediaType = f.mediaType ?? ''
        if (!url || !url.startsWith('blob:')) continue
        try {
          // Reconstruir File del blob URL.
          const blob = await fetch(url).then((r) => r.blob())
          const file = new File([blob], f.filename ?? 'attachment', { type: mediaType })
          const result = await uploadAttachment(file, sessionForUpload)
          if (result.mediaCategory === 'image' && !imageUrl) {
            imageUrl = result.signedUrl
          } else if (result.mediaCategory === 'audio' && !audioUrl) {
            audioUrl = result.signedUrl
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          setUploadError(msg)
          return
        }
      }

      void sendMessage(text || '[Adjunto]', {
        effort,
        imageUrl,
        audioUrl,
      })
    },
    [sendMessage, status, interrupt, chatSessionId, effort],
  )

  // ─── Mic button handler ────────────────────────────────────────────────
  const handleMicClick = useCallback(() => {
    if (voice.isRecording) {
      void voice.stop()
    } else {
      void voice.start()
    }
  }, [voice])

  const isEmpty = messages.length === 0
  const isStreaming = status === 'streaming'
  const placeholderText = isStreaming ? 'Queue another message...' : ''

  // PRP-032 Sub-fase 1 — streaming suave de tokens: el último assistant message
  // se renderea con `animated` reveal (blurIn por palabra 120ms cubic-bezier
  // macOS); mensajes históricos quedan estáticos para evitar re-animar al cargar
  // sesión vía ?session=<uuid>. La curva se reusa para reasoning (Sub-fase 2) —
  // un solo "lenguaje de aparición" en todo el chat. `prefers-reduced-motion`
  // global neutraliza automáticamente (override en globals.css).
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]!.role === 'assistant') return i
    }
    return -1
  })()
  const lastAssistantId = lastAssistantIdx >= 0 ? messages[lastAssistantIdx]!.id : null
  // PRP-032 iter v6 — animación char-by-char fix bug "extraño" del operador.
  //
  // Bug raíz v5 descubierto investigando reporte operador "animación se ve
  // extraña": `animation-fill-mode: forwards` NO aplica state initial durante
  // delay (chars con stagger ven default natural visible) → cuando empieza la
  // animación blur:4px→0, el char hace VISIBLE → BLUR → VISIBLE producing
  // popping unnatural. Fix raíz globals.css: `fill-mode: both` aplica state
  // initial durante delay (chars invisibles hasta su turno → reveal smooth).
  //
  // Config v6 ajustada para compensar el delay aumentado de `both`:
  //   - stagger 12 → 8ms (chars termina cascada más rápido, último char
  //     visible antes)
  //   - duration 280 → 220ms (animation per-char más corta, libera GPU antes)
  //   - blur 4px preservado (suficientemente sutil)
  //   - easing easeOutExpo macOS preservado
  //
  // Resultado: chunk típico 80 chars termina en 80*8 + 220 = 860ms ≈ 1s
  // (vs v5: 80*12 + 280 = 1240ms). Smooth + sin popping + sin lag.
  const streamAnimateOptions = {
    animation: 'blurIn' as const,
    duration: 220,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    sep: 'char' as const,
    stagger: 8,
  }

  // PRP-032 iter v6 — listener JS ELIMINADO.
  //
  // v5 usaba `animationstart`/`animationend` delegado para gestionar will-change
  // dinámico. Problema descubierto: `animationstart` se dispara DESPUÉS del
  // `animation-delay`. Para chars con delay 600ms+, durante esos 600ms el char
  // NO tenía will-change → render CPU no GPU → lag.
  //
  // Approach v6 más simple y robusto: `will-change: opacity, filter` declarativo
  // en `[data-sd-animate]` (globals.css). La regla `:not(:last-child)
  // [data-sd-animate]` con `will-change: auto !important` lo limpia para
  // paragraphs settled. Resultado: solo chars del último paragraph mantienen
  // will-change, cero overhead en paragraphs previos. Sin overhead del listener
  // delegado + sin layout thrash del style.willChange dinámico.

  // PRP-032 Sub-fase 5 — agrupar assistant messages consecutivos en branches.
  // Convención: dos+ assistant messages CONSECUTIVOS (sin user entre ellos) son
  // ramas hermanas del mismo user message previo (regenerate). Render con
  // `<MessageBranch>` selector. Un solo assistant → render directo sin wrapper.
  type RenderGroup =
    | { type: 'user'; msg: ChatMessage }
    | { type: 'assistant'; branches: ChatMessage[] }
  const renderGroups: RenderGroup[] = useMemo(() => {
    const groups: RenderGroup[] = []
    let i = 0
    while (i < messages.length) {
      const m = messages[i]!
      if (m.role === 'user') {
        groups.push({ type: 'user', msg: m })
        i += 1
        continue
      }
      if (m.role === 'assistant') {
        const branches = [m]
        let j = i + 1
        while (j < messages.length && messages[j]!.role === 'assistant') {
          branches.push(messages[j]!)
          j += 1
        }
        groups.push({ type: 'assistant', branches })
        i = j
        continue
      }
      // system / otros: skip silente.
      i += 1
    }
    return groups
  }, [messages])

  // PRP-032 Sub-fase 5 — copy handler para `<MessageAction>` copy.
  const copyMessageText = useCallback((text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => {
        /* fail-soft: el browser puede bloquear clipboard sin gesto user */
      })
    }
  }, [])

  // PRP-032 iter post-cierre — `<ReasoningTrigger>` queda con el label default
  // del componente AI Elements vendored (inglés: "Thinking..." durante stream,
  // "Thought for N seconds" post-stream). El operador pidió explícito mantener
  // el label en inglés. Post-stream, AI Elements auto-colapsa tras 1s pero el
  // trigger queda VISIBLE — click expande para ver el razonamiento. Eso es
  // EXACTAMENTE lo que el operador pidió ("siempre tenga yo el desplegable").

  // Filtrar modelos duplicados antes de renderizar; si el selectedModel
  // estaba apuntando al filtered (`'default'`), hacer fallback al primer
  // disponible para que el trigger refleje value válido.
  const filteredModels = filterDuplicateModels(models)
  const effectiveModel = filteredModels.some((m) => m.value === selectedModel)
    ? selectedModel
    : filteredModels[0]?.value ?? selectedModel

  return (
    <TooltipProvider delayDuration={400}>
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent
          className={
            isEmpty
              ? 'mx-auto w-full max-w-2xl px-4'
              : 'mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-8'
          }
        >
          {isEmpty ? (
            <ConversationEmptyState className="min-h-[60vh] border-none">
              <ChatEmptyState />
            </ConversationEmptyState>
          ) : (
            <div className="my-auto flex flex-col gap-8">
              {renderGroups.map((g, gIdx) => {
                if (g.type === 'user') {
                  const m = g.msg
                  const text = textOfParts(m.parts)
                  const attachments = attachmentsOfParts(m.parts)
                  return (
                    <Message key={m.id} from="user">
                      <MessageContent>
                        {attachments.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {attachments.map((a, idx) => (
                              <PersistedAttachmentChip key={`${m.id}-att-${idx}`} part={a} />
                            ))}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{text}</p>
                      </MessageContent>
                    </Message>
                  )
                }

                // assistant group — 1 o N branches.
                const branches = g.branches
                const renderAssistant = (m: ChatMessage) => {
                  const text = textOfParts(m.parts)
                  const reasoningText = reasoningOfParts(m.parts)
                  const toolParts = toolPartsOfParts(m.parts)
                  const sourceParts = sourcePartsOfParts(m.parts)
                  const attachments = attachmentsOfParts(m.parts)
                  const isLiveStream = isStreaming && m.id === lastAssistantId
                  const reasoningStreaming = isLiveStream && reasoningText.length > 0 && text.length === 0
                  const canRegenerate = !isStreaming && text.length > 0
                  // PRP-032 iter post-cierre — Shimmer "Thinking..." inmediato
                  // entre el submit y el primer delta. El SDK puede tomar 3-8s
                  // antes de emitir el primer thinking_delta o text_delta;
                  // mostrar feedback visual desde el momento del POST evita
                  // sensación de "click sin respuesta" que el operador detectó.
                  // Condición: el message es el live stream Y aún NO llegó
                  // ningún content (parts.length === 0 o todos vacíos).
                  const showInitialShimmer = isLiveStream
                    && reasoningText.length === 0
                    && text.length === 0
                    && toolParts.length === 0

                  return (
                    <Message key={m.id} from="assistant">
                      <MessageContent>
                        {attachments.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {attachments.map((a, idx) => (
                              <PersistedAttachmentChip key={`${m.id}-att-${idx}`} part={a} />
                            ))}
                          </div>
                        )}

                        {showInitialShimmer && <ThinkingIndicator />}

                        {reasoningText.length > 0 && (
                          <Reasoning isStreaming={reasoningStreaming} className="mb-3">
                            <ReasoningTrigger />
                            <ReasoningContent>{reasoningText}</ReasoningContent>
                          </Reasoning>
                        )}

                        {toolParts.map((tp) => (
                          <Tool key={tp.toolCallId} className="mb-3">
                            <ToolHeader
                              type="dynamic-tool"
                              state={tp.state}
                              toolName={tp.toolName}
                            />
                            <ToolContent>
                              {tp.input !== undefined && <ToolInput input={tp.input} />}
                              {(tp.output !== undefined || tp.errorText) && (
                                <ToolOutput output={tp.output} errorText={tp.errorText} />
                              )}
                            </ToolContent>
                          </Tool>
                        ))}

                        {text.length > 0 && (
                          <MessageResponse
                            // `aios-stream-message` activa containment +
                            // regla `:not(:last-child)` (solo el último
                            // bloque anima — PRP-032 iter v5 optimización
                            // anti-lag multi-line).
                            className={cn(
                              '!h-auto',
                              isLiveStream && 'aios-stream-message',
                            )}
                            animated={isLiveStream ? streamAnimateOptions : false}
                            isAnimating={isLiveStream}
                          >
                            {text}
                          </MessageResponse>
                        )}

                        {sourceParts.length > 0 && (
                          <Sources className="mt-3">
                            <SourcesTrigger count={sourceParts.length} />
                            <SourcesContent>
                              {sourceParts.map((s, idx) => (
                                <Source
                                  key={`${m.id}-src-${idx}`}
                                  href={s.url}
                                  title={s.title ?? s.url}
                                />
                              ))}
                            </SourcesContent>
                          </Sources>
                        )}

                        {/* PRP-032 Sub-fase 5 — MessageActions: copy + regenerar.
                            Solo visible cuando el message tiene texto Y no es
                            streaming activo (evita doble-click durante stream). */}
                        {text.length > 0 && !isLiveStream && (
                          <MessageActions className="mt-2">
                            <MessageAction
                              tooltip="Copiar"
                              label="Copiar mensaje"
                              onClick={() => copyMessageText(text)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </MessageAction>
                            {canRegenerate && (
                              <MessageAction
                                tooltip="Regenerar"
                                label="Regenerar respuesta"
                                onClick={() => regenerate()}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </MessageAction>
                            )}
                          </MessageActions>
                        )}
                      </MessageContent>
                    </Message>
                  )
                }

                if (branches.length === 1) {
                  return <div key={`grp-${gIdx}`}>{renderAssistant(branches[0]!)}</div>
                }

                // Múltiples branches — MessageBranch selector.
                return (
                  <MessageBranch
                    key={`grp-${gIdx}`}
                    defaultBranch={branches.length - 1}
                  >
                    <MessageBranchContent>
                      {branches.map((b) => renderAssistant(b))}
                    </MessageBranchContent>
                    <MessageBranchSelector>
                      <MessageBranchPrevious />
                      <MessageBranchPage />
                      <MessageBranchNext />
                    </MessageBranchSelector>
                  </MessageBranch>
                )
              })}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {(error || uploadError) && (
        <div
          role="alert"
          className="mx-auto mb-2 w-full max-w-2xl rounded-md px-3 py-2 text-footnote"
          style={{
            background: 'color-mix(in oklab, var(--sys-red) 12%, transparent)',
            color: 'var(--sys-red)',
          }}
        >
          {uploadError ?? error}
        </div>
      )}

      <div className="aios-chat-input mx-auto w-full max-w-2xl px-4 pb-6 pt-2">
        <PromptInput
          onSubmit={handleSubmit}
          globalDrop
          multiple
          maxFiles={4}
          maxFileSize={25 * 1024 * 1024}
          accept="image/png,image/jpeg,image/gif,image/webp,image/heic,audio/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav,application/pdf,text/plain,text/markdown,application/json"
          onError={(err) => setUploadError(err.message)}
        >
          {/* Attachments chips arriba del textarea — usePromptInputAttachments
              lee el state interno del PromptInput compound. */}
          <PendingAttachmentsRow />

          {/* ─── Mic floating absolute en la esquina superior derecha del input ───
              Pattern Claude Code byte-exact: el mic vive en absolute positioning
              dentro del wrapper InputGroup (que tiene position: relative scoped
              via .aios-chat-input). NO ocupa espacio en el flow del flexbox,
              evita la fila propia que el `<PromptInputHeader>` agregaba (causaba
              gap vertical enorme sobre el textarea).

              El textarea fluye normalmente y solo se le aplica `padding-right`
              extra para evitar overlap con el mic floating. Sin re-render
              al crecer el textarea multi-línea — el mic queda anchored al
              top-right del input. */}
          <div className="aios-chat-mic-floating">
            <MicButton
              isRecording={voice.isRecording}
              isTranscribing={voice.isTranscribing}
              isSupported={voice.isSupported}
              seconds={voice.secondsRecording}
              onClick={handleMicClick}
            />
          </div>

          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholderText}
              autoFocus={isEmpty}
            />
          </PromptInputBody>

          {/* ─── Bottom row canónico AI Elements ───────────────────────────
              `<PromptInputFooter>` aplica `align="block-end"` + `justify-between`
              + `gap-1` automático, dejando el left cluster y right cluster
              repartidos a los extremos. SIN esto, `<PromptInputTools>` siblings
              quedan juntos a la derecha (issue empíricamente verificado en prod
              donde `+ Máximo Default mic submit` aparecían pegados a la derecha
              en lugar del layout `[+ Máximo]  ←left   right→  [Default mic submit]`).

              Cada select muestra texto compact via `<SelectValue>` con children
              explícito (Radix Select renderea el item.children en trigger por
              default — aprendizaje canónico PRP-031 fix-iter2). El dropdown
              content sí muestra label + descripción multi-line macOS 26. */}
          <PromptInputFooter className="aios-chat-footer">
            {/* ─── Cluster izquierdo ──────────────────────────────────── */}
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger
                  tooltip="Adjuntar archivo"
                  aria-label="Adjuntar"
                >
                  <Plus size={16} strokeWidth={1.75} />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  {/* PRP-031 iter9: item custom con icon FileText (operador
                      feedback: cambiar icon de imagen→documento, dejar solo
                      "Subir archivo", quitar screenshot). El primitive
                      vendored <PromptInputActionAddAttachments> tiene icon
                      hardcoded; reimplementamos con usePromptInputAttachments
                      hook para abrir el file dialog vanilla. */}
                  <UploadFileMenuItem />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

              <PromptInputSelect value={effort} onValueChange={(v) => setEffort(v as EffortLevel)}>
                <PromptInputSelectTrigger
                  size="sm"
                  aria-label={`Thinking effort · ${EFFORT_OPTIONS.find((o) => o.value === effort)?.label ?? 'Max'}`}
                  className="aios-chat-icon-trigger"
                >
                  {/* Children explícito del SelectValue = icon Brain.
                      Override completo: el SelectValue nunca lee item.children
                      en el trigger. CSS `.aios-chat-icon-trigger` oculta el
                      chevron interno del SelectTrigger primitive. */}
                  <PromptInputSelectValue placeholder="Thinking">
                    <Brain size={16} strokeWidth={1.75} />
                  </PromptInputSelectValue>
                </PromptInputSelectTrigger>
                <PromptInputSelectContent className="aios-chat-select-content">
                  {EFFORT_OPTIONS.map((o) => (
                    <PromptInputSelectItem key={o.value} value={o.value}>
                      <span className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">{o.label}</span>
                        <span className="text-caption-1 text-[color:var(--label-tertiary)]">
                          {o.description}
                        </span>
                      </span>
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>

            {/* ─── Cluster derecho ───────────────────────────────────── */}
            <PromptInputTools>
              {filteredModels.length > 0 && (
                <PromptInputSelect value={effectiveModel} onValueChange={setSelectedModel}>
                  <PromptInputSelectTrigger
                    size="sm"
                    aria-label={`Model · ${filteredModels.find((m) => m.value === effectiveModel)?.displayName ?? 'Default'}`}
                    className="aios-chat-icon-trigger"
                  >
                    <PromptInputSelectValue placeholder="Model">
                      <Bot size={16} strokeWidth={1.75} />
                    </PromptInputSelectValue>
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent className="aios-chat-select-content">
                    {filteredModels.map((m) => (
                      <PromptInputSelectItem key={m.value} value={m.value}>
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="font-medium">{m.displayName}</span>
                          {m.description && (
                            <span className="text-caption-1 text-[color:var(--label-tertiary)]">
                              {m.description}
                            </span>
                          )}
                        </span>
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              )}

              <PromptInputSubmit
                status={isStreaming ? 'streaming' : status === 'error' ? 'error' : 'ready'}
                disabled={!isStreaming && !input.trim()}
                onStop={interrupt}
                className="aios-chat-submit"
              />
            </PromptInputTools>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
    </TooltipProvider>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

type MicButtonProps = {
  isRecording: boolean
  isTranscribing: boolean
  isSupported: boolean
  seconds: number
  onClick: () => void
}

function MicButton({
  isRecording,
  isTranscribing,
  isSupported,
  seconds,
  onClick,
}: MicButtonProps) {
  const tooltip = !isSupported
    ? 'Tu navegador no soporta grabación de audio'
    : isRecording
      ? `Detener (${seconds}s)`
      : isTranscribing
        ? 'Transcribiendo…'
        : 'Hablar (transcribe vía Whisper)'

  return (
    <PromptInputButton
      onClick={onClick}
      disabled={!isSupported || isTranscribing}
      tooltip={tooltip}
      aria-label={tooltip}
      aria-pressed={isRecording}
      className={isRecording ? 'aios-mic-recording' : ''}
    >
      {isRecording ? (
        <Square size={14} strokeWidth={2.5} fill="currentColor" />
      ) : !isSupported ? (
        <MicOff size={16} strokeWidth={1.75} />
      ) : (
        <Mic size={16} strokeWidth={1.75} />
      )}
    </PromptInputButton>
  )
}

/**
 * Item custom del dropdown del `+` action menu — abre el file dialog
 * vanilla del compound PromptInput via `usePromptInputAttachments()` hook,
 * con icon FileText (documento) y label "Subir archivo".
 *
 * Reimplementación del primitive `<PromptInputActionAddAttachments>` que
 * tiene `<ImageIcon>` hardcoded (no acepta prop custom). Operador feedback
 * iter9 pidió un icon de documento, no imagen.
 */
function UploadFileMenuItem() {
  const attachments = usePromptInputAttachments()
  return (
    <PromptInputActionMenuItem
      onSelect={(e) => {
        e.preventDefault()
        attachments.openFileDialog()
      }}
    >
      <FileText className="mr-2 size-4" />
      Subir archivo
    </PromptInputActionMenuItem>
  )
}

/**
 * Render de chips de attachments pendientes de envío (state interno del
 * PromptInput compound). Lee files via `usePromptInputAttachments()` y
 * renderiza un row inline con preview + info + remove button por cada uno.
 *
 * Si no hay attachments pendientes, retorna null (NO renderea wrapper vacío).
 */
function PendingAttachmentsRow() {
  const { files, remove } = usePromptInputAttachments()
  if (files.length === 0) return null
  return (
    <Attachments variant="inline" className="px-3 pt-2">
      {files.map((file) => (
        <Attachment
          key={file.id}
          data={file}
          onRemove={() => remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  )
}

/**
 * Chip de attachment ya persistido (reload via SSR — image-url o audio-url
 * parts hidratados desde `chat_messages.metadata.image_url/audio_url`).
 *
 * Imágenes: render `<img>` clickable que abre signed URL en tab nueva.
 * Audio: tag `<audio>` con controls inline.
 */
function PersistedAttachmentChip({
  part,
}: {
  part: { type: 'image-url' | 'audio-url'; url: string; mediaType?: string }
}) {
  if (part.type === 'image-url') {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mc-interactive block overflow-hidden rounded-md border border-[color:var(--separator)]"
        style={{ maxWidth: '320px' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={part.url}
          alt="Adjunto"
          className="block h-auto w-full"
          loading="lazy"
        />
      </a>
    )
  }
  return (
    <audio
      controls
      src={part.url}
      className="rounded-md border border-[color:var(--separator)]"
    />
  )
}
