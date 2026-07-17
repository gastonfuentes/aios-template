# Playbook: web-saas

## Targets obligatorios
- **Modelo de pricing**: subscription vs usage-based vs seat-based. Stripe patterns.
- **Onboarding**: activation rate vs time-to-value. Patterns: checklist, product tour, empty states.
- **Trial strategy**: 7/14/30 dias, con o sin tarjeta al inicio.
- **Auth flow**: email magic link vs password vs OAuth (costos de mantenimiento y UX).
- **RLS en Supabase**: policies por `auth.uid()`, por rol, por tenant.

## Targets opcionales
- **Feature flags**: PostHog, GrowthBook, Vercel Flags.
- **Customer support**: Intercom, Crisp, Plain.
- **Usage limits / entitlements**: patterns para "plan + feature access".

## Busquedas sugeridas
- "SaaS pricing models 2026"
- "Stripe subscriptions best practices"
- "Supabase RLS multi-tenant"
- "SaaS onboarding patterns"

## Fuentes primarias
- https://stripe.com/docs/billing/subscriptions/overview
- https://supabase.com/docs/guides/auth/row-level-security
- https://posthog.com/docs/feature-flags

## Riesgos a investigar activamente
- Webhooks de Stripe duplicados → idempotency keys.
- RLS mal configurada = datos expuestos. Testear con `supabase gen types` + tests de policy.
- Cancelaciones via billing portal vs email "¿seguro?"
