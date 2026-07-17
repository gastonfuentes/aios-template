'use client'

/**
 * Sidebar de historial cross-superficie del chat (PRP-030).
 *
 * Renderea las sesiones del daemon (PWA, CLI, Telegram, Cron) etiquetadas por
 * origen, con el item activo marcado. Click navega a `/ai-agent?session=<uuid>`,
 * botón `+` arranca una conversación nueva, hover sobre item revela trash que
 * abre confirm Modal antes de borrar.
 *
 * Composición:
 *   - Header: título "Conversaciones" + botón `+`.
 *   - Lista: items ordenados por `lastModifiedMs` desc, con tag origen +
 *     timestamp relativo. Loading shimmer + empty state + error fail-soft.
 *   - Footer (no implementado en Fase 3): contador o links extras.
 *
 * Props:
 *   - `activeChatSessionId`: el `?session=<uuid>` actual del URL (null si no hay).
 *   - `onSelect?`: callback opcional invocado al clickear un item — usado por
 *     el sheet mobile para cerrar el sheet tras la navegación.
 *   - `refreshKey?`: contador externo para forzar refetch sin cambiar el hook
 *     (alternativa a exponer `refetch()` por props — más simple).
 *   - `historyHook?`: cuando el caller quiere reusar la misma instancia del hook
 *     entre desktop sidebar + mobile sheet, lo inyecta. Si no, este componente
 *     instancia su propio.
 *
 * El componente NO renderea el shell sidebar (Dashboard/AI Agent/Settings) —
 * ese sigue intacto en `core/components/macos/Sidebar.tsx`. Este es el sidebar
 * de CONTENIDO del módulo /ai-agent, lado a lado del área de mensajes.
 */

import { useState, useTransition, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, Globe, Smartphone, Terminal, Clock } from 'lucide-react'
import { glassThin } from '@/core/lib/glass'
import { Modal } from '@/core/components/macos/Modal'
import { useChatHistory, type UseChatHistoryReturn } from '../hooks/useChatHistory'
import { originTagFor, type OriginIconName } from '../lib/origin-tag'
import { deleteSessionAction } from '../api/actions'
import type { ChatHistoryItem } from '../contracts/messages'

export type ChatHistorySidebarProps = {
  /** chatSessionId UUID v4 activo (para items que cargaron desde Supabase). */
  activeChatSessionId: string | null
  /** sdkSessionId activo cuando el operador llegó via `?sdk=` (CLI/Telegram/cron). */
  activeSdkSessionId?: string | null
  /** Callback opcional invocado al clickear un item (para cerrar sheet mobile). */
  onSelect?: () => void
  /** Hook compartido (si se omite, el componente instancia su propio). */
  historyHook?: UseChatHistoryReturn
}

const ORIGIN_ICON_MAP: Record<OriginIconName, typeof Globe> = {
  globe: Globe,
  smartphone: Smartphone,
  terminal: Terminal,
  clock: Clock,
}

