import { LoginForm } from '@/features/auth/components/LoginForm'

const ERROR_COPY: Record<string, string> = {
  unauthorized: 'Acceso denegado. Tu cuenta no esta autorizada.',
  link_expired: 'El link expiro o ya se uso. Pide otro.',
  missing_code: 'El link no traia el codigo. Pide otro.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  const initialError = params.error ? ERROR_COPY[params.error] : undefined

  return (
    <div className="flex h-dvh w-screen items-center justify-center p-6">
      <div
        className="liquid-glass-thick w-full max-w-[420px] p-8"
        style={{
          borderRadius: 'var(--r-window-sm)',
          boxShadow: 'var(--shadow-window)',
        }}
      >
        <div className="mb-6 text-center">
          <p
            className="text-title2"
            style={{ color: 'var(--label-primary)' }}
          >
            Gannet OS · Mission Control
          </p>
          <p
            className="mt-1 text-body"
            style={{ color: 'var(--label-secondary)' }}
          >
            Te mandamos un link al correo para entrar.
          </p>
        </div>
        <LoginForm initialError={initialError} />
      </div>
    </div>
  )
}
