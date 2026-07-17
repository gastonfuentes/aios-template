/**
 * PRP-032 Sub-fase 4 — helper puro para derivar `SourceUrlPart[]` de tool_output
 * cuando el tool es WebSearch / WebFetch / MCP search. Heurística client-side
 * que detecta shapes de URLs en el output del SDK y mappea a parts que el
 * componente `<Sources>` de AI Elements filtra automáticamente.
 *
 * Diseño:
 *   - Cero schema change en `chat_messages` — las parts viven solo durante
 *     el stream y reload via metadata (futuro).
 *   - Compatible con outputs heterogéneos: Anthropic WebSearch nativo,
 *     WebFetch single-URL, MCP search variants (Brave, Tavily, etc.).
 *   - Si el shape no matchea ninguna heurística conocida → retorna `[]`.
 *   - Cero false-positives: prefiere precision sobre recall.
 *
 * Tests propios en `web-search-output-parser.test.ts`.
 */

import type { SourceUrlPart } from '../contracts/messages'

/** Tools cuyo output potencialmente contiene URLs. */
const URL_EMITTING_TOOLS = new Set<string>([
  'WebSearch',
  'WebFetch',
])

/** Pattern para detectar tools MCP que devuelven búsquedas/URLs. */
const MCP_SEARCH_PATTERN = /^mcp__.*(search|fetch|browse|web).*$/i

/**
 * Detecta si un tool emite URLs como output relevante para `<Sources>`.
 * Verificación case-sensitive para tools del SDK Claude Code (canonical names),
 * regex case-insensitive para MCPs custom.
 */
export function isUrlEmittingTool(toolName: string): boolean {
  if (URL_EMITTING_TOOLS.has(toolName)) return true
  return MCP_SEARCH_PATTERN.test(toolName)
}

/**
 * Helper interno: detecta si un objeto tiene shape `{ url, title? }` o similar.
 * Retorna la URL + título si match, null en otro caso.
 */
function extractUrlTitle(obj: unknown): { url: string; title?: string } | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>

  // Pattern (a): { url: string, title?: string }  — Anthropic WebSearch
  const url = typeof o['url'] === 'string' ? o['url'] : undefined
  if (url && /^https?:\/\//i.test(url)) {
    const title = typeof o['title'] === 'string' ? o['title'] : undefined
    return title ? { url, title } : { url }
  }

  // Pattern (b): { link: string, snippet?: string, title?: string }  — Google-style
  const link = typeof o['link'] === 'string' ? o['link'] : undefined
  if (link && /^https?:\/\//i.test(link)) {
    const title = typeof o['title'] === 'string' ? o['title'] : undefined
    return title ? { url: link, title } : { url: link }
  }

  // Pattern (c): { href: string, text?: string }  — HTML-ish anchor
  const href = typeof o['href'] === 'string' ? o['href'] : undefined
  if (href && /^https?:\/\//i.test(href)) {
    const text = typeof o['text'] === 'string' ? o['text'] : undefined
    return text ? { url: href, title: text } : { url: href }
  }

  return null
}

/**
 * Parsea el output completo de un tool y emite `SourceUrlPart[]` si detecta
 * shape de URLs. Maneja:
 *   - Array de objetos `{url|link|href, title?}`.
 *   - Objeto con `results`, `sources`, `items`, `urls` array como propiedad.
 *   - Array de bloques Anthropic `[{type: 'text', text: 'JSON...'}, ...]`
 *     (cuando tool_result.content viene como array de blocks).
 *   - String JSON serializado.
 */
export function deriveSourcePartsFromToolOutput(
  toolName: string,
  output: unknown,
): SourceUrlPart[] {
  if (!isUrlEmittingTool(toolName)) return []
  if (output === null || output === undefined) return []

  const candidates = unwrapToCandidateArray(output)
  if (candidates.length === 0) return []

  const seen = new Set<string>()
  const parts: SourceUrlPart[] = []

  for (const c of candidates) {
    const extracted = extractUrlTitle(c)
    if (!extracted) continue
    if (seen.has(extracted.url)) continue
    seen.add(extracted.url)
    parts.push(
      extracted.title
        ? { type: 'source-url', url: extracted.url, title: extracted.title }
        : { type: 'source-url', url: extracted.url },
    )
  }

  return parts
}

/**
 * Normaliza el output (que puede venir como string, array, objeto wrapping, o
 * array de Anthropic content blocks) a un array de candidatos planos sobre
 * los que aplicar `extractUrlTitle`.
 */
function unwrapToCandidateArray(output: unknown): unknown[] {
  // Caso 1: string JSON serializado — intentar parsear.
  if (typeof output === 'string') {
    const trimmed = output.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed)
        return unwrapToCandidateArray(parsed)
      } catch {
        return []
      }
    }
    return []
  }

  // Caso 2: array.
  if (Array.isArray(output)) {
    // Sub-caso 2a: array de Anthropic content blocks `[{type:'text', text:'JSON...'}, ...]`.
    // Concatenar los textos + intentar parsear JSON. Si falla, retornar items raw.
    if (output.length > 0 && isAnthropicBlockArray(output)) {
      const concatenatedText = output
        .filter((b): b is { type: 'text'; text: string } => {
          const o = b as Record<string, unknown>
          return o?.['type'] === 'text' && typeof o['text'] === 'string'
        })
        .map((b) => b.text)
        .join('\n')
      const trimmed = concatenatedText.trim()
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          return unwrapToCandidateArray(JSON.parse(trimmed))
        } catch {
          // continue al fallback
        }
      }
      return []
    }
    // Sub-caso 2b: array plano de objetos candidatos.
    return output
  }

  // Caso 3: objeto wrapping con propiedades conocidas que contienen el array.
  if (output && typeof output === 'object') {
    const o = output as Record<string, unknown>
    const wrappers = ['results', 'sources', 'items', 'urls', 'data', 'links']
    for (const key of wrappers) {
      const v = o[key]
      if (Array.isArray(v)) return v
    }
    // Si el objeto mismo tiene shape `{url|link|href}`, retornarlo como single-item.
    if (extractUrlTitle(o)) return [o]
  }

  return []
}

/**
 * Detecta si un array tiene shape de Anthropic content blocks
 * `[{type: 'text' | 'image' | ..., ...}, ...]`.
 */
function isAnthropicBlockArray(arr: unknown[]): boolean {
  if (arr.length === 0) return false
  return arr.every((item) => {
    if (!item || typeof item !== 'object') return false
    const o = item as Record<string, unknown>
    return typeof o['type'] === 'string'
  })
}
