/**
 * Runtime configuration for the read-only orchestrator service.
 *
 * Every value comes from the environment, injected by the `gannet-ia.service`
 * systemd unit through `/etc/gannet-ia.env` (root-only, mode 600). Nothing is
 * hardcoded and no secret ever lives in the repository. The service binds to
 * loopback only; there is no option to expose it publicly.
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Loopback host — the service must never listen on a public interface. */
export const HOST = '127.0.0.1'

/** Localhost port mission-control calls over. Overridable via `GANNET_IA_PORT`. */
export const PORT = Number(process.env.GANNET_IA_PORT ?? '3131')

/** PostgREST base for the demo database. Anon key is public by design (kiosk). */
export const SUPABASE_URL = process.env.GANNET_SUPABASE_URL ?? ''

/** Anon key: SELECT-only on the `gd_*` views. Read-only by grant, not by trust. */
export const SUPABASE_ANON_KEY = process.env.GANNET_SUPABASE_ANON_KEY ?? ''

/** Present when the Max subscription token was injected by the unit. */
export const HAS_OAUTH_TOKEN =
  typeof process.env.CLAUDE_CODE_OAUTH_TOKEN === 'string' &&
  process.env.CLAUDE_CODE_OAUTH_TOKEN.length > 0

/**
 * Absolute path to the glibc Claude Code binary bundled with the SDK.
 *
 * The SDK's own binary resolver tries the musl build first; on this glibc host
 * that build cannot exec and `query()` fails with a misleading "binary not
 * found". Pinning the glibc binary explicitly is the de-risked, deterministic
 * fix. Resolution is done once at import so a bad install fails fast at boot.
 */
export const CLAUDE_BINARY_PATH: string = require.resolve(
  '@anthropic-ai/claude-agent-sdk-linux-x64/claude',
)

/** Overall budget for one orchestrated answer, including tool round-trips. */
export const ANSWER_TIMEOUT_MS = 20_000

/** Per-tool database round-trip budget. Kept well under the answer budget. */
export const TOOL_TIMEOUT_MS = 6_000
