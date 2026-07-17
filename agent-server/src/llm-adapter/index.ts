/**
 * Factory + selección del LLMProvider activo según env `LLM_PROVIDER`.
 *
 * Default: `claude-code-sdk` (preserva AIOS productivo intacto post-PRP-037).
 * Template del alumno: el setup wizard agent-driven setea el provider elegido durante INTERVIEW.md.
 *
 * Lazy initialization — los providers anthropic-api / openrouter intentan leer su env solo cuando
 * el caller invoca un método; si la key falta, throw con mensaje accionable. claude-code-sdk
 * NO requiere env (usa session activa del CLI).
 */

import { readEnvFile } from '../env.js'
import { logger } from '../logger.js'
import { claudeCodeSdkProvider } from './claude-code-sdk.js'
import { anthropicApiProvider } from './anthropic-api.js'
import { openrouterProvider } from './openrouter.js'
import { isValidProviderName, type LLMProvider, type LLMProviderName } from './types.js'

let cachedProvider: LLMProvider | null = null

export function selectProvider(): LLMProvider {
  if (cachedProvider !== null) return cachedProvider

  const env = readEnvFile(['LLM_PROVIDER'])
  const raw = env['LLM_PROVIDER']?.trim() ?? 'claude-code-sdk'
  const name: LLMProviderName = isValidProviderName(raw) ? raw : 'claude-code-sdk'

  if (raw && !isValidProviderName(raw)) {
    logger.warn(
      { invalid: raw, fallback: 'claude-code-sdk' },
      'llm-adapter: LLM_PROVIDER inválido — fallback a claude-code-sdk',
    )
  }

  switch (name) {
    case 'claude-code-sdk':
      cachedProvider = claudeCodeSdkProvider
      break
    case 'anthropic-api':
      cachedProvider = anthropicApiProvider
      break
    case 'openrouter':
      cachedProvider = openrouterProvider
      break
  }

  logger.info({ provider: name, capabilities: cachedProvider.capabilities }, 'llm-adapter: provider selected')
  return cachedProvider
}

/** Útil para tests: limpiar el provider cacheado. */
export function resetProviderCache(): void {
  cachedProvider = null
}

export type { LLMProvider, LLMProviderName, ProviderCapabilities, StreamInput, CompleteInput, CompleteResult, NormalizedEvent, ModelInfo, EffortLevel, AgentResult } from './types.js'
