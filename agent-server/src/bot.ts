/**
 * Telegram bot — superficie iPhone del trío CLI ↔ Web ↔ Telegram.
 *
 * PRP-006 (Fase 6 del brief master). Adaptado del template
 * `business-os-template/agent-server/src/bot.ts` con tres deltas duros:
 *
 *  1. **Cero memory injection (FIX 4 del brief).** No se importa `memory.ts`
 *     ni se llama `buildMemoryContext` / `saveConversationTurn`. El mensaje
 *     al SDK es el `rawText` directo (con prefijo `[Nota de voz]:` cuando
 *     aplica). La memoria, si llega, vivirá como skill `.md` en Git (Fase 8).
 *
 *  2. **Sin tabla `memories`.** La SQLite del daemon (PRP-004 refinamiento 3)
 *     no la creó, así que `/memory` y `/forget` no aplican y se omiten.
 *
 *  3. **Sin `createSender`.** El brief lo marca REMOVE. Si Fase 7 cron
 *     necesita push a Telegram, lo reintroduce con context fresco.
 *
 * Cada turno emite ops events con `source='telegram'` y dispara
 * `mcStart/mcEnd/mcError` (silent-skip mientras MC no exponga
 * `/api/openclaw/event` — endpoint diferido a Fase 10).
 */

import { Bot, type Context, InputFile } from 'grammy'
import {
  TELEGRAM_BOT_TOKEN,
  ALLOWED_CHAT_IDS,
  TYPING_REFRESH_MS,
  MAX_MESSAGE_LENGTH,
} from './config.js'
import { getSession, setSession, clearSession, listTasks } from './db.js'
import { runAgent } from './agent.js'
import { voiceCapabilities, transcribeAudio, synthesizeSpeech } from './voice.js'
import { downloadMedia, buildPhotoMessage, buildDocumentMessage } from './media.js'
import { logger } from './logger.js'
import { mcStart, mcEnd, mcError } from './mc-client.js'
import { validateInput } from './security.js'

// ─── Configuración detector ──────────────────────────────────────────────────

/**
 * `index.ts` consulta esta función al boot para decidir si arranca el bot.
 * Sin token o sin chat autorizado → daemon arranca sin bot (fail-soft) y
 * sigue sirviendo el HTTP server / chat MC normal.
 */
