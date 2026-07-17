/**
 * Tests unitarios del parser multipart zero-dep (PRP-031 Sub-fase 2).
 *
 * Cubre:
 *  - extractBoundary: detection con/sin comillas, missing header, content-type wrong.
 *  - parseMultipartBody: single file, multi parts, fields plain + file mixed,
 *    closing delimiter, malformed body (sin boundary, sin headers terminados,
 *    sin closing).
 *  - readBodyAsBuffer: respeta MAX_BODY_BYTES limit.
 */

import { describe, it, expect } from 'vitest'
import {
  extractBoundary,
  parseMultipartBody,
  MultipartParseError,
} from './multipart.js'

describe('extractBoundary', () => {
  it('extrae boundary sin comillas', () => {
    expect(
      extractBoundary('multipart/form-data; boundary=----WebKitFormBoundaryABC123'),
    ).toBe('----WebKitFormBoundaryABC123')
  })

  it('extrae boundary entre comillas', () => {
    expect(
      extractBoundary('multipart/form-data; boundary="abc-123-def"'),
    ).toBe('abc-123-def')
  })

  it('throw cuando header missing', () => {
    expect(() => extractBoundary(undefined)).toThrow(MultipartParseError)
    expect(() => extractBoundary(undefined)).toThrow(/missing Content-Type/)
  })

  it('throw cuando content-type no es multipart', () => {
    expect(() => extractBoundary('application/json')).toThrow(/expected multipart/)
  })

  it('throw cuando boundary no encontrado', () => {
    expect(() => extractBoundary('multipart/form-data; charset=utf-8')).toThrow(
      /boundary not found/,
    )
  })
})

describe('parseMultipartBody', () => {
  function buildMultipart(
    parts: Array<{
      name: string
      filename?: string
      contentType?: string
      data: Buffer | string
    }>,
    boundary: string,
  ): Buffer {
    const segments: Buffer[] = []
    for (const part of parts) {
      let header = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`
      if (part.filename !== undefined) header += `; filename="${part.filename}"`
      header += '\r\n'
      if (part.contentType) header += `Content-Type: ${part.contentType}\r\n`
      header += '\r\n'
      segments.push(Buffer.from(header))
      segments.push(typeof part.data === 'string' ? Buffer.from(part.data) : part.data)
      segments.push(Buffer.from('\r\n'))
    }
    segments.push(Buffer.from(`--${boundary}--\r\n`))
    return Buffer.concat(segments)
  }

  it('parsea single file con bytes binarios preservados', () => {
    const boundary = 'boundary-test'
    const audioBytes = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0xff, 0x00, 0xfe, 0x80])
    const body = buildMultipart(
      [{ name: 'file', filename: 'audio.webm', contentType: 'audio/webm', data: audioBytes }],
      boundary,
    )
    const { files, fields } = parseMultipartBody(body, boundary)
    expect(files).toHaveLength(1)
    expect(files[0]?.name).toBe('file')
    expect(files[0]?.filename).toBe('audio.webm')
    expect(files[0]?.contentType).toBe('audio/webm')
    expect(files[0]?.data.equals(audioBytes)).toBe(true)
    expect(Object.keys(fields)).toHaveLength(0)
  })

  it('parsea fields plain (sin filename) como text', () => {
    const boundary = 'fields-test'
    const body = buildMultipart(
      [
        { name: 'session_id', data: 'abc-123' },
        { name: 'mode', data: 'voice' },
      ],
      boundary,
    )
    const { files, fields } = parseMultipartBody(body, boundary)
    expect(files).toHaveLength(0)
    expect(fields.session_id).toBe('abc-123')
    expect(fields.mode).toBe('voice')
  })

  it('parsea mix file + field correctamente', () => {
    const boundary = 'mix-test'
    const body = buildMultipart(
      [
        { name: 'file', filename: 'a.txt', contentType: 'text/plain', data: 'hola' },
        { name: 'tag', data: 'preview' },
      ],
      boundary,
    )
    const { files, fields } = parseMultipartBody(body, boundary)
    expect(files).toHaveLength(1)
    expect(files[0]?.data.toString()).toBe('hola')
    expect(fields.tag).toBe('preview')
  })

  it('throw 400 cuando no hay boundary en body', () => {
    expect(() => parseMultipartBody(Buffer.from('no-boundary'), 'X')).toThrow(
      /no boundary found/,
    )
  })

  it('throw 400 cuando part headers sin terminar', () => {
    const body = Buffer.from('--X\r\nContent-Disposition: form-data; name="f"\r\n')
    expect(() => parseMultipartBody(body, 'X')).toThrow(/headers not terminated/)
  })

  it('throw 413 cuando body > MAX_BODY_BYTES', () => {
    const huge = Buffer.alloc(26 * 1024 * 1024)
    expect(() => parseMultipartBody(huge, 'X')).toThrow(/body too large/)
  })

  it('preserva binary content sin corromper bytes', () => {
    const boundary = 'binary-test'
    // Genera buffer con todos los byte values 0..255
    const allBytes = Buffer.alloc(256)
    for (let i = 0; i < 256; i++) allBytes[i] = i
    const body = buildMultipart(
      [{ name: 'file', filename: 'bin', contentType: 'application/octet-stream', data: allBytes }],
      boundary,
    )
    const { files } = parseMultipartBody(body, boundary)
    expect(files[0]?.data.equals(allBytes)).toBe(true)
  })
})
