export type SidebarIconName =
  | 'LayoutDashboard'
  | 'Bot'
  | 'Settings'
  | 'Clock'
  | 'Activity'
  | 'PenSquare'
  | 'Truck'
  // Gannet demo modules.
  | 'BarChart3'
  | 'Building2'
  | 'FileText'
  | 'FolderKanban'
  | 'ClipboardList'
  | 'ShoppingCart'
  | 'Package'
  | 'Wrench'
  | 'HardHat'
  | 'ReceiptText'
  | 'FolderArchive'

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
 *
 * Demo congreso minero (día 2): se agrega la sección "Gannet OS" con los doce
 * módulos construidos. El orden sigue el recorrido de la demo — del tablero
 * ejecutivo al ciclo comercial (clientes → cotizaciones → proyectos → OT), luego
 * abastecimiento y recursos, y finalmente administración. El módulo 13 (IA) se
 * incorpora el día 4.
 *
 * `/proveedores` sale del menú por decisión documentada en
 * `docs/demo-congreso-minero.md`: contradice la narrativa nueva (Andes es el
 * proveedor, no el cliente que mira a sus proveedores), pero borrarlo cuesta
 * tiempo que la semana no tiene. La ruta y su API siguen existiendo y
 * funcionando; solo deja de estar en la navegación.
 */
export const SIDEBAR_SECTIONS: readonly SidebarSectionDef[] = [
  {
    label: 'General',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
      // PRP-030 polish: "AI Agent" + icon Bot — refleja la identidad del módulo.
      // Demo congreso minero: reapuntado de `/ai-agent` (chat con daemon, gateado
      // por login — muere en el kiosco) al asistente público `/ia`. Label e icono
      // se conservan; solo cambia el destino a la superficie sin sesión.
      { label: 'AI Agent', href: '/ia', icon: 'Bot' },
      { label: 'Draw', href: '/draw', icon: 'PenSquare' },
    ],
  },
  {
    label: 'Gannet OS',
    items: [
      { label: 'Dashboard ejecutivo', href: '/dashboard-ejecutivo', icon: 'BarChart3' },
      { label: 'Clientes', href: '/clientes', icon: 'Building2' },
      { label: 'Cotizaciones', href: '/cotizaciones', icon: 'FileText' },
      { label: 'Proyectos', href: '/proyectos', icon: 'FolderKanban' },
      { label: 'Órdenes de trabajo', href: '/ordenes-trabajo', icon: 'ClipboardList' },
      { label: 'Compras', href: '/compras', icon: 'ShoppingCart' },
      { label: 'Stock', href: '/stock', icon: 'Package' },
      { label: 'Equipos', href: '/equipos', icon: 'Wrench' },
      { label: 'Flota', href: '/flota', icon: 'Truck' },
      { label: 'Recursos humanos', href: '/rrhh', icon: 'HardHat' },
      { label: 'Facturación', href: '/facturacion', icon: 'ReceiptText' },
      { label: 'Documentación', href: '/documentacion', icon: 'FolderArchive' },
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
  // Fuera del menú, pero la ruta sigue viva y necesita título en el toolbar.
  '/proveedores': 'Proveedores',
  // Módulos de la demo Gannet OS.
  '/dashboard-ejecutivo': 'Dashboard ejecutivo',
  '/clientes': 'Clientes',
  '/cotizaciones': 'Cotizaciones',
  '/proyectos': 'Proyectos',
  '/ordenes-trabajo': 'Órdenes de trabajo',
  '/compras': 'Compras',
  '/stock': 'Stock y almacenes',
  '/equipos': 'Equipos y herramientas',
  '/flota': 'Flota de vehículos',
  '/rrhh': 'Recursos humanos',
  '/facturacion': 'Facturación y cobranzas',
  '/documentacion': 'Documentación',
  '/ia': 'Asistente Gannet',
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
