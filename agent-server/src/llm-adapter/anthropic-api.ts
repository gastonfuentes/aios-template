/**
 * Implementación LLMProvider con Anthropic API directa via Vercel AI SDK + `@ai-sdk/anthropic`.
 *
 * Path para alumnos que NO usan Claude Code CLI / Max plan — pay-per-token con control fino.
 * Reasoning summarized funciona cuando el modelo soporta extended thinking (Sonnet 4.6+ / Opus 4.6+).
 * Memory Tool reimplementado via Supabase `<prefix>_memories` (wrapper en `recall.ts` parametrizado).
 *
 * Env vars requeridas:
 *   - ANTHROPIC_API_KEY: API key de console.anthropic.com (sk-ant-...).
 *
 * Modelos disponibles (hardcoded; actualizar en sprints futuros del template):
 *   - claude-sonnet-4-5: balance velocidad/calidad, recomendado para chat productivo.
 *   - claude-opus-4-7: máxima calidad, costo más alto.
 *   - claude-haiku-4: para tareas de baja complejidad o costo crítico.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { readEnvFile } from '../env.js'
import { createVercelAdapter } from './vercel-ai-sdk-base.js'
import type { LLMProvider, ModelInfo } from './types.js'

const AVAILABLE_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4.5', contextWindow: 200_000 },
  { id: 'claude-opus-4-7', displayName: 'Claude Opus 4.7', contextWindow: 1_000_000 },
  { id: 'claude-haiku-4', displayName: 'Claude Haiku 4', contextWindow: 200_000 },
]

const DEFAULT_MODEL = 'claude-sonnet-4-5'

function createProviderClient() {
  const env = readEnvFile(['ANTHROPIC_API_KEY'])
  const apiKey = env['ANTHROPIC_API_KEY']
  if (!apiKey || apiKey.length === 0) {
    throw new Error(
      'anthropic-api provider: ANTHROPIC_API_KEY ausente en agent-server/.env. '
      + 'Obténla en console.anthropic.com y siémbrala antes de arrancar el daemon.',
    )
  }
  return createAnthropic({ apiKey })
}

export const anthropicApiProvider: LLMProvider = createVercelAdapter({
  name: 'anthropic-api',
  defaultModel: DEFAULT_MODEL,
  buildModel: (modelId: string) => createProviderClient()(modelId),
  availableModels: AVAILABLE_MODELS,
  capabilityOverrides: {
    // Anthropic via API directa soporta extended thinking summarized cuando el modelo lo expone.
    // El AI SDK v6 mapea `reasoning-delta` chunks que `vercel-ai-sdk-base.ts` traduce a `thinking_delta`.
    thinkingSummarized: true,
  },
})
