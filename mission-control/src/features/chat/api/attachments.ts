'use client'

/**
 * Attachments helper — sube archivos al bucket privado `chat-attachments`
 * (PRP-031 Fase 4 brief master chat-mission-control).
 *
 * Path canónico: `<auth.uid()>/<chatSessionId>/<timestamp>-<safeFilename>`
 * - Primera carpeta = uid del operador (RLS owner-only + per-folder uid check
 *   en `storage.objects` policies, defense-in-depth single-operator AIOS).
 * - Segunda carpeta = chatSessionId UUID v4 (agrupa por conversación).
 * - Filename con timestamp Date.now() para evitar colisiones entre uploads
 *   simultáneos del mismo operador en la misma sesión.
 *
 * URL firmado con TTL 7 días — el daemon lo recibe vía body del POST
 * /chat/stream y el SDK Claude Code lo consume como part `image_url`. El
 * bucket es PRIVADO; sin URL firmado válido el daemon no puede leer el blob.
 *
 * Errores: throw `Error` siempre (canónico Praxis PRP-029 — el caller decide
 * UX). Cero swallow-fail.
 */

import { createClient } from '@/core/adapters/supabase/browser'

export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 días
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

export type AttachmentMediaCategory = 'image' | 'audio' | 'document'

export type UploadResult = {
  /** Path relativo al bucket (`<uid>/<chatSessionId>/<file>`). */
  path: string
  /** URL firmado válido SIGNED_URL_TTL_SECONDS desde la creación. */
  signedUrl: string
  /** Categoría inferida del mime type. */
  mediaCategory: AttachmentMediaCategory
  /** Tamaño en bytes del file subido (echo del file.size). */
  size: number
  /** Mime type que el browser asignó al File. */
  mimeType: string
  /** Nombre original del archivo (preservado para UX, NO usado en path). */
  originalName: string
}

function inferMediaCategory(mimeType: string): AttachmentMediaCategory {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

/**
 * Sanitiza el filename para uso en path Storage. Reemplaza caracteres no
 * URL-safe por `_`, trunca a 80 chars max, garantiza extensión preservada.
 */
function sanitizeFilename(name: string): string {
  const lastDot = name.lastIndexOf('.')
  const ext = lastDot > 0 ? name.slice(lastDot) : ''
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9.]+/g, '')
  return `${safeBase || 'file'}${safeExt}`
}

/**
 * Sube `file` al bucket `chat-attachments` y retorna URL firmado para que el
 * daemon lo consuma. Throw on cualquier error (auth, size, mime, network).
 *
 * @param file - File del browser (FilePicker, drag-drop, screenshot blob, etc.)
 * @param chatSessionId - UUID v4 de la conversación activa (path agrupador).
 * @returns Promise con path relativo, URL firmado y metadata.
 */
export async function uploadAttachment(
  file: File,
  chatSessionId: string,
): Promise<UploadResult> {
  // Validación size (defense-in-depth — el bucket también lo enforza).
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Archivo muy grande: ${Math.round(file.size / 1024 / 1024)}MB. Máximo permitido: 25MB.`,
    )
  }
  if (!chatSessionId || chatSessionId.length < 10) {
    throw new Error('chatSessionId inválido — no se puede subir el attachment.')
  }

  const supabase = createClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    throw new Error(`No autenticado: ${userErr?.message ?? 'sin sesión'}`)
  }
  const uid = userData.user.id

  const safeName = sanitizeFilename(file.name)
  const path = `${uid}/${chatSessionId}/${Date.now()}-${safeName}`

  const { error: uploadErr } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (uploadErr) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`)
  }

  const { data: signedData, error: signErr } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signErr || !signedData?.signedUrl) {
    throw new Error(
      `Storage createSignedUrl failed: ${signErr?.message ?? 'no signedUrl'}`,
    )
  }

  return {
    path,
    signedUrl: signedData.signedUrl,
    mediaCategory: inferMediaCategory(file.type || ''),
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    originalName: file.name,
  }
}
