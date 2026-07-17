# Post-processing — sharp recipes

Sharp es la libreria canonica para procesar imagenes en Node. Todas las recipes asumen `import sharp from 'sharp'` y un `Buffer` de entrada.

## Resize manteniendo aspect ratio

```ts
const resized = await sharp(input)
  .resize(1200, 630, { fit: 'cover', position: 'center' })
  .toBuffer();
```

Modes:

- `cover`: llena el target, recorta lo que sobra (default para thumbnails).
- `contain`: respeta aspect ratio, agrega bordes (letterbox).
- `inside`: nunca aumenta, solo reduce manteniendo proporciones.
- `fill`: stretch (deformante, evitar).

## Convertir a WebP

```ts
const webp = await sharp(input).webp({ quality: 85 }).toBuffer();
```

Calidad recomendada por uso:

- Thumbnails landing: 80-85.
- Avatares: 75-80.
- Hero/fondo: 70-80.
- Iconos UI: 90+ (lossless con `lossless: true` cuando sea critico).

## Crop centrado

```ts
const cropped = await sharp(input)
  .extract({ left: 100, top: 100, width: 800, height: 800 })
  .toBuffer();
```

## Padding (extender canvas)

```ts
const padded = await sharp(input)
  .resize(900, 900) // primero achica al area interior
  .extend({
    top: 50, bottom: 50, left: 50, right: 50,
    background: { r: 10, g: 132, b: 255, alpha: 1 },
  })
  .toBuffer();
```

Util para iconos PWA maskable que necesitan safe zone alrededor.

## Watermark

```ts
const watermarked = await sharp(input)
  .composite([
    {
      input: 'public/watermark.png',
      gravity: 'southeast', // esquina inferior derecha
      blend: 'over',
    },
  ])
  .toBuffer();
```

## Round corners

Sharp no tiene rounded corners nativos. Workaround con SVG mask:

```ts
const radius = 24;
const { width, height } = await sharp(input).metadata();
const mask = Buffer.from(
  `<svg><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></svg>`,
);

const rounded = await sharp(input)
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer();
```

## Blur

```ts
const blurred = await sharp(input).blur(10).toBuffer();
```

Util para placeholders LQIP (Low Quality Image Placeholder).

## LQIP (placeholder mientras carga)

```ts
import { encode } from 'blurhash';

const { data, info } = await sharp(input)
  .raw()
  .ensureAlpha()
  .resize(32, 32, { fit: 'inside' })
  .toBuffer({ resolveWithObject: true });

const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
// blurhash es un string corto que reconstruye placeholder en el cliente
```

Cliente: `next/image` usa `placeholder="blur"` con `blurDataURL` o blurhash via libreria.

## Generar variantes responsive

```ts
const sizes = [320, 640, 1024, 1920];
for (const w of sizes) {
  await sharp(input).resize(w).webp().toFile(`out/image-${w}.webp`);
}
```

`<img srcset="image-320.webp 320w, image-640.webp 640w, ..." sizes="(max-width: 600px) 100vw, 50vw">`. Browser elige el optimo segun viewport y DPR.

## Optimizar PNG existente sin recompresion

```ts
import { optimize } from 'svgo'; // para SVG
import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';

await imagemin(['public/icons/*.png'], {
  destination: 'public/icons/optimized',
  plugins: [imageminPngquant({ quality: [0.8, 0.9] })],
});
```

Ahorro tipico: 50-70% del tamaño original sin perdida visible.
