import type { ReactNode } from 'react'

export function Window({ children }: { children: ReactNode }) {
  // .window-chrome NO usa `isolation: isolate` para que el backdrop-filter del
  // sidebar (hijo) pueda atravesar y ver el wallpaper del <body> (ambos viven
  // en el stacking context global). Si Safari muestra glitch de clipeo con
  // border-radius + overflow-hidden + hijo con filter, agregar
  // `transform: translateZ(0)` aqui (NO isolation — vuelve a romper el blur).
  return (
    <div
      className="window-chrome relative grid h-full w-full overflow-hidden"
      // gridTemplateRows: minmax(0, 1fr) constrain la fila a la altura del
      // container (h-full = parent h-dvh - padding). Sin esto, los grid items
      // tipo `flex-col h-full` heredan `min-height: auto` default y crecen
      // con su contenido (Conversation con muchos mensajes pueden empujar
      // PromptInput fuera del viewport — bug surfaced en PRP-029 iter9 con 20+ msgs).
      style={{ gridTemplateColumns: '206px 1fr', gridTemplateRows: 'minmax(0, 1fr)' }}
    >
      {children}
    </div>
  )
}
