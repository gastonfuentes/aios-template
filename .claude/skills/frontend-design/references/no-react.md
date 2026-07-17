# Adaptacion: HTML estatico + Tailwind via CDN

Caso: el alumno quiere una landing pre-React, una pagina de mantenimiento, o un email-friendly preview HTML.

## Setup minimo

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tu pagina</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            'praxis-cyan': '#00d9ff',
            'praxis-blue': '#0a84ff',
          },
          backgroundImage: {
            'praxis-gradient': 'linear-gradient(135deg, #0a84ff 0%, #00d9ff 100%)',
          },
        },
      },
    };
  </script>
</head>
<body class="font-sans antialiased text-zinc-900">
  <main class="mx-auto max-w-4xl px-6 py-32 text-center">
    <h1 class="text-5xl font-bold tracking-tight">Tu pagina</h1>
    <p class="mt-6 text-xl text-zinc-600">Subtitulo descriptivo.</p>
    <button class="mt-10 rounded-lg bg-praxis-gradient px-6 py-3 text-white font-medium shadow-lg transition-all hover:-translate-y-px">
      Empezar
    </button>
  </main>
</body>
</html>
```

## Limitaciones

- Tailwind CDN esta optimizado para prototipos, no para produccion. En produccion usar build-time con `npm install tailwindcss + npx tailwindcss --minify`.
- Sin shadcn/ui — replicar componentes manualmente con clases utility.
- Sin theme dark automatico — agregar clase `.dark` manual + JS para toggle.

## Cuando usar

- Pagina de "en construccion" mientras montas la app.
- Landing simple sin interactividad pre-React.
- Email preview en navegador.
- Demos one-shot sin dependencias.

Si la pagina crece a >1 ruta o necesita logica, migrar a Next.js — Praxis ya trae el scaffold.
