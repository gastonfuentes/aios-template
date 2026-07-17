import type { ReactNode } from 'react'

export function SidebarSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <div className="px-3 pb-1 pt-3 text-caption2">{label}</div>}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}
