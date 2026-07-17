# Playbook: web-marketplace

## Targets obligatorios
- **Stripe Connect**: Express vs Custom, flujo de onboarding, KYC, payouts schedule.
- **Fee model**: % de platform fee, flat fee, subscription + fee, hibrido.
- **Dispute & refunds**: que pasa si un comprador reclama, chargebacks, escrow.
- **Trust & safety**: verificacion de vendedores, reviews, reputation system, dispute resolution.
- **Search + geo**: PostGIS para "cerca de mi", filtros con facetas.

## Targets opcionales
- **Multi-currency** payouts (Stripe Connect soporta >135 paises).
- **Shipping integration**: EasyPost, Shippo para labels.
- **Taxes**: Stripe Tax (soporta VAT/GST/sales tax).

## Busquedas sugeridas
- "Stripe Connect marketplace 2026 best practices"
- "two-sided marketplace KYC requirements"
- "PostGIS Supabase geo queries"
- "marketplace trust safety patterns"

## Fuentes primarias
- https://stripe.com/docs/connect
- https://stripe.com/docs/tax
- https://postgis.net/docs/

## Riesgos a investigar activamente
- Fraude en pagos (tokenize all, 3DS obligatorio en UE).
- Regulaciones por pais (PSD2 en UE, 1099-K en USA para vendedores).
- Escala de busqueda con PostGIS >1M listings — considerar Typesense / Meilisearch.
