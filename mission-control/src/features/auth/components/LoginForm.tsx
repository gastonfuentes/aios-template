'use client'

import { useState, useTransition } from 'react'
import { requestMagicLink } from '@/features/auth/actions'

export function LoginForm({ initialError }: { initialError?: string }) {
  const [error, setError] = useState<string | undefined>(initialError)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const result = await requestMagicLink(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-subheadline" style={{ color: 'var(--label-secondary)' }}>
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="juan@example.com"
          className="mc-interactive-soft h-9 rounded-field px-3 text-body outline-none"
          style={{
            background: 'rgba(255,255,255,0.85)',
            color: '#000',
            boxShadow: 'var(--shadow-field-inset)',
          }}
        />
      </label>

      {error && (
        <p className="text-callout" style={{ color: 'var(--sys-red)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mc-interactive mt-1 h-9 rounded-control px-4 text-headline disabled:opacity-60"
        style={{
          background: 'var(--accent)',
          color: '#fff',
        }}
      >
        {isPending ? 'Enviando…' : 'Send Magic Link'}
      </button>
    </form>
  )
}
