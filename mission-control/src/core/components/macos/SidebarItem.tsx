'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Bot, Settings, Clock, Activity, PenSquare } from 'lucide-react'
import type { SidebarIconName } from '@/features/shell/constants'

const ICONS: Record<SidebarIconName, typeof LayoutDashboard> = {
  LayoutDashboard,
  Bot,
  Settings,
  Clock,
  Activity,
  PenSquare,
}

export function SidebarItem({
  label,
  href,
  icon,
  count,
}: {
  label: string
  href: string
  icon: SidebarIconName
  count?: number
}) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')
  const Icon = ICONS[icon]

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'group mc-interactive flex items-center gap-2 rounded-md px-3 py-1.5 text-body',
        isActive
          ? 'text-white'
          : 'text-[color:var(--label-primary)] hover:bg-[color:var(--fill-secondary)]',
      ].join(' ')}
      style={isActive ? { background: 'var(--accent)' } : undefined}
    >
      <Icon
        size={16}
        strokeWidth={1.75}
        className={isActive ? 'text-white' : 'text-[color:var(--label-secondary)]'}
      />
      <span className="flex-1">{label}</span>
      {typeof count === 'number' && (
        <span
          className={[
            'min-w-[20px] rounded px-1.5 text-[10px] font-semibold leading-[18px]',
            isActive
              ? 'bg-white/25 text-white'
              : 'bg-[color:var(--fill-secondary)] text-[color:var(--label-secondary)]',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </Link>
  )
}
