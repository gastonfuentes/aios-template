'use client'

import { Plug } from 'lucide-react'

/**
 * PRP-034 Sub-fase 1: stub card de Integrations.
 * Placeholder para futuros integradores del operador (Telegram bridge, Skool API,
 * Google Workspace OAuth, Supabase pgmq workers, etc.). Aterriza cuando aparezca
 * el primer brief que lo necesite.
 */
export function IntegrationsCard() {
  return (
    <section
      className="mc-card rounded-card p-5"
      aria-labelledby="settings-integrations-heading"
    >
      <header className="mb-3 flex items-center gap-2">
        <Plug
          size={16}
          strokeWidth={1.8}
          style={{ color: 'var(--label-secondary)' }}
        />
        <h2
          id="settings-integrations-heading"
          className="text-headline"
          style={{ color: 'var(--label-primary)' }}
        >
          Integraciones
        </h2>
      </header>
      <p
        className="text-callout normal-case"
        style={{ color: 'var(--label-tertiary)' }}
      >
        Próximamente: Telegram bridge, Skool API, Google Workspace, webhooks
        salientes.
      </p>
    </section>
  )
}
