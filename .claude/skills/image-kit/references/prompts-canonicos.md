# Prompts canonicos por caso de uso

Biblioteca de prompts probados. Adaptar variables (entre `{}`) segun el contexto del alumno.

## Thumbnails de landing

### Curso / membresia

```
Thumbnail horizontal 1200x630 para landing de un curso de {tema}.
Estilo: minimalista premium tipo Stripe/Apple, gradient azul-cyan vibrante, fondo oscuro.
Composicion: elemento central solitario con halo de luz sutil.
Sin texto en la imagen.
Tipografia: ninguna.
Mood: profesional, accesible, no corporativo.
```

### Producto SaaS

```
Hero image horizontal 1600x900 para SaaS de {categoria}.
Estilo: dashboard mockup en perspectiva isometrica leve.
Paleta: dark mode con acento azul-cyan.
Sin datos sensibles ni nombres de personas reales.
Resolucion: alta densidad, suitable for retina.
```

## Avatares

### Default initials

```
Avatar circular 256x256 para usuario de app educativa.
Inicial "{letter}" centrada, tipografia Inter Bold.
Background: gradient azul-cyan (135deg, #0a84ff a #00d9ff).
Texto: blanco puro.
Sin elementos extras, sin border, sin shadow.
```

### Avatar profesional

```
Retrato profesional cabeza-hombros, fondo neutral gris claro.
Estilo: corporate friendly, iluminacion suave.
Composicion: persona mirando ligeramente fuera de camara.
Tono: cercano sin ser informal.
NO incluir: texto, logos, watermarks.
Resolucion: 512x512 cuadrado.
```

## Iconos para apps

### Icon principal PWA (1024x1024 source)

```
Icon de app cuadrado 1024x1024.
Concepto: {abstraccion-del-producto}.
Estilo: flat geometric, iOS app icon vibe.
Colores: max 3 (azul-cyan + blanco + 1 accent opcional).
Padding interior: ~10% en cada borde.
Background: solido (no transparente).
Sin texto en el icon.
```

### Favicon

```
Favicon 32x32 simple y reconocible al tamaño minimo.
Concepto: monograma con la inicial "{letter}".
Estilo: solido, alto contraste.
Background: cyan #00d9ff o azul #0a84ff.
Letra: blanco.
```

## Backgrounds / textures

### Hero background abstracto

```
Background abstracto 1920x1080 para hero de landing.
Estilo: gradient mesh con suavidad, mood premium.
Paleta: azul oscuro (#0a0a0a) con acentos cyan (#00d9ff) en gradient organico.
NO incluir: figuras geometricas, texto, productos.
Resultado: fondo sutil que no compite con texto encima.
```

### Pattern repetible

```
Pattern repetible 256x256 (tilable) para texturas sutiles.
Estilo: dots o noise muy ligero, opacity ~5%.
Color: blanco sobre transparente.
Resultado: textura que da profundidad sin ser visible directo.
```

## Mockups / screenshots

### Dashboard placeholder

```
Mockup de dashboard SaaS estilo Linear o Stripe.
Layout: sidebar oscuro a la izquierda con icons + main area con cards de metricas.
Paleta: dark mode con acentos cyan.
Datos placeholder realistas pero genericos.
Sin nombres de personas reales.
Sin datos sensibles.
Resolucion: 1600x1000.
```

### Mobile app mockup

```
iPhone mockup vertical 750x1500 mostrando app de educacion.
Pantalla: home con feed de lecciones.
Paleta: dark mode con cards translucidas.
Status bar: iOS 17 style.
Sin datos sensibles.
Sin marcas reales en el mockup.
```

## Post-processing notes

Cualquier prompt anterior se puede mejorar al final con:

```
Output requirements:
- Format: PNG with transparent background where applicable
- Color profile: sRGB
- No compression artifacts
- High detail and sharpness
```

## Anti-patterns en prompts

❌ Prompts ambiguos: "una imagen bonita". El modelo elige random.
❌ Demasiados estilos mezclados: "minimalista pero detallado, fotografico pero ilustrado". Confunde.
❌ Pedir texto largo: "incluye el lema 'Construye tu primer SaaS sin pelearte con setup'". Casi siempre sale mal.
❌ Marcas reales: "estilo Apple Watch face". Riesgo legal + mediocre output.

✓ Especificos sobre composicion, paleta, mood.
✓ Mencionar dimensiones desde el principio.
✓ Excluir explicitamente lo que no quieres.
