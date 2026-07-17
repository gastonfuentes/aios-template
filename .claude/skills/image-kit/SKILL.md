---
name: image-kit
description: "Genera y edita imagenes desde texto via OpenRouter (Gemini 2.0 Flash, Imagen 3, etc.). Pipeline completo: generar → comprimir a WebP → upload a Supabase Storage → URL lista. Incluye casos de uso del alumno YOUR_COMMUNITY: thumbnail de tu primera landing, avatar para tu producto, screenshot para README, icons para PWA. Activar cuando el usuario menciona generar imagen, crear thumbnail, banner, logo, ilustracion, foto de producto, image generation, AI imagery, o pide 'hazme una imagen de X'."
allowed-tools: Read, Write, Edit, Bash
---

# image-kit — generacion + post-procesamiento integrado

> No es un wrapper de un script — es un pipeline: generar → optimizar → publicar. Salida lista para usar en tu app, no PNG suelto.

---

## Cuando activar

- "Generame un thumbnail para mi landing."
- "Necesito un avatar / banner / logo."
- "Crea una imagen de [X] para mi producto."
- "Edita esta foto y agrega [Y]."
- "Iconos para mi PWA."

## Cuando NO activar

- Edicion fotorealista pixel-perfect. Usar Photoshop / Affinity / Pixelmator manualmente.
- Generar texto largo en imagen. Los modelos de imagen siguen siendo limitados con texto > 5 palabras — escalar a Figma / Canva.
- Solo necesitas un icon de libreria (Heroicons, Lucide). Eso es busqueda, no generacion.

## Antes de empezar — verifica empiricamente

- [ ] `OPENROUTER_API_KEY` en `.env.local` (cross-ref `ai-sdk-kit/references/setup-openrouter.md`).
- [ ] `npm install sharp @supabase/supabase-js` instalado (post-process + storage).
- [ ] Si el flujo termina en Storage: `auth-stack` + bucket `assets` o `avatars` configurado.
- [ ] Decidir caso de uso para elegir modelo + tamaño correctos.

## Casos de uso (con prompts canonicos)

### Caso 1: thumbnail de tu landing

Modelo recomendado: `google/gemini-2.0-flash-exp:free` o `google/gemini-image-generation`.

```ts
// scripts/generate-image.ts
import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

const result = await generateText({
  model: openrouter('google/gemini-2.0-flash-exp:free'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Crea un thumbnail horizontal 1200x630 para una landing de un curso de Vibe Coding.
Estilo: minimalista premium tipo Stripe, gradient cyan-azul (no purple), fondo oscuro.
Sin texto en la imagen.`,
        },
      ],
    },
  ],
  // El modelo devuelve image como part del response
});

// Extraer la imagen del response (depende del provider response shape)
const imagePart = result.response.messages
  .flatMap((m) => m.content)
  .find((p) => p.type === 'image');

if (imagePart) {
  await fs.writeFile('public/landing-thumbnail.png', Buffer.from(imagePart.image, 'base64'));
}
```

### Caso 2: avatar default para profiles

```ts
const prompt = `
Avatar circular minimalista para un curso online.
Inicial "${userName.charAt(0).toUpperCase()}" centrada.
Background: gradient azul-cyan.
Sin elementos extras.
Tamaño: 256x256.
`;
```

### Caso 3: screenshot ilustrativo para README

Para apps que aun no tienen captura real (pre-launch):

```ts
const prompt = `
Mockup de dashboard de una app SaaS estilo Linear.
Sidebar oscuro a la izquierda, contenido principal con cards.
Tipografia sans-serif.
Datos placeholder realistas (numeros, nombres genericos).
Resolucion: 1600x1000.
Sin watermarks ni branding visible.
`;
```

### Caso 4: icons PWA (192, 512, 512-maskable)

Cross-ref `@.claude/skills/pwa-mobile/references/icons-checklist.md`. Generar primero el icon de 1024 y derivar los demas:

```ts
import sharp from 'sharp';

