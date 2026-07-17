/**
 * Smoke tests para los helpers puros de bot.ts. PRP-006.
 *
 * No tocan grammY ni el daemon. Cubren contrato load-bearing del wire-format
 * de Telegram (HTML escape + chunking 4096) que rompería el render del bot
 * si una refactor lo desalinea.
 */

import { describe, it, expect } from 'vitest'
import { formatForTelegram, splitMessage } from './bot.js'

describe('formatForTelegram', () => {
  it('escapa caracteres HTML antes de aplicar markdown', () => {
    const out = formatForTelegram('a < b & c > 0')
    expect(out).toBe('a &lt; b &amp; c &gt; 0')
  })

  it('mapea **bold** a <b>', () => {
    expect(formatForTelegram('hola **mundo**')).toBe('hola <b>mundo</b>')
  })

  it('mapea *italic* a <i>', () => {
    expect(formatForTelegram('hola *mundo*')).toBe('hola <i>mundo</i>')
  })

  it('preserva inline code con escape interno', () => {
    expect(formatForTelegram('uso `<div>` en HTML')).toBe('uso <code>&lt;div&gt;</code> en HTML')
  })

  it('preserva code blocks fenced sin doble-escape', () => {
    const input = 'mira:\n```ts\nconst x = "<a>"\n```'
    const out = formatForTelegram(input)
    expect(out).toContain('<pre><code class="language-ts">')
    // El & dentro del code block sí se escapa, las comillas dobles no — solo &<>.
    expect(out).toContain('const x = "&lt;a&gt;"')
  })
})

describe('splitMessage', () => {
  it('retorna un solo chunk cuando el texto cabe en el límite', () => {
    expect(splitMessage('hola', 4096)).toEqual(['hola'])
  })

  it('parte por newline cuando excede el límite', () => {
    const a = 'a'.repeat(50)
    const b = 'b'.repeat(50)
    const chunks = splitMessage(`${a}\n${b}`, 60)
    expect(chunks.length).toBe(2)
    expect(chunks[0]).toBe(a)
    expect(chunks[1]).toBe(b)
  })

  it('parte por palabras cuando una sola línea excede el límite', () => {
    const line = 'palabra '.repeat(10).trim() // 79 chars
    const chunks = splitMessage(line, 30)
    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(30))
    expect(chunks.join(' ')).toBe(line)
  })

  it('respeta el límite default de 4096 cuando el texto se puede partir', () => {
    // 5000 chars con espacios cada 50 — splitter parte por palabras.
    const word = 'x'.repeat(50)
    const big = Array(100).fill(word).join(' ')
    const chunks = splitMessage(big)
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(4096))
    expect(chunks.join(' ')).toBe(big)
  })
})
