/**
 * Shared helpers for the read-only MCP tools.
 *
 * Tools return already-formatted text so the model narrates rather than
 * recomputes: every figure inside a tool result is produced by the shared
 * formatters against real rows. The model's job is to restate, never to derive.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ViewPage } from '../supabase.js'
import { formatInteger } from '../format.js'

/** MCP server name; full tool names are `mcp__<SERVER_NAME>__<tool>`. */
export const SERVER_NAME = 'gannet'

/** The result shape every read-only tool returns. */
export type ToolResult = CallToolResult

/** Wraps a formatted string as a tool result. */
export function text(value: string): ToolResult {
  return { content: [{ type: 'text', text: value }] }
}

/** Uniform empty-data result so the model can answer "No tengo ese dato" cleanly. */
export function noData(what: string): ToolResult {
  return text(`Sin datos disponibles para ${what}.`)
}

/**
 * Disclosure for a tool that aggregated over an incomplete page.
 *
 * When PostgREST cut the page, every sum and every count the tool computed from
 * `rows` is short by an unknown amount. Saying so is the difference between an
 * understated figure and a false one; an empty string when the page was
 * complete keeps the happy path untouched.
 */
export function partialWarning(page: ViewPage<unknown>, what: string): string {
  if (!page.truncated) return ''
  const total = page.total === null ? 'más' : formatInteger(page.total)
  return `\n\n(Atención: se leyeron ${formatInteger(page.rows.length)} de ${total} ${what}, así que los totales de este resumen son PARCIALES y quedan por debajo de la cifra real.)`
}

/**
 * "Mostrando los primeros N de M" for a list the tool deliberately cut short.
 *
 * Unlike `partialWarning` this is not a defect: some lists are too long to read
 * aloud. It still has to be stated, because a bare list of N reads as if N were
 * everything there is.
 */
export function listedNote(shown: number, total: number | null, what: string): string {
  if (total === null || shown >= total) return ''
  return `\n\n(Se listan ${formatInteger(shown)} de ${formatInteger(total)} ${what}.)`
}
