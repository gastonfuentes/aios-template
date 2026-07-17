/**
 * Parser multipart/form-data zero-dep (RFC 7578) para el daemon AIOS.
 *
 * PRP-031 Fase 4 brief master chat-mission-control — el endpoint HTTP
 * `/transcribe` recibe el audio del browser como `multipart/form-data` con un
 * único field `file`. Resto del daemon es zero-dep multipart (no usa formidable
 * ni busboy ni multer); este parser preserva esa convención.
 *
 * Limitaciones aceptadas (consciente del scope):
 * - Solo single-pass parsing en memoria (NO streaming a disco). Caller debe
 *   limitar el tamaño máximo del body antes de llamar (canónicamente 25MB
 *   para audio).
 * - Solo extrae el primer file field encontrado. Para uploads multi-file
 *   aplicar el patrón a futuro.
 * - Headers parser tolerante minimal — solo `Content-Disposition` (filename,
 *   name) y `Content-Type` per-part.
 */

export type MultipartFile = {
  /** Nombre del field (`name="file"` típicamente). */
  name: string
  /** Filename declarado por el browser (`audio.webm`, etc.). */
  filename: string
  /** Mime type que el browser asignó (`audio/webm`, `audio/mp4`, ...). */
  contentType: string
  /** Bytes del file. */
  data: Buffer
}

export type ParseMultipartResult = {
  files: MultipartFile[]
  /** Fields no-file (text plain, ej. metadata extra en form). */
  fields: Record<string, string>
}

const MAX_BODY_BYTES = 25 * 1024 * 1024 // 25 MB hard limit

export class MultipartParseError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'MultipartParseError'
  }
}

/**
 * Extrae el boundary del header `Content-Type: multipart/form-data; boundary=X`.
 * Soporta boundary entre comillas dobles o sin comillas.
 */
export function extractBoundary(contentTypeHeader: string | undefined): string {
  if (!contentTypeHeader) {
    throw new MultipartParseError('missing Content-Type header')
  }
  if (!contentTypeHeader.toLowerCase().includes('multipart/form-data')) {
    throw new MultipartParseError(
      `expected multipart/form-data, got "${contentTypeHeader}"`,
    )
  }
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentTypeHeader)
  if (!match) {
    throw new MultipartParseError('boundary not found in Content-Type')
  }
  return match[1] ?? match[2] ?? ''
}

function indexOfBuffer(haystack: Buffer, needle: Buffer, fromIndex = 0): number {
  return haystack.indexOf(needle, fromIndex)
}

function parsePartHeaders(headerBlock: string): {
  fieldName: string | null
  filename: string | null
  contentType: string
} {
  let fieldName: string | null = null
  let filename: string | null = null
  let contentType = 'application/octet-stream'

  for (const line of headerBlock.split('\r\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    if (key === 'content-disposition') {
      const nameMatch = /name="([^"]*)"/i.exec(value)
      if (nameMatch) fieldName = nameMatch[1] ?? null
      const filenameMatch = /filename="([^"]*)"/i.exec(value)
      if (filenameMatch) filename = filenameMatch[1] ?? null
    } else if (key === 'content-type') {
      contentType = value
    }
  }
  return { fieldName, filename, contentType }
}

/**
 * Parsea un body multipart completo (Buffer en memoria). Retorna files +
 * fields plain. Throw `MultipartParseError` con status apropiado on cualquier
 * malformación.
 */
export function parseMultipartBody(
  body: Buffer,
  boundary: string,
): ParseMultipartResult {
  if (body.length > MAX_BODY_BYTES) {
    throw new MultipartParseError(
      `body too large: ${body.length} bytes (max ${MAX_BODY_BYTES})`,
      413,
    )
  }
  if (!boundary) {
    throw new MultipartParseError('empty boundary')
  }

  const delimiter = Buffer.from(`--${boundary}`)
  const closingDelimiter = Buffer.from(`--${boundary}--`)
  const result: ParseMultipartResult = { files: [], fields: {} }

  let cursor = indexOfBuffer(body, delimiter)
  if (cursor === -1) {
    throw new MultipartParseError('no boundary found in body')
  }

  while (cursor !== -1) {
    // Si el cursor está en el closing delimiter, terminamos.
    if (
      cursor + closingDelimiter.length <= body.length &&
      body.subarray(cursor, cursor + closingDelimiter.length).equals(closingDelimiter)
    ) {
      break
    }

    // Avanzar cursor pasado el delimiter + CRLF que le sigue.
    cursor += delimiter.length
    if (
      body[cursor] === 0x0d /* \r */ &&
      body[cursor + 1] === 0x0a /* \n */
    ) {
      cursor += 2
    } else {
      // Permitir variantes con solo \n (algunos clientes):
      if (body[cursor] === 0x0a) cursor += 1
    }

    // Buscar fin de headers (CRLF CRLF).
    const headerEnd = indexOfBuffer(body, Buffer.from('\r\n\r\n'), cursor)
    if (headerEnd === -1) {
      throw new MultipartParseError('part headers not terminated')
    }
    const headerBlock = body.subarray(cursor, headerEnd).toString('utf8')
    const { fieldName, filename, contentType } = parsePartHeaders(headerBlock)
    const dataStart = headerEnd + 4

    // Buscar el siguiente delimiter para encontrar el final del body de esta part.
    const nextDelimiter = indexOfBuffer(body, delimiter, dataStart)
    if (nextDelimiter === -1) {
      throw new MultipartParseError('part body not terminated')
    }
    // El \r\n inmediatamente antes del delimiter pertenece al separador, no al body.
    const dataEnd =
      body[nextDelimiter - 2] === 0x0d && body[nextDelimiter - 1] === 0x0a
        ? nextDelimiter - 2
        : nextDelimiter - 1

    const partData = body.subarray(dataStart, dataEnd)

    if (fieldName && filename !== null) {
      result.files.push({
        name: fieldName,
        filename,
        contentType,
        data: Buffer.from(partData),
      })
    } else if (fieldName) {
      result.fields[fieldName] = partData.toString('utf8')
    }

    cursor = nextDelimiter
  }

  return result
}

/**
 * Lee el body completo del request HTTP raw como Buffer. Limit aplicado en
 * el parser. Caller maneja errores de timeout / abort.
 */
export function readBodyAsBuffer(
  req: import('http').IncomingMessage,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(
          new MultipartParseError(
            `body too large: > ${MAX_BODY_BYTES} bytes`,
            413,
          ),
        )
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', (err) => reject(err))
  })
}