export function isBotConfigured(): boolean {
  return Boolean(TELEGRAM_BOT_TOKEN) && ALLOWED_CHAT_IDS.length > 0
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Convierte markdown a HTML compatible con Telegram (modo HTML).
 * Protege code blocks primero para evitar doble-escape.
 */
export function formatForTelegram(text: string): string {
  const codeBlocks: string[] = []
  let result = text.replace(/```[\s\S]*?```/g, (match) => {
    const lang = match.match(/^```(\w+)/)?.[1] ?? ''
    const code = match.replace(/^```\w*\n?/, '').replace(/```$/, '')
    const escaped = escapeHtml(code)
    codeBlocks.push(`<pre><code class="language-${lang}">${escaped}</code></pre>`)
    return `\x00CODEBLOCK${codeBlocks.length - 1}\x00`
  })

  const inlineCodes: string[] = []
  result = result.replace(/`([^`]+)`/g, (_, code: string) => {
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`)
    return `\x00INLINE${inlineCodes.length - 1}\x00`
  })

  result = escapeHtml(result)

  result = result
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .replace(/_(.+?)_/g, '<i>$1</i>')

  result = result.replace(/\x00INLINE(\d+)\x00/g, (_, i: string) => inlineCodes[parseInt(i, 10)] ?? '')
  result = result.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, i: string) => codeBlocks[parseInt(i, 10)] ?? '')

  return result
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Divide un mensaje largo en chunks que respetan el límite de Telegram.
 * Corta en newlines; si una sola línea excede el límite, corta por palabras.
 */
export function splitMessage(text: string, limit = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= limit) return [text]

  const chunks: string[] = []
  const lines = text.split('\n')
  let current = ''

  for (const line of lines) {
    const candidate = current ? current + '\n' + line : line
    if (candidate.length > limit) {
      if (current) chunks.push(current)
      if (line.length > limit) {
        const words = line.split(' ')
        let wordChunk = ''
        for (const word of words) {
          const wc = wordChunk ? wordChunk + ' ' + word : word
          if (wc.length > limit) {
            if (wordChunk) chunks.push(wordChunk)
            wordChunk = word
          } else {
            wordChunk = wc
          }
        }
        current = wordChunk
      } else {
        current = line
      }
    } else {
      current = candidate
    }
  }

  if (current) chunks.push(current)
  return chunks
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function isAuthorised(chatId: number | string): boolean {
  const candidate = String(chatId)
  // Empty allowlist authorises nobody; `isBotConfigured` already keeps the bot
  // from starting in that case, so this is a second floor, not the only one.
  const allowed = ALLOWED_CHAT_IDS.includes(candidate)
  if (!allowed) {
    // This is the front door of an agent that runs with full permissions. A
    // rejected knock must leave a trace: silently dropping it hides both an
    // intrusion attempt and the ordinary case of onboarding a new chat.
    logger.warn({ chatId: candidate }, 'telegram: rejected unauthorised chat')
  }
  return allowed
}

// ─── Core message handler ────────────────────────────────────────────────────

export async function handleMessage(
  ctx: Context,
  rawText: string,
  forceVoiceReply = false,
): Promise<void> {
  const chatId = String(ctx.chat?.id)
  if (!isAuthorised(chatId)) {
    await ctx.reply('Unauthorized.')
    return
  }

  // Indicador de escritura en loop (refresh cada 4s).
  let typingActive = true
  const sendTyping = async (): Promise<void> => {
    if (!typingActive) return
    try {
      await ctx.api.sendChatAction(ctx.chat!.id, 'typing')
    } catch {
      // Telegram throttles silently — ignorar.
    }
  }
  await sendTyping()
  const typingInterval = setInterval(() => { void sendTyping() }, TYPING_REFRESH_MS)

  // Validar input — sanitiza patrones sospechosos, trunca a 50K.
  const cleanText = validateInput(rawText, 'telegram')

  // Run id único para correlación con MC ops.
  const runId = `tg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  mcStart(runId, cleanText, 'telegram')

  try {
    // FIX 4: NO `buildMemoryContext` ni preámbulo. El mensaje al SDK es el
    // texto del usuario tal cual.
    const sessionId = getSession(chatId)

    const result = await runAgent(cleanText, sessionId, sendTyping, 'telegram')

    typingActive = false
    clearInterval(typingInterval)

    const responseText = result.text?.trim() ?? ''

    if (result.newSessionId) {
      setSession(chatId, result.newSessionId)
    }

    // FIX 4: NO `saveConversationTurn`. La conversación vive en la sesión
    // SDK (`~/.claude/projects/<project-slug>/`). Si Fase 8 quiere
    // persistir aprendizajes en `.md`, lo cierra ahí.

    mcEnd(runId, responseText)

    // TTS si la entrada fue voz y ElevenLabs está activo.
    const caps = voiceCapabilities()
    if (forceVoiceReply && caps.tts && responseText) {
      try {
        const audioBuffer = await synthesizeSpeech(responseText)
        await ctx.replyWithVoice(new InputFile(audioBuffer, 'response.mp3'))
        return
      } catch (err) {
        logger.error({ err }, 'TTS failed, falling back to text')
      }
    }

    // Respuesta de texto (chunked si excede 4096).
    if (!responseText) {
      await ctx.reply('(sin respuesta)')
      return
    }

    const formatted = formatForTelegram(responseText)
    const chunks = splitMessage(formatted)

    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' })
    }
  } catch (err) {
    clearInterval(typingInterval)
    typingActive = false
    logger.error({ err, chatId }, 'handleMessage error')
    mcError(runId, String(err))
    // The full cause goes to the journal, not to the chat. This bot is shown to
    // prospects, and the shared subscription can surface rate-limit or session
    // errors whose raw text reads as a broken product.
    const raw = String(err)
    const stale = raw.includes('No conversation found')
    await ctx.reply(
      stale
        ? 'Se cerró la conversación anterior. Escribime de nuevo y arrancamos un hilo nuevo.'
        : 'No pude completar la consulta en este momento. Probá de nuevo en un momento.',
    )
    // A dead session would fail identically on every later message; clearing it
    // means the next one starts clean instead of looping on the same error.
    if (stale) clearSession(chatId)
  }
}

// ─── Bot factory ─────────────────────────────────────────────────────────────

export function createBot(): Bot {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('createBot: TELEGRAM_BOT_TOKEN is empty (use isBotConfigured() before calling)')
  }
  const bot = new Bot(TELEGRAM_BOT_TOKEN)
  const caps = voiceCapabilities()

  // /start — saludo + capacidades.
  bot.command('start', async (ctx) => {
    if (!isAuthorised(String(ctx.chat.id))) {
      await ctx.reply('Unauthorized.')
      return
    }
    await ctx.reply(
      'Hola, soy AIOS — tu copiloto.\n\n' +
      'Comandos:\n' +
      '/newchat — Empezar una conversación nueva\n' +
      '/voice — Estado de voz (STT/TTS)\n' +
      '/schedule — Ver tareas programadas\n' +
      '/chatid — Mostrar tu chat ID\n\n' +
      `STT: ${caps.stt ? '✓' : '✗'}  TTS: ${caps.tts ? '✓' : '✗'}`,
    )
  })

  // /chatid — útil para sembrar ALLOWED_CHAT_ID al setup inicial.
  bot.command('chatid', async (ctx) => {
    await ctx.reply(`Chat ID: ${ctx.chat.id}`)
  })

  // /newchat — limpia la sesión SDK del chat.
  bot.command('newchat', async (ctx) => {
    if (!isAuthorised(String(ctx.chat.id))) return
    clearSession(String(ctx.chat.id))
    await ctx.reply('Nueva conversación iniciada. Contexto previo borrado.')
  })

  // /voice — estado de capacidades de voz.
  bot.command('voice', async (ctx) => {
    if (!isAuthorised(String(ctx.chat.id))) return
    const c = voiceCapabilities()
    await ctx.reply(
      'Estado de voz:\n' +
      `STT (Groq Whisper): ${c.stt ? '✓ activo' : '✗ sin GROQ_API_KEY'}\n` +
      `TTS (ElevenLabs): ${c.tts ? '✓ activo' : '✗ sin ELEVENLABS_API_KEY/VOICE_ID'}`,
    )
  })

  // /schedule — lista tareas programadas (vacía hasta Fase 7).
  bot.command('schedule', async (ctx) => {
    if (!isAuthorised(String(ctx.chat.id))) return
    const tasks = listTasks()

    if (tasks.length === 0) {
      await ctx.reply('No hay tareas programadas.')
      return
    }

    const lines = tasks.map((t) => {
      const tz = process.env['SCHEDULER_TZ'] ?? 'UTC'
      const nextDate = t.next_run
        ? new Date(t.next_run * 1000).toLocaleString('en-US', { timeZone: tz })
        : 'N/A'
      const status = t.status === 'active' ? '✓' : '⏸'
      return `${status} <b>${t.id}</b>\n   ${t.schedule} → ${nextDate}`
    })

    const text = `<b>Tareas programadas (${tasks.length})</b>\n\n${lines.join('\n\n')}`
    const chunks = splitMessage(text)
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' })
    }
  })

  // Mensajes de texto.
  bot.on('message:text', async (ctx) => {
    if (!isAuthorised(String(ctx.chat.id))) return
    await handleMessage(ctx, ctx.message.text)
  })

  // Voice notes (STT → SDK → opcional TTS).
  bot.on('message:voice', async (ctx) => {
    if (!isAuthorised(String(ctx.chat.id))) return

    if (!caps.stt) {
      await ctx.reply('STT no disponible. Configura GROQ_API_KEY.')
      return
    }

    try {
      await ctx.api.sendChatAction(ctx.chat.id, 'typing')
      const fileId = ctx.message.voice.file_id
      const localPath = await downloadMedia(fileId, 'voice.oga')
      const transcript = await transcribeAudio(localPath)
      logger.info({ length: transcript.length }, 'voice transcribed')
      await handleMessage(ctx, `[Nota de voz]: ${transcript}`, true)
    } catch (err) {
      logger.error({ err }, 'voice handler error')
      await ctx.reply(`Error procesando nota de voz: ${String(err)}`)
    }
  })

  // Fotos.
  bot.on('message:photo', async (ctx) => {
    if (!isAuthorised(String(ctx.chat.id))) return

    try {
      await ctx.api.sendChatAction(ctx.chat.id, 'upload_photo')
      const photos = ctx.message.photo
      const best = photos[photos.length - 1]
      if (!best) {
        await ctx.reply('No pude leer la foto.')
        return
      }
      const localPath = await downloadMedia(best.file_id, 'photo.jpg')
      const caption = ctx.message.caption
      const message = buildPhotoMessage(localPath, caption)
      await handleMessage(ctx, message)
    } catch (err) {
      logger.error({ err }, 'photo handler error')
      await ctx.reply(`Error procesando foto: ${String(err)}`)
    }
  })

  // Documentos.
  bot.on('message:document', async (ctx) => {
    if (!isAuthorised(String(ctx.chat.id))) return

    try {
      await ctx.api.sendChatAction(ctx.chat.id, 'upload_document')
      const doc = ctx.message.document
      const localPath = await downloadMedia(doc.file_id, doc.file_name ?? 'document')
      const caption = ctx.message.caption
      const message = buildDocumentMessage(localPath, doc.file_name ?? 'document', caption)
      await handleMessage(ctx, message)
    } catch (err) {
      logger.error({ err }, 'document handler error')
      await ctx.reply(`Error procesando documento: ${String(err)}`)
    }
  })

  // Error handler global de grammY — atrapa lo que escapa de los handlers.
  bot.catch((err) => {
    logger.error({ err: err.error, ctx: err.ctx?.update }, 'bot error')
  })

  return bot
}
