/**
 * Helper puro: deriva la etiqueta de origen de una sesión cross-superficie a
 * partir de los datos del daemon.
 *
 * Heurística canónica (PRP-030):
 *   1. `linkedChatSessionId` es UUID v4 → `🌐 Web` (PWA Mission Control —
 *      el chatSessionId fue auto-generado por `useAgentChat` en el primer
 *      envío PRP-029).
 *   2. `linkedChatSessionId === 'telegram'` → `📱 Telegram` (bot grammY
 *      `@{{TELEGRAM_BOT_USERNAME}}` con `ALLOWED_CHAT_ID` single-chat).
 *   3. `linkedChatSessionId.startsWith('cron:')` → `⏰ Cron` con sub-label
 *      = nombre del cron (ej. `cron-reports` para `cron:cron-reports`).
 *      El scheduler usa `cron:<name>` como key SQLite (ver
 *      agent-server/src/scheduler.ts y agent-server/src/db.ts:206 setCronSession).
 *   4. `linkedChatSessionId === null` + `cwd === '<PROJECT_ROOT>'`
 *      en el SDKSessionInfo → `💻 CLI` (Claude Code directo en la máquina del operador
 *      sin pasar por el daemon `/chat/stream`). Sub-label opcional con git
 *      branch si está presente.
 *   5. `linkedChatSessionId === null` y NO matchea CLI → `💻 CLI` con sub-label
 *      `desconocido` (fallback conservador; los cwds no estándar son raros).
 *   6. Cualquier otro literal (futuras superficies) → `💻 CLI` con sub-label
 *      = el literal (defensivo para emergencias).
 *
 * El helper es Pure — sin side effects, sin dependencias del DOM, sin
 * `Date.now()`. Apto para tests vitest sin mocking.
 *
 * Las claves de icon corresponden a `lucide-react` exports (mapeo SF Symbols →
 * Lucide del DS macOS 26 cuando aplica). El consumer renderea el icon real.
 */

export type OriginIconName = 'globe' | 'smartphone' | 'terminal' | 'clock'

export type OriginTag = {
  /** Etiqueta corta para mostrar en el item del sidebar (ej. `Web`, `Telegram`). */
  label: string
  /** Nombre del icon lucide-react (consumer mappeará). */
  icon: OriginIconName
  /** Sub-label opcional (ej. nombre del cron, git branch). */
  sub?: string
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROJECT_ROOT_CWD = '<PROJECT_ROOT>'

export type SDKSessionForTagging = {
  /** Working directory de la sesión SDK al momento de su última actividad. */
  cwd?: string | null
  /** Git branch al final de la sesión (si el repo es git). */
  gitBranch?: string | null
}

export function originTagFor(
  linkedChatSessionId: string | null | undefined,
  sdkSession?: SDKSessionForTagging | null,
): OriginTag {
  // Case 4 + 5 + 6 (linkedChatSessionId vacío)
  if (linkedChatSessionId == null || linkedChatSessionId === '') {
    const cwd = sdkSession?.cwd ?? null
    if (cwd === PROJECT_ROOT_CWD) {
      const sub = sdkSession?.gitBranch ?? undefined
      return { label: 'CLI', icon: 'terminal', sub }
    }
    return { label: 'CLI', icon: 'terminal', sub: cwd ? truncCwd(cwd) : 'desconocido' }
  }

  // Case 3 (cron:<name>)
  if (linkedChatSessionId.startsWith('cron:')) {
    const cronName = linkedChatSessionId.slice('cron:'.length) || 'cron'
    return { label: 'Cron', icon: 'clock', sub: cronName }
  }

  // Case 2 (telegram literal)
  if (linkedChatSessionId === 'telegram') {
    return { label: 'Telegram', icon: 'smartphone' }
  }

  // Case 2b (Telegram chat_id numérico — convención del daemon AIOS para sesiones
  // del bot grammY long-polling, donde la SQLite key vivira como el chat_id de
  // Telegram literal: "6460983932"). PRP-030 polish: heurística incompleta en
  // la entrega original que detectaba solo el literal 'telegram'; los chat_ids
  // numéricos de Telegram (típicamente 9-12 dígitos) caían a CLI fallback.
  if (/^\d{6,15}$/.test(linkedChatSessionId)) {
    return { label: 'Telegram', icon: 'smartphone' }
  }

  // Case 1 (UUID v4 → Web)
  if (UUID_V4_REGEX.test(linkedChatSessionId)) {
    return { label: 'Web', icon: 'globe' }
  }

  // Case 6 fallback (literal desconocido — defensivo)
  return { label: 'CLI', icon: 'terminal', sub: linkedChatSessionId }
}

/**
 * Acorta paths absolutos largos (`<HOME>/Otro/proyecto`) a un sub-label
 * legible (`~/Otro/proyecto`). Si el path no empieza con `/Users/<user>/`, lo
 * retorna sin cambios (recortado a 32 chars como max).
 */
function truncCwd(cwd: string): string {
  const home = cwd.match(/^\/Users\/[^/]+/)?.[0]
  const rel = home ? cwd.slice(home.length) || '/' : cwd
  const display = home ? `~${rel}` : cwd
  return display.length > 32 ? `${display.slice(0, 30)}…` : display
}
