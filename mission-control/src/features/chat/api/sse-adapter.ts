/**
 * Parser SSE custom del daemon AIOS.
 *
 * El daemon emite frames Server-Sent Events con tres formatos:
 *
 *   data: {"type":"text_delta","text":"..."}\n\n     ← evento real
 *   : ping\n\n                                       ← keepalive (comentario)
 *   data: [DONE]\n\n                                 ← terminador del stream
 *
 * `parseSSEStream(stream)` consume un `ReadableStream<Uint8Array>` (típicamente
 * `response.body` de un `fetch`) y emite `SSEEvent` validados con Zod. Eventos
 * con shape desconocido (ej. `thinking_delta` futuro antes de extender la
 * unión) se loguean con `console.warn` y se descartan — el stream sigue.
 *
 * Patrón canónico para wire protocols evolutivos: `safeParse` por evento,
 * descarte non-fatal de unknowns, EOF cuando aparece el `[DONE]` marker o
 * el stream cierra naturalmente.
 */

import { SSEEventSchema, SSE_DONE_MARKER, type SSEEvent } from '../contracts/messages'

/**
 * Acumula bytes del `ReadableStream`, parsea frames SSE (`data: ...\n\n`),
 * valida JSON con Zod, y emite eventos tipados como `AsyncGenerator`.
 *
 * Comportamiento:
 *   - Frames con `: ping` se ignoran (keepalive).
 *   - Frame con `data: [DONE]` cierra el generator limpio.
 *   - JSON inválido o evento con shape no-Zod-matcheable: `console.warn` + skip.
 *   - Stream EOF: cierre limpio (sin emitir nada).
 *   - Abort upstream (via `AbortController` del fetch): el reader emite EOF
 *     y el generator termina.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent, void, unknown> {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE frames se delimitan con `\n\n`. Procesamos todos los frames
      // completos que tengamos en buffer; el último fragmento parcial queda
      // para la siguiente iteración.
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')

        const event = parseFrame(frame)
        if (event === 'done') return
        if (event === null) continue
        yield event
      }
    }

    // Flush final por si el server cerró sin trailing \n\n (raro pero defensivo).
    if (buffer.trim().length > 0) {
      const event = parseFrame(buffer)
      if (event !== null && event !== 'done') yield event
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* reader ya liberado por abort */
    }
  }
}

/**
 * Parsea un frame SSE (string sin el `\n\n` trailing) y retorna:
 *   - `SSEEvent` validado si el frame es `data: {valid JSON}`
 *   - `'done'` si el frame es `data: [DONE]` (sentinel para cerrar el generator)
 *   - `null` si el frame es keepalive `: ping`, JSON inválido, o no-matcheable
 */
function parseFrame(frame: string): SSEEvent | 'done' | null {
  // Un frame puede contener múltiples líneas SSE (`data:`, `event:`, `id:`,
  // `retry:`, comentarios `:`). El daemon solo emite `data:` y comentarios,
  // así que filtramos lo demás.
  const lines = frame.split('\n')
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith(':')) continue // comentario SSE (keepalive)
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
    // event:, id:, retry: → ignored (el daemon no los usa)
  }

  if (dataLines.length === 0) return null

  // SSE spec: data lines con el mismo frame se concatenan con \n
  const payload = dataLines.join('\n')

  if (payload === SSE_DONE_MARKER) return 'done'

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch (err) {
    console.warn('[sse-adapter] JSON parse error', { payload, err })
    return null
  }

  const result = SSEEventSchema.safeParse(parsed)
  if (!result.success) {
    console.warn('[sse-adapter] unknown event shape', {
      payload,
      issues: result.error.issues,
    })
    return null
  }

  return result.data
}
