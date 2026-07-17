'use client'

import { useState } from 'react'
import { BrandHeader } from './BrandHeader'
import { SidebarSection } from './SidebarSection'
import { SidebarItem } from './SidebarItem'
import { TrafficLights } from './TrafficLights'
import { SignoutConfirmDialog } from './SignoutConfirmDialog'
import { SIDEBAR_SECTIONS } from '@/features/shell/constants'
import { glassRegular } from '@/core/lib/glass'
import { useShellMode } from '@/core/hooks/useShellMode'

/**
 * Sidebar del shell desktop. Liquid Glass regular sobre wallpaper, secciones
 * navegables + BrandHeader top.
 *
 * PRP-036: el `<SignoutButton />` que vivía en el bottom-left (PRP-034 iter
 * post-cierre) se relocaliza al cluster de traffic lights del Toolbar (botón
 * rojo). El Sidebar pierde su bloque bottom y queda más limpio.
 *
 * PRP-036 iter post-cierre (2026-05-15): los traffic lights se mueven del
 * Toolbar derecha al Sidebar esquina superior IZQUIERDA — convención macOS
 * native canónica que el operador prefirió tras ver el resultado original.
 * El cluster vive `absolute left-3 top-3 z-10` sobre el BrandHeader (que
 * mantiene su centrado byte-exact). Cero overlap visual: el BrandHeader
 * tiene `h-[44px]` con padding interno, y el cluster (12px diameter × 3 +
 * gaps = ~52px ancho × 12px alto) cabe holgadamente a la izquierda del
 * texto "AIOS" centered. Los traffic lights son child del `<aside>` con
 * `position: relative`, así que el `absolute` posiciona dentro del sidebar
 * sin escaparse.
 */
export function Sidebar() {
  const [mode, setMode] = useShellMode()
  const [signoutOpen, setSignoutOpen] = useState(false)

  return (
    <aside
      className="liquid-glass-regular hairline-r relative flex h-full flex-col pb-3"
      style={glassRegular}
      aria-label="Mission Control navigation"
    >
      <div className="absolute left-3 top-4 z-10">
        <TrafficLights
          mode={mode}
          onChangeMode={setMode}
          onClose={() => setSignoutOpen(true)}
        />
      </div>

      <BrandHeader />
      <div className="flex flex-1 flex-col gap-1 overflow-auto px-2.5 pt-2">
        {SIDEBAR_SECTIONS.map((section, idx) => (
          <SidebarSection key={section.label || `section-${idx}`} label={section.label}>
            {section.items.map((item) => (
              <SidebarItem
                key={item.href}
                label={item.label}
                href={item.href}
                icon={item.icon}
                count={item.count}
              />
            ))}
          </SidebarSection>
        ))}
      </div>

      <SignoutConfirmDialog
        open={signoutOpen}
        onClose={() => setSignoutOpen(false)}
      />
    </aside>
  )
}
