/**
 * Shared helpers for the read-only MCP tools.
 *
 * Tools return already-formatted text so the model narrates rather than
 * recomputes: every figure inside a tool result is produced by the shared
 * formatters against real rows. The model's job is to restate, never to derive.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

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
