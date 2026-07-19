import { AppShell } from '@/core/components/macos/AppShell'

/**
 * Layout for the public (kiosk) route group that hosts the twelve Gannet demo
 * modules shown at the mining congress.
 *
 * Deliberately has **no auth gate**. This is the one difference from
 * `(app)/layout.tsx`, which runs `createClient -> getUser -> isEmailAllowed`
 * and redirects to `/login`. The congress stand cannot depend on a Supabase
 * session: an expiry mid-event would take the demo down in front of visitors,
 * and every record behind these modules is fabricated seed data.
 *
 * Route groups do not contribute a path segment, so the twelve module URLs are
 * unchanged by the move out of `(app)` — `/clientes` is still `/clientes`.
 *
 * The same `AppShell` is rendered as the authenticated group, so the sidebar,
 * toolbar and window chrome are pixel-identical across both contexts. The
 * shell's session-dependent widgets degrade quietly when no session exists:
 * `useNotifications` bails on a non-ok response and the bell renders empty.
 *
 * Scope is exactly these twelve modules. Membership in this group is the whole
 * security boundary — every other surface stays under `(app)` and keeps its
 * gate, and every `/api/*` route keeps its own server-side check. The one
 * public API is `/api/gannet/<view>`, which is constrained by the
 * `GANNET_VIEWS` allow-list rather than by a session.
 */
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
