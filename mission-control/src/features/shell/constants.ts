export type SidebarIconName =
  | 'LayoutDashboard'
  | 'Bot'
  | 'Settings'
  | 'Clock'
  | 'Activity'
  | 'PenSquare'

export type SidebarItemDef = {
  readonly label: string
  readonly href: string
  readonly icon: SidebarIconName
  readonly count?: number
}

export type SidebarSectionDef = {
  readonly label: string
  readonly items: readonly SidebarItemDef[]
}

/**
 * PRP-034: sidebar reorganizado en 2 secciones (General / System).
 * - General: superficies navigation-first del operador (Dashboard / AI Agent / Draw).
 * - System: superficies operativas + configuración (Scheduled / Ops / Settings).
 *
 * Iter post-cierre PRP-034 (operador): Draw movido de System a General (es
 * canvas creativo, parte del workflow diario). Settings movido de General a
 * System como ÚLTIMO ítem absoluto — convención canónica macOS (las
 * "preferencias del sistema" siempre al final del menú).
 *
 * El shape multi-sección ya estaba soportado desde PRP-020.
 */
export const SIDEBAR_SECTIONS: readonly SidebarSectionDef[] = [
  {
    label: 'General',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
      // PRP-030 polish: "AI Agent" + icon Bot — refleja la identidad del módulo
      // (chat con agent, agente principal del operador). Ruta `/ai-agent`.
      { label: 'AI Agent', href: '/ai-agent', icon: 'Bot' },
      { label: 'Draw', href: '/draw', icon: 'PenSquare' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Scheduled', href: '/scheduled', icon: 'Clock' },
      { label: 'Ops', href: '/ops', icon: 'Activity' },
      // Convención canónica macOS: Settings siempre último.
      { label: 'Settings', href: '/settings', icon: 'Settings' },
    ],
  },
]

export const TOOLBAR_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  // PRP-030 polish: el header del módulo `/ai-agent` dice "agent".
  '/ai-agent': 'agent',
  '/settings': 'Settings',
  '/scheduled': 'Scheduled',
  '/ops': 'Ops',
  '/draw': 'Draw',
}

export function titleForPath(pathname: string): string {
  if (TOOLBAR_TITLES[pathname]) return TOOLBAR_TITLES[pathname]
  // Match prefix routes like /draw/<id>
  const segment = pathname.split('/').filter(Boolean)[0] ?? ''
  if (segment) {
    const exactSegment = `/${segment}`
    if (TOOLBAR_TITLES[exactSegment]) return TOOLBAR_TITLES[exactSegment]
    return segment.charAt(0).toUpperCase() + segment.slice(1)
  }
  return ''
}

export const ACCENT_SWATCHES = [
  { name: 'Blue', value: '#0A84FF' },
  { name: 'Purple', value: '#BF5AF2' },
  { name: 'Pink', value: '#FF375F' },
  { name: 'Red', value: '#FF453A' },
  { name: 'Orange', value: '#FF9F0A' },
  { name: 'Yellow', value: '#FFD60A' },
  { name: 'Green', value: '#32D74B' },
  { name: 'Teal', value: '#6AC4DC' },
] as const
