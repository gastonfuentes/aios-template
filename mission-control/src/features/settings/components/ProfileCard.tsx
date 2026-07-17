'use client'

import { User } from 'lucide-react'

export function ProfileCard({
  email,
  role,
}: {
  email: string
  role: string | null
}) {
  return (
    <section
      className="mc-card rounded-card p-5"
      aria-labelledby="settings-profile-heading"
    >
      <header className="mb-4 flex items-center gap-2">
        <User size={16} strokeWidth={1.8} style={{ color: 'var(--label-secondary)' }} />
        <h2
          id="settings-profile-heading"
          className="text-headline"
          style={{ color: 'var(--label-primary)' }}
        >
          Perfil
        </h2>
      </header>

      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full text-title3 font-semibold uppercase text-white"
          style={{ background: 'var(--accent)' }}
        >
          {email.slice(0, 1)}
        </div>
        <div className="flex flex-col gap-0.5">
          <span
            className="text-body"
            style={{ color: 'var(--label-primary)' }}
          >
            {email}
          </span>
          <span
            className="text-callout"
            style={{ color: 'var(--label-tertiary)' }}
          >
            Rol: <span style={{ color: 'var(--label-secondary)' }}>{role ?? '—'}</span>
          </span>
        </div>
      </div>
    </section>
  )
}
