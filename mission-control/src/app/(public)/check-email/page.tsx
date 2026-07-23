import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="flex h-dvh w-screen items-center justify-center p-6">
      <div
        className="liquid-glass-thick w-full max-w-[420px] p-8 text-center"
        style={{
          borderRadius: 'var(--r-window-sm)',
          boxShadow: 'var(--shadow-window)',
        }}
      >
        <p
          className="text-title2"
          style={{ color: 'var(--label-primary)' }}
        >
          Revisa tu correo
        </p>
        <p
          className="mt-2 text-body"
          style={{ color: 'var(--label-secondary)' }}
        >
          Te enviamos un link. Abrelo en este mismo dispositivo para entrar a Gannet OS.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-callout"
          style={{ color: 'var(--accent)' }}
        >
          Volver a empezar
        </Link>
      </div>
    </div>
  )
}
