'use client'

import { useEffect, useRef } from 'react'
import { signout } from '@/features/auth/actions'
import { Modal } from './Modal'

/**
 * PRP-036: extracted byte-exact desde el componente privado del antiguo
 * `SignoutButton.tsx` (PRP-035 pattern). El refactor es puramente físico —
 * lógica, copy y UX intactos. Reutilizable desde cualquier trigger del MC
 * que quiera disparar el flujo de sign-out.
 *
 * Consumers actuales:
 *   - `TrafficLights.tsx` (botón rojo del cluster del Toolbar).
 *   - `MobileToolbar` (versión compact del cluster que solo renderea el rojo).
 *
 * Modal canónico `role="alertdialog"` PRP-021/035, focus al cancel button
 * al abrir, submit del "Cerrar sesión" dispara la Server Action `signout`
 * que redirige a `/login`.
 */
export function SignoutConfirmDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (open) cancelButtonRef.current?.focus()
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Confirmar cierre de sesion"
      role="alertdialog"
      panelMaxWidth="360px"
      panelClassName="p-6 text-center"
    >
      <h2 className="text-title3" style={{ color: 'var(--label-primary)' }}>
        ¿Cerrar sesion?
      </h2>
      <p className="mt-2 text-body" style={{ color: 'var(--label-secondary)' }}>
        Tendras que volver a entrar con tu correo.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <button
          ref={cancelButtonRef}
          type="button"
          onClick={onClose}
          className="mc-interactive inline-flex h-8 min-w-[110px] items-center justify-center rounded-control px-4 text-body"
          style={{
            background: 'var(--fill-secondary)',
            color: 'var(--label-primary)',
            boxShadow: 'var(--shadow-control)',
          }}
        >
          Cancelar
        </button>
        <form action={signout}>
          <button
            type="submit"
            className="mc-interactive inline-flex h-8 min-w-[110px] items-center justify-center rounded-control px-4 text-body text-white"
            style={{
              background: 'var(--sys-red)',
              boxShadow: 'var(--shadow-control)',
            }}
          >
            Cerrar sesion
          </button>
        </form>
      </div>
    </Modal>
  )
}
