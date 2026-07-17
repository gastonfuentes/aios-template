#!/usr/bin/env tsx
/**
 * CLI para generar imagenes desde la terminal.
 * Uso: tsx scripts/generate.ts "tu prompt aqui" --output public/out.webp --width 1200
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import sharp from 'sharp';
import * as fs from 'node:fs/promises';

const args = process.argv.slice(2);
const prompt = args[0];
const outputIdx = args.indexOf('--output');
const widthIdx = args.indexOf('--width');
const modelIdx = args.indexOf('--model');

if (!prompt) {
  console.error('Uso: tsx scripts/generate.ts "<prompt>" [--output path] [--width 1200] [--model provider/model]');
  process.exit(1);
}

const output = outputIdx >= 0 ? args[outputIdx + 1] : 'output.webp';
const width = widthIdx >= 0 ? parseInt(args[widthIdx + 1]) : 1200;
const modelName = modelIdx >= 0 ? args[modelIdx + 1] : 'google/gemini-2.0-flash-exp:free';

if (!process.env.OPENROUTER_API_KEY) {
  console.error('Falta OPENROUTER_API_KEY en el entorno.');
  process.exit(1);
}

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

console.log(`Generando con ${modelName}...`);

const result = await generateText({
  model: openrouter(modelName),
  messages: [{ role: 'user', content: prompt }],
});

// Extraer la imagen del response
const imagePart = result.response.messages
  .flatMap((m) => (Array.isArray(m.content) ? m.content : [m.content]))
  .find((p): p is { type: 'image'; image: string } =>
    typeof p === 'object' && p !== null && 'type' in p && (p as { type: string }).type === 'image',
  );

if (!imagePart) {
  console.error('El modelo no devolvio imagen. Output:', result.text);
  process.exit(1);
}

const rawBuffer = Buffer.from(imagePart.image, 'base64');

// Optimizar a WebP
const optimized = await sharp(rawBuffer)
  .resize(width, undefined, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85 })
  .toBuffer();

await fs.writeFile(output, optimized);

const stats = await fs.stat(output);
console.log(`Listo: ${output} (${(stats.size / 1024).toFixed(1)}KB)`);
