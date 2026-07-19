/**
 * The exact set of page routes that are public for the mining congress kiosk.
 *
 * This list is the entire security boundary for the demo. `updateSession` in
 * `@/core/adapters/supabase/session` consults it to decide which paths skip the
 * login redirect, so **adding an entry here makes a route reachable with no
 * session**. Nothing may be added without deliberately intending that.
 *
 * Kept as data next to `views.ts` because the two must agree: these twelve
 * modules read exclusively through `/api/gannet/<view>`, whose own allow-list
 * lives in `views.ts`. A module made public here with no matching view there
 * renders an empty shell, and vice versa.
 *
 * The physical location of each page — the `(demo)` route group — is the other
 * half of the boundary. `(demo)/layout.tsx` omits the auth gate that
 * `(app)/layout.tsx` runs, and the two lists are intentionally redundant: a
 * route must be both in this list and in `(demo)` to be reachable publicly.
 * Being in only one of the two fails closed.
 */

export const GANNET_PUBLIC_ROUTES = [
  '/dashboard-ejecutivo',
  '/clientes',
  '/cotizaciones',
  '/proyectos',
  '/ordenes-trabajo',
  '/compras',
  '/stock',
  '/equipos',
  '/flota',
  '/rrhh',
  '/facturacion',
  '/documentacion',
] as const

/**
 * Whether `pathname` is one of the public demo modules.
 *
 * Matches the route exactly, or a descendant under a `/` separator so future
 * drill-down pages (`/clientes/42`) keep working. Deliberately not a bare
 * `startsWith`: that would also make an unrelated `/clientes-internos` public
 * the day someone adds it.
 */
export function isGannetPublicRoute(pathname: string): boolean {
  return GANNET_PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}
