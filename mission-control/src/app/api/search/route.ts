/**
 * PRP-034 Sub-fase 5: federación de búsqueda sobre 7 fuentes.
 *
 *   - chat_sessions   (Supabase RLS owner-only)
 *   - chat_messages   (Supabase)
 *   - ops_events      (Supabase)
 *   - tasks           (Supabase)
 *   - draw_canvases   (Supabase)
 *   - scheduled_tasks (Daemon /schedule — filtrado client-side)
 *   - agent_memories (Daemon /recall — semántico via embeddings 1536d)
 *
 * `Promise.allSettled` evita que una fuente caída tire el endpoint completo.
 * Cada fuente reporta su propio error en `response.errors[source]`.
 *
 * Query con menos de 2 chars retorna empty short-circuit.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'
import type {
  SearchResponse,
  SearchResult,
  SearchSourceKey,
} from '@/features/search/types'
import { SOURCE_ORDER } from '@/features/search/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMIT_PER_SOURCE = 5

export async function GET(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user || !userData.user.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!isEmailAllowed(userData.user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const query = (url.searchParams.get('q') ?? '').trim()

  const empty: SearchResponse = {
    query,
    groups: emptyGroups(),
    errors: {},
  }
  if (query.length < 2) {
    return NextResponse.json(empty)
  }

  const queryLike = `%${query.replace(/[%_]/g, '\\$&')}%`

  // ── Fuentes Supabase: 5 queries paralelas ───────────────────────────────
  const chatSessionsP = supabase
    .from('chat_sessions')
    .select('id, title, updated_at')
    .ilike('title', queryLike)
    .order('updated_at', { ascending: false })
    .limit(LIMIT_PER_SOURCE)
    .then((r) => mapChatSessions(r.data ?? []))

  const chatMessagesP = supabase
    .from('chat_messages')
    .select('id, session_id, role, content, created_at')
    .ilike('content', queryLike)
    .order('created_at', { ascending: false })
    .limit(LIMIT_PER_SOURCE)
    .then((r) => mapChatMessages(r.data ?? []))

  const opsEventsP = supabase
    .from('ops_events')
    .select('event_id, type, source, data, created_at')
    .order('created_at', { ascending: false })
    .limit(LIMIT_PER_SOURCE * 4) // sobre-fetcheamos y filtramos client-side
    .then((r) =>
      mapOpsEvents(
        filterByPayload(
          (r.data ?? []) as Array<{
            event_id: string
            type: string
            source: string
            created_at: string
            data: unknown
          }>,
          query,
        ),
      ),
    )

  const tasksP = supabase
    .from('tasks')
    .select('id, title, description, updated_at')
    .or(`title.ilike.${queryLike},description.ilike.${queryLike}`)
    .order('updated_at', { ascending: false })
    .limit(LIMIT_PER_SOURCE)
    .then((r) => mapTasks(r.data ?? []))

  const drawCanvasesP = supabase
    .from('draw_canvases')
    .select('id, title, updated_at')
    .ilike('title', queryLike)
    .order('updated_at', { ascending: false })
    .limit(LIMIT_PER_SOURCE)
    .then((r) => mapDrawCanvases(r.data ?? []))

  // ── Daemon /schedule (lista todo + filtra) ──────────────────────────────
  const agentUrl = process.env.AGENT_URL
  const bearer = process.env.OPENCLAW_GATEWAY_TOKEN

  const scheduledP = agentUrl && bearer
    ? fetch(`${agentUrl}/schedule`, {
        headers: { Authorization: `Bearer ${bearer}` },
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(`daemon /schedule HTTP ${r.status}`)
          const body = (await r.json()) as { tasks: Array<{ id: string; prompt: string; schedule: string }> }
          return body.tasks
            .filter(
              (t) =>
                t.id.toLowerCase().includes(query.toLowerCase()) ||
                t.prompt.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, LIMIT_PER_SOURCE)
            .map<SearchResult>((t) => ({
              source: 'scheduled_tasks',
              id: t.id,
              title: t.id,
              preview: t.prompt.slice(0, 120),
              href: '/scheduled',
              ts: null,
            }))
        })
    : Promise.reject(new Error('daemon config missing'))

  // ── Daemon /recall (semántico) ──────────────────────────────────────────
  const recallP = agentUrl && bearer
    ? fetch(
        `${agentUrl}/recall?query=${encodeURIComponent(query)}&limit=${LIMIT_PER_SOURCE}`,
        { headers: { Authorization: `Bearer ${bearer}` } },
      )
        .then(async (r) => {
          if (!r.ok) throw new Error(`daemon /recall HTTP ${r.status}`)
          const body = (await r.json()) as {
            memories: Array<{ id: string; source: string; content: string; similarity?: number }>
          }
          return body.memories.map<SearchResult>((m) => ({
            source: 'agent_memories',
            id: m.id,
            title: m.source ?? 'memoria',
            preview: m.content.slice(0, 200),
            href: '/ai-agent',
            score: m.similarity,
            ts: null,
          }))
        })
    : Promise.reject(new Error('daemon config missing'))

  // ── Race todas en paralelo con allSettled ──────────────────────────────
  const settled = await Promise.allSettled([
    chatSessionsP,
    chatMessagesP,
    opsEventsP,
    tasksP,
    drawCanvasesP,
    scheduledP,
    recallP,
  ])

  const groups = emptyGroups()
  const errors: SearchResponse['errors'] = {}
  const sourceKeys: SearchSourceKey[] = [
    'chat_sessions',
    'chat_messages',
    'ops_events',
    'tasks',
    'draw_canvases',
    'scheduled_tasks',
    'agent_memories',
  ]
  settled.forEach((res, i) => {
    const key = sourceKeys[i]!
    if (res.status === 'fulfilled') {
      groups[key] = res.value
    } else {
      errors[key] = res.reason instanceof Error ? res.reason.message : String(res.reason)
    }
  })

  return NextResponse.json({ query, groups, errors } satisfies SearchResponse)
}

function emptyGroups(): SearchResponse['groups'] {
  const out: Partial<SearchResponse['groups']> = {}
  for (const k of SOURCE_ORDER) out[k] = []
  return out as SearchResponse['groups']
}

function filterByPayload<
  T extends { data?: unknown; type?: string },
>(rows: T[], query: string): T[] {
  const q = query.toLowerCase()
  return rows
    .filter((r) => {
      const haystack = `${r.type ?? ''} ${JSON.stringify(r.data ?? {})}`.toLowerCase()
      return haystack.includes(q)
    })
    .slice(0, LIMIT_PER_SOURCE)
}

function mapChatSessions(
  rows: Array<{ id: string; title: string | null; updated_at: string | null }>,
): SearchResult[] {
  return rows.map((r) => ({
    source: 'chat_sessions',
    id: r.id,
    title: r.title ?? 'Sin título',
    preview: null,
    href: `/ai-agent?session=${encodeURIComponent(r.id)}`,
    ts: r.updated_at,
  }))
}

function mapChatMessages(
  rows: Array<{
    id: string
    session_id: string | null
    role: string
    content: string | null
    created_at: string
  }>,
): SearchResult[] {
  return rows.map((r) => ({
    source: 'chat_messages',
    id: r.id,
    title: `${r.role} · ${(r.content ?? '').slice(0, 60)}`,
    preview: (r.content ?? '').slice(0, 200),
    href: r.session_id
      ? `/ai-agent?session=${encodeURIComponent(r.session_id)}`
      : '/ai-agent',
    ts: r.created_at,
  }))
}

function mapOpsEvents(
  rows: Array<{ event_id: string; type: string; source: string; created_at: string; data: unknown }>,
): SearchResult[] {
  return rows.map((r) => ({
    source: 'ops_events',
    id: r.event_id,
    title: `${r.type} · ${r.source}`,
    preview: JSON.stringify(r.data ?? {}).slice(0, 160),
    href: '/ops',
    ts: r.created_at,
  }))
}

function mapTasks(
  rows: Array<{ id: string; title: string | null; description: string | null; updated_at: string }>,
): SearchResult[] {
  return rows.map((r) => ({
    source: 'tasks',
    id: r.id,
    title: r.title ?? 'Sin título',
    preview: (r.description ?? '').slice(0, 200),
    href: '/dashboard',
    ts: r.updated_at,
  }))
}

function mapDrawCanvases(
  rows: Array<{ id: string; title: string; updated_at: string }>,
): SearchResult[] {
  return rows.map((r) => ({
    source: 'draw_canvases',
    id: r.id,
    title: r.title,
    preview: null,
    href: `/draw/${r.id}`,
    ts: r.updated_at,
  }))
}