export function ChatHistorySidebar({
  activeChatSessionId,
  activeSdkSessionId,
  onSelect,
  historyHook,
}: ChatHistorySidebarProps) {
  const router = useRouter()
  const ownHook = useChatHistory()
  const { sessions, isLoading, error, refetch } = historyHook ?? ownHook

  const [confirmTarget, setConfirmTarget] = useState<ChatHistoryItem | null>(null)
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  // PRP-035 iter post-cierre: el handler `handleNewChat` y el header con el
  // boton "+" se movieron al ChatLayout + Toolbar global. El listener del
  // CustomEvent `aios:ai-agent:new` vive en ChatLayout (necesita estar
  // siempre montado, incluso cuando el sheet mobile esta cerrado — sino el
  // boton Toolbar dispatcharia al vacio en mobile).

  function handleDeleteConfirm() {
    if (!confirmTarget?.chatSessionId) {
      // Si la sesión no tiene chatSessionId Supabase (CLI/cron sin always-push),
      // no hay nada que borrar en MC — solo cerramos el modal.
      setConfirmTarget(null)
      return
    }
    const targetId = confirmTarget.chatSessionId
    const wasActive = targetId === activeChatSessionId
    setActionError(null)
    startDeleteTransition(async () => {
      const result = await deleteSessionAction(targetId)
      setConfirmTarget(null)
      if (!result.ok) {
        setActionError(result.error)
        return
      }
      if (wasActive) {
        router.push('/ai-agent')
        onSelect?.()
      }
      refetch()
    })
  }

  return (
    <>
      <aside
        className="liquid-glass-thin hairline-r flex h-full min-h-0 flex-col"
        style={glassThin}
        aria-label="Historial de conversaciones"
      >
        {/* Lista */}
        <div className="flex-1 overflow-auto">
          {isLoading && sessions.length === 0 ? (
            <div className="px-3 py-3">
              <ListShimmer count={5} />
            </div>
          ) : error && sessions.length === 0 ? (
            <div className="px-3 py-6 text-center text-footnote text-[color:var(--label-secondary)]">
              No pude cargar el historial.
              <br />
              Intenta de nuevo en un momento.
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-6 text-center text-footnote text-[color:var(--label-secondary)]">
              Sin sesiones todavía.
              <br />
              Manda tu primer mensaje a agent 👇
            </div>
          ) : (
            <ul className="space-y-0.5 px-2 py-2">
              {sessions.map((s) => {
                // Active matching: la sesión activa puede haber cargado desde
                // Supabase (?session=<uuid>) o desde el SDK directo (?sdk=<sdkSessionId>).
                // Cualquiera de los dos paths debe marcar el item como activo.
                const isActive =
                  (activeChatSessionId !== null && s.chatSessionId === activeChatSessionId) ||
                  (activeSdkSessionId != null && s.sdkSessionId === activeSdkSessionId)
                return (
                  <HistoryItem
                    key={s.sdkSessionId}
                    item={s}
                    isActive={isActive}
                    onClickItem={onSelect}
                    onClickDelete={() => setConfirmTarget(s)}
                  />
                )
              })}
            </ul>
          )}
        </div>

        {/* Action error footer (toast inline) */}
        {actionError && (
          <div
            role="alert"
            className="hairline-t px-3 py-2 text-footnote"
            style={{
              background: 'color-mix(in oklab, var(--sys-red) 10%, transparent)',
              color: 'var(--sys-red)',
            }}
          >
            {actionError}
          </div>
        )}
      </aside>

      {/* Confirm modal de borrado */}
      <Modal
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        label="Confirmar borrado"
        role="alertdialog"
        panelMaxWidth="380px"
      >
        <div className="flex flex-col items-center px-6 py-5 text-center">
          <h3 className="text-headline mb-1.5 text-[color:var(--label-primary)]">
            ¿Borrar esta conversación?
          </h3>
          <p className="mb-5 text-footnote text-[color:var(--label-secondary)]">
            Borro los mensajes de mi base. La sesión SDK queda en el daemon
            hasta el housekeeping de la noche.
          </p>
          <div className="flex w-full justify-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmTarget(null)}
              disabled={isDeletePending}
              className="mc-interactive flex-1 rounded-md px-3 py-1.5 text-body text-[color:var(--label-primary)] hover:bg-[color:var(--fill-secondary)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeletePending}
              className="mc-interactive flex-1 rounded-md px-3 py-1.5 text-body text-white disabled:opacity-50"
              style={{ background: 'var(--sys-red)' }}
            >
              {isDeletePending ? 'Borrando…' : 'Borrar'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function HistoryItem({
  item,
  isActive,
  onClickItem,
  onClickDelete,
}: {
  item: ChatHistoryItem
  isActive: boolean
  onClickItem?: () => void
  onClickDelete: () => void
}) {
  const tag = originTagFor(item.chatSessionId, {
    cwd: item.cwd ?? null,
    gitBranch: item.gitBranch ?? null,
  })
  const Icon = ORIGIN_ICON_MAP[tag.icon]
  // PRP-030 polish bug-fix #1+#3: el href soporta dos modos de retomar conversación:
  //   - chatSessionId UUID válido → `?session=<uuid>` (carga desde Supabase
  //     `chat_messages` via SSR — caso canónico para sesiones nacidas en MC web).
  //   - sin chatSessionId UUID (CLI / Telegram chat_id numérico / cron) →
  //     `?sdk=<sdkSessionId>` (carga desde `.jsonl` del SDK via daemon — caso
  //     fallback para sesiones cross-superficie sin always-push).
  // El Server Component `/chat/page.tsx` discrimina los dos casos y elige el
  // helper correcto.
  const isUuidV4 =
    item.chatSessionId !== null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      item.chatSessionId,
    )
  const href = isUuidV4
    ? `/ai-agent?session=${encodeURIComponent(item.chatSessionId!)}`
    : `/ai-agent?sdk=${encodeURIComponent(item.sdkSessionId)}`
  const relativeTime = formatRelativeTime(item.lastModifiedMs)

  function handleDeleteClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    onClickDelete()
  }

  return (
    <li className="group/item">
      <Link
        href={href}
        onClick={onClickItem}
        aria-current={isActive ? 'true' : undefined}
        className={[
          'mc-interactive flex flex-col gap-0.5 rounded-md px-2.5 py-2',
          // Active state: borde sutil izquierdo en color accent + bg con tinte
          // accent ~10% opacity. Más contraste vs `bg-fill-tertiary` plano que
          // se perdía visualmente en dark mode (PRP-030 polish bug-fix #4).
          isActive
            ? 'text-[color:var(--label-primary)] shadow-[inset_2px_0_0_0_var(--accent)]'
            : 'text-[color:var(--label-primary)] hover:bg-[color:var(--fill-secondary)]',
        ].join(' ')}
        style={
          isActive
            ? { background: 'color-mix(in oklab, var(--accent) 14%, transparent)' }
            : undefined
        }
      >
        <div className="flex items-center justify-between gap-2">
          <span className="line-clamp-1 flex-1 text-body" title={item.title}>
            {item.title}
          </span>
          <button
            type="button"
            onClick={handleDeleteClick}
            aria-label={`Borrar conversación ${item.title}`}
            className="opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 focus-visible:opacity-100"
          >
            <Trash2
              size={14}
              strokeWidth={1.75}
              className="text-[color:var(--label-tertiary)] hover:text-[color:var(--sys-red)]"
            />
          </button>
        </div>
        <div className="flex items-center gap-2 text-caption-1 text-[color:var(--label-secondary)]">
          <span className="flex items-center gap-1">
            <Icon size={11} strokeWidth={1.75} />
            <span>{tag.label}</span>
            {tag.sub && <span className="opacity-60">· {tag.sub}</span>}
          </span>
          <span className="opacity-60">·</span>
          <span>{relativeTime}</span>
        </div>
      </Link>
    </li>
  )
}

function ListShimmer({ count = 5 }: { count?: number }) {
  return (
    <ul className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="h-12 animate-pulse rounded-md"
          style={{ background: 'color-mix(in oklab, var(--label-primary) 6%, transparent)' }}
        />
      ))}
    </ul>
  )
}

/**
 * Devuelve un timestamp relativo en español. Pure (no DOM, sin localStorage),
 * pero usa `Date.now()` — el componente que lo invoca renderea cliente-side.
 *
 *   - <60s   → "ahora"
 *   - <60min → "hace Nmin"
 *   - <24h   → "hace Nh"
 *   - <7d    → "hace Nd"
 *   - >=7d   → fecha corta locale español "12 nov"
 */
function formatRelativeTime(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (diffSec < 60) return 'ahora'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `hace ${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `hace ${diffD}d`
  const date = new Date(ms)
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}
