/**
 * PRP-034 Sub-fase 3: types compartidos para Ops.
 *
 * Espejo del shape canónico del daemon (`agent-server/src/ops-logger.ts`).
 * El operador comparte los 18 OpsEventType + 5 OpsSource reales emitidos
 * (refinamiento PRP-034: `mc-web` y `manual` documentados en CLAUDE.md
 * existen como CHECK constraint Supabase pero el daemon NO los emite hoy;
 * la UI solo muestra los 5 reales).
 */

export type OpsEventType =
  | 'session_start'
  | 'session_compact'
  | 'tool_start'
  | 'tool_done'
  | 'tool_error'
  | 'agent_text'
  | 'agent_result'
  | 'agent_error'
  | 'cron_start'
  | 'cron_done'
  | 'cron_error'
  | 'stderr'
  | 'rate_limit'
  | 'jsonl_cleanup'
  | 'housekeeping_summary'
  | 'consolidation_start'
  | 'consolidation_done'
  | 'consolidation_error'

export type OpsSource = 'web' | 'cron' | 'system' | 'telegram' | 'housekeeping'

export type OpsEvent = {
  id: string
  type: OpsEventType
  timestamp: number
  source: OpsSource
  sessionId?: string
  data: Record<string, unknown>
}

export const ALL_TYPES: readonly OpsEventType[] = [
  'session_start',
  'session_compact',
  'tool_start',
  'tool_done',
  'tool_error',
  'agent_text',
  'agent_result',
  'agent_error',
  'cron_start',
  'cron_done',
  'cron_error',
  'stderr',
  'rate_limit',
  'jsonl_cleanup',
  'housekeeping_summary',
  'consolidation_start',
  'consolidation_done',
  'consolidation_error',
]

export const ALL_SOURCES: readonly OpsSource[] = [
  'web',
  'cron',
  'system',
  'telegram',
  'housekeeping',
]

export function sourceColor(source: OpsSource): string {
  switch (source) {
    case 'web':
      return 'var(--sys-blue)'
    case 'cron':
      return 'var(--sys-purple)'
    case 'system':
      return 'var(--label-tertiary)'
    case 'telegram':
      return 'var(--sys-teal)'
    case 'housekeeping':
      return 'var(--sys-orange)'
  }
}

export function typeColor(type: OpsEventType): string {
  if (type.endsWith('_error') || type === 'stderr' || type === 'rate_limit')
    return 'var(--sys-red)'
  if (type.endsWith('_done')) return 'var(--sys-green)'
  if (type.endsWith('_start') || type === 'tool_start') return 'var(--sys-blue)'
  return 'var(--label-secondary)'
}
