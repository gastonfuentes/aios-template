/**
 * Descarga y manejo de archivos de Telegram.
 *
 * PRP-006: porta `media.ts` del template adaptado a AIOS.
 *  - `validateUrl` y `MAX_DOWNLOAD_SIZE` viven en `security.ts` (no se redefinen).
 *  - `UPLOADS_DIR` viene de `config.ts`. Se crea recursivamente al primer write.
 *  - `cleanupOldUploads` corre al boot del daemon; tolera `UPLOADS_DIR` faltante.
 */

import { writeFileSync, readdirSync, statSync, unlinkSync, mkdirSync } from 'fs'
import { join, extname } from 'path'
import { UPLOADS_DIR, TELEGRAM_BOT_TOKEN } from './config.js'
import { logger } from './logger.js'
import { validateUrl, MAX_DOWNLOAD_SIZE } from './security.js'

/**
 * Descarga un archivo de Telegram al directorio de uploads.
 * Retorna el path local del archivo descargado.
 */
export async function downloadMedia(fileId: string, originalFilename?: string): Promise<string> {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('downloadMedia: TELEGRAM_BOT_TOKEN not configured')
  }

  // 1. getFile → obtener file_path en el storage de Telegram.
  const fileInfoRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  )
  const fileInfo = (await fileInfoRes.json()) as { ok: boolean; result?: { file_path: string } }

  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new Error(`getFile failed for fileId ${fileId}`)
  }

  const remotePath = fileInfo.result.file_path
  const ext = extname(remotePath) || (originalFilename ? extname(originalFilename) : '')

  // 2. Descargar el archivo binario.
  const downloadRes = await fetch(
    `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${remotePath}`
  )

  if (!downloadRes.ok) {
    throw new Error(`download failed: ${downloadRes.status}`)
  }

  // 3. Sanitizar el nombre: solo [a-zA-Z0-9._-] permitidos.
  const rawName = originalFilename ?? remotePath.split('/').pop() ?? 'file'
  const sanitized = rawName.replace(/[^a-zA-Z0-9._-]/g, '-')
  const localPath = join(
    UPLOADS_DIR,
    `${Date.now()}_${sanitized}${ext && !sanitized.includes('.') ? ext : ''}`,
  )

  mkdirSync(UPLOADS_DIR, { recursive: true })
  const buffer = await downloadRes.arrayBuffer()
  writeFileSync(localPath, Buffer.from(buffer))

  logger.debug({ localPath, bytes: buffer.byteLength }, 'media downloaded')
  return localPath
}

/** Mensaje al SDK cuando llega una foto. */
export function buildPhotoMessage(localPath: string, caption?: string): string {
  const lines = [`Analyze this image: ${localPath}`]
  if (caption) lines.push(`Caption: ${caption}`)
  return lines.join('\n')
}

/** Mensaje al SDK cuando llega un documento. */
export function buildDocumentMessage(
  localPath: string,
  filename: string,
  caption?: string,
): string {
  const lines = [`Read and analyze this file: ${localPath} (filename: ${filename})`]
  if (caption) lines.push(`Caption: ${caption}`)
  return lines.join('\n')
}

/**
 * Descarga una imagen desde URL pública (e.g. Supabase Storage) al uploads dir.
 * Aplica `validateUrl` (SSRF) y cap `MAX_DOWNLOAD_SIZE` antes y después del body.
 */
export async function downloadFromUrl(url: string): Promise<string> {
  const urlError = validateUrl(url)
  if (urlError) throw new Error(urlError)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`)

  const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10)
  if (contentLength > MAX_DOWNLOAD_SIZE) {
    throw new Error(
      `download blocked: file too large (${contentLength} bytes, max ${MAX_DOWNLOAD_SIZE})`,
    )
  }

  const contentType = res.headers.get('content-type') ?? 'image/png'
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  }
  const ext = extMap[contentType] ?? '.png'
  const localPath = join(UPLOADS_DIR, `web-${Date.now()}${ext}`)

  const buffer = await res.arrayBuffer()
  if (buffer.byteLength > MAX_DOWNLOAD_SIZE) {
    throw new Error(
      `download blocked: file too large (${buffer.byteLength} bytes, max ${MAX_DOWNLOAD_SIZE})`,
    )
  }

  mkdirSync(UPLOADS_DIR, { recursive: true })
  writeFileSync(localPath, Buffer.from(buffer))

  logger.debug({ localPath, bytes: buffer.byteLength, url }, 'image downloaded from URL')
  return localPath
}

/**
 * Borra uploads más viejos que `maxAgeMs` (default 24h). Llamado al boot.
 * Tolera `UPLOADS_DIR` faltante (catch silente — primer boot).
 */
export function cleanupOldUploads(maxAgeMs = 24 * 60 * 60 * 1000): void {
  try {
    const now = Date.now()
    const files = readdirSync(UPLOADS_DIR)
    let cleaned = 0

    for (const file of files) {
      const filePath = join(UPLOADS_DIR, file)
      const stat = statSync(filePath)
      if (now - stat.mtimeMs > maxAgeMs) {
        unlinkSync(filePath)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned }, 'old uploads cleaned')
    }
  } catch {
    // UPLOADS_DIR puede no existir aún (primer boot) — no es un error.
  }
}
