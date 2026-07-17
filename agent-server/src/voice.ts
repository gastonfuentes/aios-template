/**
 * Voz: STT (Groq Whisper-large-v3) y TTS (ElevenLabs).
 *
 * PRP-006 — gate fail-soft: si las API keys faltan, `voiceCapabilities()`
 * retorna `{stt:false, tts:false}` y bot.ts decide si responder con texto o
 * con un mensaje informativo. Cero abort.
 *
 * Telegram envía voice notes en `.oga` (Opus en contenedor OGG). Groq exige
 * extensión `.ogg` — voice.ts hace `renameSync` antes del upload.
 */

import { readFileSync, renameSync, existsSync } from 'fs'
import { GROQ_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from './config.js'
import { logger } from './logger.js'

export function voiceCapabilities(): { stt: boolean; tts: boolean } {
  return {
    stt: Boolean(GROQ_API_KEY),
    tts: Boolean(ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID),
  }
}

/**
 * Transcribe un archivo de audio usando Groq Whisper-large-v3.
 * Si el archivo viene como `.oga`, lo renombra a `.ogg` antes de subir
 * (mismo codec, diferente extensión que Groq exige).
 */
export async function transcribeAudio(filePath: string): Promise<string> {
  let actualPath = filePath

  if (filePath.endsWith('.oga')) {
    actualPath = filePath.replace(/\.oga$/, '.ogg')
    if (!existsSync(actualPath)) {
      renameSync(filePath, actualPath)
    }
  }

  const fileBuffer = readFileSync(actualPath)
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'audio/ogg' })

  const formData = new FormData()
  formData.set('file', blob, 'audio.ogg')
  formData.set('model', 'whisper-large-v3')
  formData.set('response_format', 'json')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Groq STT error ${response.status}: ${body}`)
  }

  const data = (await response.json()) as { text: string }
  logger.debug({ length: data.text.length }, 'audio transcribed')
  return data.text
}

/**
 * Variante de `transcribeAudio` que opera sobre un Buffer en memoria (evita
 * round-trip a disco). Usado por el endpoint HTTP `/transcribe` del daemon
 * (PRP-031 Fase 4 brief master chat-mission-control) cuando recibe el audio
 * desde el browser via multipart upload.
 *
 * `filename` se pasa a Groq para que detecte el formato — Whisper acepta
 * webm/mp3/mp4/mpeg/mpga/m4a/ogg/wav/flac. El mime type del browser cross-
 * browser varía (Chrome `audio/webm`, Safari `audio/mp4`, Firefox `audio/ogg`),
 * todos cubiertos por Groq.
 *
 * Lanza `Error` con detalle del status Groq si falla. Caller decide UX.
 */
export async function transcribeAudioBuffer(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured — voice STT unavailable')
  }
  const blob = new Blob([new Uint8Array(buffer)], {
    type: mimeType || 'application/octet-stream',
  })
  const formData = new FormData()
  formData.set('file', blob, filename)
  formData.set('model', 'whisper-large-v3')
  formData.set('response_format', 'json')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Groq STT error ${response.status}: ${body}`)
  }

  const data = (await response.json()) as { text: string }
  logger.debug({ length: data.text.length, filename }, 'audio transcribed (buffer)')
  return data.text
}

/**
 * Sintetiza texto a voz con ElevenLabs Flash v2.5. Retorna MP3 como Buffer
 * para Telegram `replyWithVoice`.
 */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`ElevenLabs TTS error ${response.status}: ${body}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  logger.debug({ bytes: arrayBuffer.byteLength }, 'speech synthesized')
  return Buffer.from(arrayBuffer)
}
