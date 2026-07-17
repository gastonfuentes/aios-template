/**
 * BrandHeader — texto "AIOS" gradient animado en el top del Sidebar.
 *
 * Iter 2026-05-15: padding asimétrico para centrar el texto "AIOS" en el
 * espacio LIBRE del sidebar (entre el cluster de traffic lights a la
 * izquierda y el borde derecho del sidebar), NO en todo el ancho del
 * sidebar como antes.
 *
 * Geometría:
 *   - Sidebar width: 206px (gridTemplateColumns '206px 1fr' del Window).
 *   - Cluster traffic lights: 3 × 12px + 2 × 8px gap = 52px wide, montado
 *     absolute en `left-3 top-4` (12px desde left edge del sidebar) → ocupa
 *     x: 12-64.
 *   - Espacio libre para AIOS: x: 64-206 (width 142px).
 *   - Target center del AIOS: (64 + 206) / 2 = 135.
 *
 * Implementación: `padding-left: 64px` reserva exactamente la cluster zone,
 * `padding-right: 0` deja el inner area extenderse hasta el borde derecho.
 * Inner width 142, centered at 64 + 71 = 135 — coincide byte-exact con el
 * midpoint visual entre cluster_right y sidebar_right.
 *
 * Si en el futuro el cluster cambia de tamaño (más items, gap distinto), el
 * `padding-left` se ajusta literal aquí. Cero CSS var indirection — el valor
 * vive declarativo en un solo lugar.
 */
export function BrandHeader() {
  return (
    <div
      className="flex h-[44px] items-center justify-center"
      style={{ paddingLeft: '64px', paddingRight: '0px' }}
    >
      <h1
        className="text-brand-aios leading-none"
        style={{
          fontSize: '17px',
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        AIOS
      </h1>
    </div>
  )
}