// 1. Generar source 1024x1024 con AI
const buffer = await generateImage({ prompt: '...', size: '1024x1024' });
await fs.writeFile('public/icons/source-1024.png', buffer);

// 2. Resize a las 3 variantes
await sharp(buffer).resize(192, 192).toFile('public/icons/icon-192.png');
await sharp(buffer).resize(512, 512).toFile('public/icons/icon-512.png');
await sharp(buffer)
  .resize(512, 512)
  .extend({ // padding para maskable safe zone
    top: 51, bottom: 51, left: 51, right: 51,
    background: { r: 10, g: 132, b: 255, alpha: 1 }, // praxis-blue
  })
  .resize(512, 512)
  .toFile('public/icons/icon-512-maskable.png');
```

## Pipeline canonico: generate → optimize → upload

```ts
// src/lib/image/pipeline.ts
import sharp from 'sharp';
import { createServiceClient } from '@/lib/supabase/admin';

export async function generateAndPublish(opts: {
  prompt: string;
  bucket: 'avatars' | 'assets';
  userId: string;
  filename: string; // sin extension
  width?: number;
  quality?: number;
}) {
  // 1. Generar
  const rawBuffer = await generateImageRaw(opts.prompt);

  // 2. Optimizar a WebP (60-80% mas chico que PNG sin perdida visible)
  const optimized = await sharp(rawBuffer)
    .resize(opts.width ?? 1200, undefined, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: opts.quality ?? 85 })
    .toBuffer();

  // 3. Upload a Supabase Storage
  const supabase = createServiceClient();
  const path = `${opts.userId}/${opts.filename}.webp`;

  const { data, error } = await supabase.storage
    .from(opts.bucket)
    .upload(path, optimized, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (error) throw error;

  // 4. Devolver URL publica o signed
  const { data: { publicUrl } } = supabase.storage.from(opts.bucket).getPublicUrl(path);
  return publicUrl;
}
```

Razon de WebP: 60-80% mas chico que PNG con calidad equivalente. Soportado por todos los browsers modernos. Reduce CDN bills + tiempo de carga.

## Si tu Directiva no es Next.js/Supabase

- Solo backend Node sin Storage: el pipeline corre igual, output local en disco.
- Otra db de blobs (R2, S3): cambiar el client de upload, mismo pipeline.
- Sin AI provider: usar modelos locales (Stable Diffusion via comfyui o Replicate API). El compose stays igual.

## Cross-references con skills hermanas

- `@.claude/skills/auth-stack/SKILL.md` — avatares de profiles. Hand-off: `profiles.avatar_url` se actualiza con el output del pipeline.
- `@.claude/skills/pwa-mobile/SKILL.md` — generar los 3 icons del manifest desde una source. Cross-ref `references/icons-checklist.md` de esa skill.
- `@.claude/skills/web-3d/SKILL.md` — assets de la landing scroll-driven (background, hero image, product shots).
- `@.claude/skills/playwright-cli/SKILL.md` — thumbnails comparativos before/after en reportes de regression visual. Hand-off: el reporter llama el pipeline para generar el side-by-side.
- `@.claude/skills/supabase-admin/SKILL.md` — bucket policies para `avatars` y `assets`.

## Archivos lazy-loaded

- `references/prompts-canonicos.md` — biblioteca de prompts probados para cada caso de uso.
- `references/post-processing.md` — sharp recipes (resize, crop, watermark, format conversion).
- `references/storage-policies.md` — RLS para buckets de imagenes (publico vs privado).
- `references/cost-comparison.md` — comparativa de modelos (Gemini Flash free, Imagen 3 paid, Stable Diffusion local).
- `scripts/generate.ts` — script CLI para generar desde terminal.
- `scripts/optimize-batch.sh` — bulk WebP de un directorio.

## Validacion al cerrar

- [ ] Imagen generada se guarda como WebP con peso razonable (<300KB para 1200x630).
- [ ] Storage upload retorna URL accesible.
- [ ] Si es avatar: aparece en el componente que lee `profiles.avatar_url` sin 404.
- [ ] Pipeline maneja errores: si el modelo falla, fallback a placeholder o retry.
