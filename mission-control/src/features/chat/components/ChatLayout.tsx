'use client'

/**
 * ChatLayout — wrapper Client del módulo `/chat` (PRP-030).
 *
 * Orquesta `<ChatHistorySidebar>` + `<ChatPage>` lado a lado con responsive
 * split:
 *   - Desktop (>=768px): grid `[206px 1fr]` interno al main area de la
 *     `Window` macOS 26. El shell sidebar (Dashboard/AI Agent/Settings) sigue
 *     intacto a la izquierda; este sidebar de historial es CONTENIDO del
 *     módulo /ai-agent.
 *   - Mobile (<768px): full-width chat + button "Conversaciones" en el header
 *     interno del chat que abre el sidebar como sheet vía `<Modal placement='sheet-left'>`.
 *
 * El hook `useChatHistory` se instancia AQUÍ (una sola vez) y se inyecta tanto
 * al sidebar desktop como al sheet mobile — esto evita doble fetch al `/api/chat/sessions`.
 *
 * El `useAgentChat.onSessionCreated` callback se wirea al `refetch` del hook
 * para que cuando aparezca una sesión nueva (primer mensaje desde empty state),
 * el sidebar la muestre sin esperar al `visibilitychange` listener.
 *
 * El componente NO toca el shell global (Sidebar de navegación + Toolbar +
 * AppShell). El layout split vive ENTRE el `<main>` del AppShell y el
 * contenido de la página de `/ai-agent`.
 */

import { useCallback, useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { useIsMobile } from '@/core/hooks/useIsMobile'
import { Modal } from '@/core/components/macos/Modal'
import { ChatPage } from './ChatPage'
import { ChatHistorySidebar } from './ChatHistorySidebar'
import { useChatHistory } from '../hooks/useChatHistory'
import { newChatAction } from '../api/actions'
import type { Message as ChatMessage } from '../contracts/messages'

export type ChatLayoutProps = {
  initialMessages?: ChatMessage[]
  initialChatSessionId?: string
  /** sdkSessionId activo cuando el operador llegó a `/ai-agent?sdk=<uuid>` (PRP-030 polish). */
  activeSdkSessionId?: string
}

export function ChatLayout({
  initialMessages,
  initialChatSessionId,
  activeSdkSessionId,
}: ChatLayoutProps) {
  const isMobile = useIsMobile()
  const historyHook = useChatHistory()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Callback que el ChatPage propaga a useAgentChat.onSessionCreated. Cuando
  // aparece una sesión nueva (primer mensaje desde empty state), el sidebar
  // refetchea para mostrarla.
  const handleSessionCreated = useCallback(() => {
    // Pequeño delay para que el always-push del daemon haya hecho UPSERT en
    // chat_sessions antes del refetch (race condition observada empíricamente
    // en PRP-029: el always-push tarda ~200ms post-result en completar).
    setTimeout(() => historyHook.refetch(), 400)
  }, [historyHook])

  // PRP-035 iter post-cierre: el boton "Nueva conversación" vive ahora en el
  // Toolbar global. Listener registrado aqui (NO en ChatHistorySidebar) porque
  // el sidebar se desmonta cuando el sheet mobile esta cerrado — el listener
  // tiene que estar siempre vivo para que el botón Toolbar funcione en mobile
  // sin el sheet abierto. Handler hace fire-and-forget del newChatAction
  // (best-effort newchat al daemon) + cierra sheet + hard nav. window.location
  // .assign() recarga toda la pagina dejando router state + state local de
  // todos los Client Components en clean slate (patron canonico PRP-032
  // iter post-cierre cuando el contrato es "nueva conversacion").
  useEffect(() => {
    const handler = () => {
      void (async () => {
        await newChatAction(initialChatSessionId)
        setSheetOpen(false)
        if (typeof window !== 'undefined') {
          window.location.assign('/ai-agent')
        }
      })()
    }
    window.addEventListener('aios:ai-agent:new', handler)
    return () => window.removeEventListener('aios:ai-agent:new', handler)
  }, [initialChatSessionId])

  if (isMobile) {
    return (
      <>
        {/* `absolute inset-0` escapa del flow del `<main flex-1 overflow-auto>`
            del AppShell — sin esto, cuando el contenido interno del chat (lista
            de conversaciones, mensajes con streaming) crece más alto que el
            viewport, el `<main>` scrollea y empuja el textarea fuera del fold. */}
        <div className="absolute inset-0 flex flex-col overflow-hidden">
          {/* Header mobile interno con button "Conversaciones" */}
          <div className="hairline-b flex shrink-0 items-center justify-between px-3 py-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Abrir historial de conversaciones"
              className="mc-interactive flex items-center gap-1.5 rounded-md px-2 py-1 text-footnote text-[color:var(--label-secondary)] hover:bg-[color:var(--fill-secondary)]"
            >
              <Menu size={14} strokeWidth={1.75} />
              <span>Conversaciones</span>
            </button>
            <span aria-hidden className="text-caption-1 text-[color:var(--label-tertiary)]">
              {historyHook.sessions.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {/* `key` derivada del session id activo fuerza re-mount del
                <ChatPage> al navegar entre conversaciones — Next 16 App Router
                NO re-mounta Client Components al cambiar sólo searchParams,
                lo que dejaba el `useState(initialMessages)` con el array
                vacío del primer mount (PRP-030 polish bug-fix #12). */}
            <ChatPage
              key={initialChatSessionId ?? activeSdkSessionId ?? 'empty'}
              initialMessages={initialMessages}
              initialChatSessionId={initialChatSessionId}
              onSessionCreated={handleSessionCreated}
            />
          </div>
        </div>

        <Modal
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          label="Historial de conversaciones"
          placement="sheet-left"
          panelMaxWidth="min(320px, 88vw)"
          panelClassName="!rounded-l-none"
        >
          <ChatHistorySidebar
            activeChatSessionId={initialChatSessionId ?? null}
            activeSdkSessionId={activeSdkSessionId ?? null}
            historyHook={historyHook}
            onSelect={() => setSheetOpen(false)}
          />
        </Modal>
      </>
    )
  }

  // Desktop: `absolute inset-0` escapa del `overflow-auto` del `<main>` del
  // AppShell — patrón canónico Praxis para módulos cuyo layout interno gestiona
  // su propio scroll (sidebar list + chat conversation) y NO debe ser absorbido
  // por el scroll vertical del main area.
  //
  // Cada child del grid lleva `min-h-0 overflow-hidden`: en CSS Grid, los items
  // tienen `min-height: auto` por default que permite expansion natural del
  // contenido — `min-h-0` lo neutraliza, dejando que el `flex-1 overflow-auto`
  // interno del sidebar (lista) y de la `<Conversation>` (mensajes) tomen el
  // scroll local correctamente.
  return (
    <div className="absolute inset-0 grid grid-cols-[206px_1fr] overflow-hidden">
      <div className="min-h-0 overflow-hidden">
        <ChatHistorySidebar
          activeChatSessionId={initialChatSessionId ?? null}
          activeSdkSessionId={activeSdkSessionId ?? null}
          historyHook={historyHook}
        />
      </div>
      <div className="min-h-0 overflow-hidden">
        {/* PRP-030 polish bug-fix #12: ver comentario en mobile branch arriba. */}
        <ChatPage
          key={initialChatSessionId ?? activeSdkSessionId ?? 'empty'}
          initialMessages={initialMessages}
          initialChatSessionId={initialChatSessionId}
          onSessionCreated={handleSessionCreated}
        />
      </div>
    </div>
  )
}
