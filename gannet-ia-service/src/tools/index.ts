/**
 * Assembles the single in-process MCP server that is the model's entire universe
 * of actions. Every tool is a read-only `GET` against a `gd_*` view; there is no
 * tool that writes, shells out or touches the filesystem, and none is ever added.
 *
 * `ALL_TOOL_NAMES` is the canonical allowlist: the orchestrator passes it as
 * `allowedTools` and the permission gate allows nothing outside the
 * `mcp__gannet__` namespace.
 */

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { SERVER_NAME } from './helpers.js'
import { OVERVIEW_TOOLS } from './overview.js'
import { FLEET_TOOLS } from './fleet.js'
import { FINANCE_TOOLS } from './finance.js'
import { COMMERCIAL_TOOLS } from './commercial.js'
import { RESOURCE_TOOLS } from './resources.js'
import { OPERATION_TOOLS } from './operations.js'
import { ACCOUNT_TOOLS } from './accounts.js'

const ALL_TOOLS = [
  ...OVERVIEW_TOOLS,
  ...FLEET_TOOLS,
  ...FINANCE_TOOLS,
  ...COMMERCIAL_TOOLS,
  ...RESOURCE_TOOLS,
  ...OPERATION_TOOLS,
  ...ACCOUNT_TOOLS,
]

/** The in-process read-only MCP server given to `query()`. */
export const gannetMcpServer = createSdkMcpServer({
  name: SERVER_NAME,
  version: '1.0.0',
  tools: ALL_TOOLS,
  alwaysLoad: true,
})

/** Fully-qualified tool names, e.g. `mcp__gannet__overview`. */
export const ALL_TOOL_NAMES: readonly string[] = ALL_TOOLS.map(
  (t) => `mcp__${SERVER_NAME}__${t.name}`,
)

/** Prefix every read-only tool shares; used by the permission gate. */
export const TOOL_PREFIX = `mcp__${SERVER_NAME}__`
