# Anti-patrones visuales

## Gradients estridentes

❌ Gradients con saturacion alta (`from-purple-600 to-pink-600`) gritan "plantilla generica". Son el equivalente visual de Comic Sans.

✓ Gradients sutiles que el ojo registra como acento, no como protagonista. La paleta YOUR_COMMUNITY `linear-gradient(135deg, #0a84ff 0%, #00d9ff 100%)` se siente premium porque el azul-cyan es heritage Apple.

## Glassmorphism abusado

❌ Cada card con `backdrop-blur-xl` y semi-transparencia. Hace el contenido ilegible.

✓ Glassmorphism solo en superficies elevadas (modal, tooltip, popover) o navbar fijo sobre contenido. Maximo 1-2 elementos por vista. Usar `backdrop-blur-md` (12px) — `xl` (24px) es siempre demasiado.

## Overuse de iconos

❌ Cada label con icono al lado, cada boton con icono, cada item de lista con bullet de icono. El ojo se cansa.

✓ Iconos solo cuando ahorran palabras (acciones unicas como "guardar", "eliminar") o navegacion (sidebar). Texto solo basta en la mayoria de casos.

## Sombras excesivas

❌ `shadow-2xl` en cada card. La pagina parece con baja gravedad.

✓ Sombra mas grande = mas elevacion percibida. Reservar `xl` para modales y popovers. Cards en grilla usan `praxis-soft` (subtle) o sin sombra (solo border).

## Tipografia mezclada

❌ H1 en serif, H2 en sans, body en mono. Caotico.

✓ Una familia tipografica para todo, variando solo weight (400, 600, 700). Mono solo para codigo o numeros tabulares (precios, contadores).

## Pluralizar buttons primarios

❌ Hero con 5 CTAs grandes ("Empezar", "Aprender mas", "Ver precios", "Demo", "Contacto"). Paralisis de decision.

✓ Un solo primary + uno o dos secondary maximo por vista. Los secundarios bajan el contraste para no competir.

## Empty states en blanco

❌ "No hay items" centrado en una pagina de 100% blanca. El usuario piensa que la app esta rota.

✓ Empty state con icono + frase explicativa + CTA para crear el primer item. Patron en `references/componentes.md`.

## Loading spinners full-screen

❌ Overlay con spinner cubriendo todo durante navegacion entre paginas. El usuario no sabe si la app respondio.

✓ Skeleton loaders que replican silueta del contenido + transicion suave. O barra de progreso top sutil estilo NProgress.

## Hover states ausentes

❌ Buttons que no cambian al hacer hover. El usuario duda si son clickeables.

✓ Cada elemento interactivo tiene 3 estados visibles: default, hover, active/pressed. Cambio puede ser sutil (color +5% brillo, lift 1px) — pero presente.

## Focus rings invisibles

❌ `outline-none` sin reemplazo. Catastrofico para accessibility (teclado, screen readers).

✓ `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-praxis-cyan-500`. Siempre visible al navegar con teclado.

## Modales sin escape

❌ Modal sin boton de cerrar visible, sin click-outside, sin Escape.

✓ shadcn/ui Dialog ya trae los tres. Mantener defaults.

## Texto sobre imagenes sin overlay

❌ Hero con foto de fondo + texto blanco directo. La legibilidad depende de cada imagen.

✓ Overlay oscuro (`bg-black/40` a `bg-black/60`) entre imagen y texto. O usar imagenes con composicion preparada para overlay de texto.
