/**
 * Mission Control client — Agent Server → Mission Control webhook.
 *
 * `mcStart`/`mcEnd`/`mcError` se invocan desde `runAgent*` en Fase 5 para que
 * cada turno aparezca en la timeline de MC. `mcCronResult` lo invoca el
 * scheduler en Fase 7 cuando un job termina.
 *
 * Fire-and-forget: timeouts de 4s, jamás throw, jamás bloquean el agente.
 */

import { readEnvFile } from './env.js'

const env = readEnvFile(['MISSION_CONTROL_URL', 'MISSION_CONTROL_TOKEN'])
const MC_URL = env['MISSION_CONTROL_URL'] ?? ''
const MC_TOKEN = env['MISSION_CONTROL_TOKEN'] ?? ''

async function postEvent(payload: Record<string, unknown>): Promise<void> {
  if (!MC_TOKEN || !MC_URL) return
  try {
    await fetch(MC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MC_TOKEN}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    // MC offline o inalcanzable — silent skip.
  }
}

export function mcStart(runId: string, prompt: string, source: string): void {
  void postEvent({
    runId,
    action: 'start',
    agentId: 'assistant',
    prompt,
    source,
    timestamp: new Date().toISOString(),
  })
}

export function mcEnd(runId: string, response: string): void {
  void postEvent({
    runId,
    action: 'end',
    agentId: 'assistant',
    response,
    timestamp: new Date().toISOString(),
  })
}

export function mcError(runId: string, error: string): void {
  void postEvent({
    runId,
    action: 'error',
    agentId: 'assistant',
    error,
    timestamp: new Date().toISOString(),
  })
}

export function mcCronResult(jobId: string, output: string, error?: string): Promise<void> {
  const payload: Record<string, unknown> = {
    action: 'end',
    runId: `cron-${jobId}-${Date.now()}`,
    agentId: 'assistant',
    prompt: jobId,
    response: output,
    source: 'cron',
    timestamp: new Date().toISOString(),
  }
  if (error) payload['error'] = error
  return postEvent(payload)
}
