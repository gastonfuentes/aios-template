'use client'

import { useState } from 'react'
import { ChevronRight, Copy } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  sourceColor,
  typeColor,
  type OpsEvent,
} from '../types'

export function OpsEventCard({
  event,
  toolDuration,
}: {
  event: OpsEvent
  toolDuration?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const ts = new Date(event.timestamp)
  const sessionId = event.sessionId ?? (event.data['sessionId'] as string | undefined)

  return (
    <article
      className="rounded-md px-3 py-2 transition-colors hover:bg-[color:var(--fill-secondary)]"
      style={{
        background: 'transparent',
        borderLeft: `3px solid ${sourceColor(event.source)}`,
      }}
    >
      <header className="flex items-center gap-2 text-caption2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Colapsar payload' : 'Expandir payload'}
          aria-expanded={expanded}
          className="mc-interactive inline-flex h-4 w-4 items-center justify-center rounded text-[color:var(--label-tertiary)]"
        >
          <ChevronRight
            size={11}
            strokeWidth={2}
            style={{
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 120ms',
            }}
          />
        </button>
        <span
          className="rounded px-1.5 py-0.5 font-mono"
          style={{
            background: 'var(--fill-secondary)',
            color: typeColor(event.type),
          }}
        >
          {event.type}
        </span>
        <span
          className="rounded px-1.5 py-0.5"
          style={{
            background: 'var(--fill-secondary)',
            color: sourceColor(event.source),
          }}
        >
          {event.source}
        </span>
        {toolDuration !== undefined && (
          <span
            className="rounded px-1.5 py-0.5"
            style={{
              background: 'var(--fill-secondary)',
              color: 'var(--label-secondary)',
            }}
          >
            {toolDuration}ms
          </span>
        )}
        <span style={{ color: 'var(--label-tertiary)' }}>
          {formatDistanceToNow(ts, { addSuffix: true })}
        </span>
        {sessionId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void navigator.clipboard.writeText(sessionId).catch(() => undefined)
            }}
            className="mc-interactive ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono"
            style={{
              background: 'var(--fill-secondary)',
              color: 'var(--label-tertiary)',
            }}
            aria-label="Copy session ID"
            title={sessionId}
          >
            <Copy size={9} strokeWidth={2} />
            {sessionId.slice(0, 8)}
          </button>
        )}
      </header>

      {expanded && (
        <pre
          className="mt-2 max-h-80 overflow-auto rounded-md p-3 font-mono text-caption2"
          style={{
            background: 'var(--fill-secondary)',
            color: 'var(--label-secondary)',
          }}
        >
          {JSON.stringify(event.data, null, 2)}
        </pre>
      )}
    </article>
  )
}
