// Composer del icono fuente AIOS: aplica el clip squircle macOS 26 sobre el diseño
// original del operador, PRESERVANDO byte-exacto su background (gradient + brand mark
// + cualquier composición que el operador haya construido).
//
// Lee:  public/brand-mark-source.png (diseño completo del operador, fuente humana editable).
// Output:
//   - public/icon-aios.png          (clipped al squircle macOS 26 radius 22% — para favicon/PWA/apple-touch)
//   - public/icon-aios-fullbleed.png (sin clipping, source as-is — para maskable Android)
//
// Mecánica: sharp composite blend="dest-in" con una máscara SVG que es un squircle
// blanco sobre transparente. dest-in conserva solo los pixels del source donde la máscara
// es opaca → recorta los rincones del squircle. El background del operador NO se modifica.
//
// Re-run idempotente: misma fuente = bytes idénticos.

import { readFile, writeFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', 'public')
const SOURCE = join(PUBLIC_DIR, 'brand-mark-source.png')

const SIZE = 1024
// DS macOS 26: border-radius 22% del lado para el squircle canonical.
const SQUIRCLE_RADIUS_RATIO = 0.22

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')

async function buildSquircleMask() {
  const r = Math.round(SIZE * SQUIRCLE_RADIUS_RATIO)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${r}" ry="${r}" fill="white"/>
</svg>`
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, force: true }).toBuffer()
}

async function main() {
  try {
    await readFile(SOURCE)
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error(`Falta ${SOURCE}.`)
      console.error('Pegar el diseño completo del icono (1024×1024 o redimensionable, con su propio background si la marca lo requiere) y re-ejecutar.')
      process.exit(1)
    }
    throw e
  }

  const meta = await sharp(SOURCE).metadata()
  console.log(`Source: ${meta.width}x${meta.height} ${meta.format} alpha=${meta.hasAlpha}`)

  // Normalizar a 1024×1024 con cover (preserva proporciones si la fuente ya es cuadrada).
  const sourceBuf = await sharp(SOURCE)
    .resize(SIZE, SIZE, { fit: 'cover', kernel: 'lanczos3' })
    .ensureAlpha()
    .png({ compressionLevel: 9, force: true })
    .toBuffer()

  console.log('Aplicando clip squircle macOS 26 (radius 22%) sobre el diseño original:')

  // Squircle baked: el clip recorta los rincones, dejando solo la silueta squircle del original.
  const mask = await buildSquircleMask()
  const squircle = await sharp(sourceBuf)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9, force: true })
    .toBuffer()

  await writeFile(join(PUBLIC_DIR, 'icon-aios.png'), squircle)
  const ss = await stat(join(PUBLIC_DIR, 'icon-aios.png'))
  console.log(`  icon-aios.png            ${SIZE}x${SIZE}  ${String(ss.size).padStart(8)} bytes  sha1=${sha1(squircle).slice(0, 12)}  (squircle baked)`)

  // Fullbleed: source as-is para maskable Android (sin clipping).
  await writeFile(join(PUBLIC_DIR, 'icon-aios-fullbleed.png'), sourceBuf)
  const sf = await stat(join(PUBLIC_DIR, 'icon-aios-fullbleed.png'))
  console.log(`  icon-aios-fullbleed.png  ${SIZE}x${SIZE}  ${String(sf.size).padStart(8)} bytes  sha1=${sha1(sourceBuf).slice(0, 12)}  (sin squircle)`)

  console.log('Done. Background del operador preservado byte-exacto.')
}

await main()
