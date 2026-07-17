# Playbook: web-ecommerce

## Targets obligatorios
- **Checkout UX**: single-page vs multi-step, guest checkout, Apple Pay / Google Pay.
- **Inventory management**: stock por SKU, reservas durante checkout, restocking alerts.
- **Taxes**: Stripe Tax vs TaxJar vs Avalara (costo, cobertura geografica).
- **Emails transaccionales**: confirmacion, shipping updates, abandoned cart.

## Targets opcionales
- **Headless Shopify integration** si ya tienen catalogo en Shopify.
- **Subscriptions**: Stripe Subscriptions + Billing Portal.
- **Discount codes**: porcentaje, flat, first-time buyer, expiracion.

## Busquedas sugeridas
- "checkout conversion optimization 2026"
- "Stripe Checkout vs Elements"
- "abandoned cart email flow"

## Fuentes primarias
- https://stripe.com/docs/payments/checkout
- https://stripe.com/docs/tax
- https://baymard.com/research (bench industria checkout)

## Riesgos a investigar activamente
- PCI compliance — Stripe Elements/Checkout lo maneja; custom form no.
- Inventory race conditions: dos compradores al mismo item. Usar Postgres advisory locks o row-level locks.
- International shipping: costos, tracking, returns.
