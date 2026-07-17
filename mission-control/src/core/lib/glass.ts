// Inline styles para Liquid Glass blur. Las CSS classes `.liquid-glass-*` aplican
// el background con opacity (que sí se preserva en el bundle), pero el
// `backdrop-filter` es strippeado por Lightning CSS / Turbopack en el pipeline
// de Next 16. Aplicarlo como inline style garantiza que llegue al DOM.

import type { CSSProperties } from 'react'

export const glassThin: CSSProperties = {
  backdropFilter: 'saturate(180%) blur(40px)',
  WebkitBackdropFilter: 'saturate(180%) blur(40px)',
}

export const glassRegular: CSSProperties = {
  backdropFilter: 'saturate(180%) blur(60px)',
  WebkitBackdropFilter: 'saturate(180%) blur(60px)',
}

export const glassThick: CSSProperties = {
  backdropFilter: 'saturate(200%) blur(56px)',
  WebkitBackdropFilter: 'saturate(200%) blur(56px)',
}
