/**
 * PRP-034 Sub-fase 5: types compartidos para Search federada.
 */

export type SearchSourceKey =
  | 'chat_sessions'
  | 'chat_messages'
  | 'ops_events'
  | 'tasks'
  | 'draw_canvases'
  | 'scheduled_tasks'
  | 'agent_memories'

export type SearchResult = {
  source: SearchSourceKey
  id: string
  title: string
  preview: string | null
  href: string
  ts?: string | null
  score?: number
}

export type SearchResponse = {
  query: string
  groups: Record<SearchSourceKey, SearchResult[]>
  errors: Partial<Record<SearchSourceKey, string>>
}

export const SOURCE_LABELS: Record<SearchSourceKey, string> = {
  chat_sessions: 'Conversaciones',
  chat_messages: 'Mensajes',
  ops_events: 'Eventos Ops',
  tasks: 'Tareas',
  draw_canvases: 'Dibujos',
  scheduled_tasks: 'Cron jobs',
  agent_memories: 'Memorias',
}

export const SOURCE_ORDER: readonly SearchSourceKey[] = [
  'chat_sessions',
  'chat_messages',
  'agent_memories',
  'tasks',
  'draw_canvases',
  'scheduled_tasks',
  'ops_events',
]
