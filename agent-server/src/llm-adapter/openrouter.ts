/**
 * Implementación LLMProvider con OpenRouter via Vercel AI SDK + `@openrouter/ai-sdk-provider`.
 *
 * Path multi-provider: una sola key para acceso a 300+ modelos (Anthropic, OpenAI, Google,
 * Mistral, Llama, etc.). Recomendado para alumnos que quieren flexibilidad o costos
 * agresivos vía routing automático del provider.
 *
 * Env vars requeridas:
 *   - OPENROUTER_API_KEY: key de openrouter.ai/keys (sk-or-v1-...).
 *
 * Modelos disponibles (selección curada; OpenRouter expone 300+, doc completa en
 * `setup/llm-providers/openrouter.md`):
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readEnvFile } from '../env.js'
import { createVercelAdapter } from './vercel-ai-sdk-base.js'
import type { LLMProvider, ModelInfo } from './types.js'

const AVAILABLE_MODELS: ModelInfo[] = [
  { id: 'anthropic/claude-sonnet-4.5', displayName: 'Claude Sonnet 4.5 (Anthropic)', contextWindow: 200_000 },
  { id: 'anthropic/claude-opus-4.7', displayName: 'Claude Opus 4.7 (Anthropic)', contextWindow: 1_000_000 },
  { id: 'openai/gpt-5', displayName: 'GPT-5 (OpenAI)', contextWindow: 200_000 },
  { id: 'google/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro (Google)', contextWindow: 1_000_000 },
  { id: 'meta-llama/llama-4-405b-instruct', displayName: 'Llama 4 405B (Meta)', contextWindow: 128_000 },
  { id: 'deepseek/deepseek-v3.5', displayName: 'DeepSeek V3.5', contextWindow: 128_000 },
]

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5'

function createProviderClient() {
  const env = readEnvFile(['OPENROUTER_API_KEY'])
  const apiKey = env['OPENROUTER_API_KEY']
  if (!apiKey || apiKey.length === 0) {
    throw new Error(
      'openrouter provider: OPENROUTER_API_KEY ausente en agent-server/.env. '
      + 'Obténla en openrouter.ai/keys y siémbrala antes de arrancar el daemon.',
    )
  }
  return createOpenRouter({ apiKey })
}

export const openrouterProvider: LLMProvider = createVercelAdapter({
  name: 'openrouter',
  defaultModel: DEFAULT_MODEL,
  buildModel: (modelId: string) => createProviderClient().chat(modelId),
  availableModels: AVAILABLE_MODELS,
  capabilityOverrides: {
    // thinking depende del modelo elegido — Anthropic models sí, otros no garantizado.
    // El AI SDK v6 emite reasoning-delta cuando el modelo lo expone; el base lo mapea.
    thinkingSummarized: true,
  },
})
