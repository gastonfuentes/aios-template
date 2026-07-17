'use client'

import type { ComponentType, MouseEventHandler, ReactNode } from 'react'

type IconLike = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

export function ToolbarIconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  children,
}: {
  icon?: IconLike
  label: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="mc-interactive inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--label-primary)] hover:bg-[color:var(--fill-primary)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {Icon ? <Icon size={14} strokeWidth={1.8} /> : children}
    </button>
  )
}
