# Componentes premium

## Card

```tsx
<div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-praxis-soft dark:border-zinc-800 dark:bg-zinc-900">
  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Titulo</h3>
  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Descripcion sutil.</p>
</div>
```

## Button primary (gradient)

```tsx
<button className="
  inline-flex items-center justify-center gap-2
  rounded-lg px-4 py-2.5 text-sm font-medium text-white
  bg-praxis-gradient
  shadow-praxis-md
  transition-all duration-150
  hover:shadow-praxis-lg hover:-translate-y-px
  active:scale-[0.98]
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-praxis-cyan-500
  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
">
  Continuar
</button>
```

## Button secondary

```tsx
<button className="
  inline-flex items-center justify-center gap-2
  rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900
  hover:bg-zinc-50 active:scale-[0.98]
  dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800
  transition-all duration-150
">
  Cancelar
</button>
```

## Input con label arriba

```tsx
<div className="flex flex-col gap-1.5">
  <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
    Email
  </label>
  <input
    id="email"
    type="email"
    className="
      rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm
      placeholder:text-zinc-400
      focus:border-praxis-cyan-500 focus:outline-none focus:ring-2 focus:ring-praxis-cyan-500/20
      dark:border-zinc-700 dark:bg-zinc-900
    "
  />
</div>
```

## Empty state

```tsx
<div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
  <Inbox className="h-12 w-12 text-zinc-400" />
  <h3 className="mt-4 text-lg font-semibold">No hay resultados aun</h3>
  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
    Cuando crees tu primera leccion aparecera aqui.
  </p>
  <button className="mt-6 ...">Crear leccion</button>
</div>
```

## Loading skeleton

```tsx
<div className="space-y-3">
  <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
  <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
  <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
</div>
```

Razon: skeleton replica la silueta del contenido final, reduciendo "tiempo percibido". Spinner overlay full-screen es alternativa peor — el usuario no sabe si el sistema esta congelado.

## Error state

```tsx
<div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
  <p className="text-sm font-medium text-red-900 dark:text-red-100">No pude cargar tus datos.</p>
  <p className="mt-1 text-sm text-red-800 dark:text-red-200">
    Revisa tu conexion y vuelve a intentar.
  </p>
  <button className="mt-3 text-sm font-medium text-red-900 underline dark:text-red-100">
    Reintentar
  </button>
</div>
```

## Toast (con sonner)

```tsx
import { toast } from 'sonner';

toast.success('Guardado', { description: 'Tu leccion esta publicada.' });
toast.error('Algo fallo', { description: 'Vuelve a intentar.' });
```

Configurar Sonner en `app/layout.tsx`:

```tsx
import { Toaster } from 'sonner';

<Toaster theme="system" position="top-right" richColors closeButton />
```
