/**
 * Empty state minimalista del chat — solo robot icon (PRP-032 iter post-cierre).
 *
 * El operador pidió retirar las 5 chips canned que el PRP-032 Sub-fase 6
 * había sumado. Razón: la composición visual con chips no encaja con el feel
 * "limpio" que quiere para el chat. Reverted al estado minimal canónico
 * (PRP-030 polish original): solo el robot icon centered + cero copy + cero
 * chips. La constante `EMPTY_STATE_SUGGESTIONS` queda exportada como referencia
 * latente — si en un futuro brief el operador cambia de opinión, basta con
 * pasar `onSuggestionClick` al `<ChatEmptyState>` para reactivar.
 *
 * Tokens DS macOS 26: background del círculo en `var(--accent)` 14% opacity
 * (mismo accent que el botón submit y el active item del sidebar de historial),
 * reactivo automáticamente a la AppearanceCard de /settings (PRP-034; 8 swatches).
 */

import { Bot } from 'lucide-react'

export function ChatEmptyState() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center px-6"
      aria-label="Conversación vacía"
    >
      <div
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: 'color-mix(in oklab, var(--accent) 14%, transparent)' }}
      >
        <Bot
          size={28}
          strokeWidth={1.75}
          className="text-[color:var(--accent)]"
        />
      </div>
    </div>
  )
}
