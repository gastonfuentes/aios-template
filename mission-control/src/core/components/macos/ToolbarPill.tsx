import type { ReactNode } from 'react'

export function ToolbarPill({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-center rounded-full p-1"
      style={{ background: 'var(--fill-secondary)' }}
    >
      {children}
    </div>
  )
}
