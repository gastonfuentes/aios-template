/**
 * PRP-032 Sub-fase 6 — chips canned curated al contexto del operador AIOS.
 *
 * Curados desde [.claude/identity/USER.md](../../../../.claude/identity/USER.md)
 * — los 4 frentes de negocio + las métricas norte que el operador consulta a
 * diario con agent:
 *   - your-community-slug (comunidad Skool)
 *   - YouTube (@YOUR_YOUTUBE_CHANNEL)
 *   - your-agency-slug (agencia de IA)
 *   - Revenue mensual / funnel
 *
 * Click → autocompleta el textarea + envía. Cero acoplamiento rígido con skills:
 * el chip es texto en lenguaje natural; agent decide internamente qué skill
 * invocar (aios-supabase, your-community-slug-ops, content-pipeline, funnel-tracking).
 *
 * Para editar los chips: cambiar la constante + push a Git. UI de management
 * runtime queda fuera de scope PRP-032 (brief propio si el operador lo pide).
 */

export type EmptyStateSuggestion = {
  /** Emoji que acompaña el label (jerarquía visual + identidad por chip). */
  icon: string
  /** Texto exacto que se envía a agent al click. */
  label: string
}

export const EMPTY_STATE_SUGGESTIONS: EmptyStateSuggestion[] = [
  {
    icon: '💬',
    label: '¿Cómo va your-community-slug esta semana?',
  },
  {
    icon: '🎬',
    label: '¿Cuál es mi próximo video de YouTube?',
  },
  {
    icon: '💼',
    label: 'Revisa mi pipeline de your-agency-slug',
  },
  {
    icon: '💰',
    label: '¿Cuánto facturamos este mes?',
  },
  {
    icon: '📈',
    label: 'Funnel de la semana con drill-down por source',
  },
]
