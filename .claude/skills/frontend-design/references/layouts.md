# Layouts canonicos

## Dashboard 2-column con sidebar

```tsx
<div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
  <aside className="w-64 border-r border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
    <Logo />
    <nav className="mt-8 space-y-1">
      <NavItem href="/dashboard" icon={Home}>Inicio</NavItem>
      <NavItem href="/lessons" icon={BookOpen}>Lecciones</NavItem>
      <NavItem href="/students" icon={Users}>Alumnos</NavItem>
      <NavItem href="/settings" icon={Settings}>Ajustes</NavItem>
    </nav>
  </aside>
  <main className="flex-1 p-8">
    <header className="mb-8 flex items-center justify-between">
      <h1 className="text-3xl font-bold">Tu dashboard</h1>
      <Button variant="primary">Nueva leccion</Button>
    </header>
    <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* cards */}
    </section>
  </main>
</div>
```

## Settings 3-pane

```tsx
<div className="mx-auto max-w-6xl p-8">
  <h1 className="mb-8 text-3xl font-bold">Ajustes</h1>
  <div className="grid grid-cols-12 gap-8">
    <nav className="col-span-3 space-y-1">
      <SettingsNavItem active>Perfil</SettingsNavItem>
      <SettingsNavItem>Cuenta</SettingsNavItem>
      <SettingsNavItem>Notificaciones</SettingsNavItem>
      <SettingsNavItem>Facturacion</SettingsNavItem>
    </nav>
    <main className="col-span-9 space-y-8">
      <Section title="Tu perfil">
        <Input label="Nombre" />
        <Input label="Email" disabled />
      </Section>
    </main>
  </div>
</div>
```

## Landing hero centered

```tsx
<main className="relative min-h-screen overflow-hidden">
  <div className="absolute inset-0 bg-praxis-gradient opacity-10" aria-hidden />
  <div className="relative mx-auto max-w-4xl px-6 py-32 text-center">
    <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
      Construye tu primer SaaS sin pelearte con setup.
    </h1>
    <p className="mt-6 text-xl text-zinc-600 dark:text-zinc-400">
      Praxis te da el stack completo en menos de un minuto.
    </p>
    <div className="mt-10 flex justify-center gap-4">
      <Button variant="primary" size="lg">Empezar gratis</Button>
      <Button variant="secondary" size="lg">Ver demo</Button>
    </div>
  </div>
</main>
```

## Signup centered narrow

```tsx
<div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
  <div className="w-full max-w-md">
    <Logo className="mx-auto h-10" />
    <Card className="mt-8">
      <h1 className="text-2xl font-semibold">Bienvenido</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Ingresa tu email para recibir el enlace de acceso.
      </p>
      <SigninForm className="mt-6" />
    </Card>
    <p className="mt-6 text-center text-xs text-zinc-500">
      Al continuar aceptas nuestros{' '}
      <a href="/terms" className="underline">terminos</a>.
    </p>
  </div>
</div>
```

## Error page (404, 500)

```tsx
<div className="flex min-h-screen items-center justify-center p-4">
  <div className="text-center">
    <h1 className="text-7xl font-bold text-zinc-300 dark:text-zinc-700">404</h1>
    <h2 className="mt-4 text-2xl font-semibold">Pagina no encontrada</h2>
    <p className="mt-2 text-zinc-600 dark:text-zinc-400">
      El link que seguiste expiro o nunca existio.
    </p>
    <Button as="a" href="/" className="mt-6">Volver al inicio</Button>
  </div>
</div>
```
