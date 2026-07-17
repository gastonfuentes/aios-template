// Pipeline de generación de íconos del Mission Control.
// Fuentes canónicas:
//   - public/icon-aios.png          (squircle macOS 26 baked, fuente para 5 variantes web/macOS/iOS)
//   - public/icon-aios-fullbleed.png (gradient fullbleed sin squircle, fuente para maskable Android)
// Ambas producidas por `npm run icons:source` desde public/brand-mark.png + template macOS 26.
// Re-run idempotente.
// Variantes emitidas: favicon.ico (16/32/48), icon-32.png, icon-192.png,
// icon-512.png, icon-512-maskable.png, apple-touch-icon.png.

import { readFile, writeFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', 'public')
const SOURCE = join(PUBLIC_DIR, 'icon-aios.png')
const MASKABLE_SOURCE = join(PUBLIC_DIR, 'icon-aios-fullbleed.png')

const MASKABLE_PADDING_RATIO = 0.125

async function probeSource(path = SOURCE, label = 'icon-aios.png') {
  const buf = await readFile(path)
  const img = sharp(buf)
  const meta = await img.metadata()

  if (!meta.width || !meta.height) {
    throw new Error(`${label}: no se pudo leer dimensiones`)
  }
  if (meta.width !== meta.height) {
    throw new Error(`${label} debe ser cuadrado; encontrado ${meta.width}x${meta.height}`)
  }
  if (meta.width < 512) {
    throw new Error(`${label} debe ser >= 512px; encontrado ${meta.width}x${meta.width}`)
  }

  let opaqueRatio = 1
  let maskablePadding = 0
  if (meta.hasAlpha) {
    const alpha = await sharp(buf).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true })
    const { data, info } = alpha
    let minX = info.width, minY = info.height, maxX = -1, maxY = -1
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[y * info.width + x] > 8) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX >= 0) {
      const bboxW = maxX - minX + 1
      const bboxH = maxY - minY + 1
      opaqueRatio = Math.max(bboxW, bboxH) / info.width
      const inherentPadding = Math.min(minX, minY, info.width - 1 - maxX, info.height - 1 - maxY) / info.width
      if (inherentPadding < MASKABLE_PADDING_RATIO) {
        maskablePadding = MASKABLE_PADDING_RATIO
      }
    }
  } else {
    maskablePadding = MASKABLE_PADDING_RATIO
  }

  return { buf, meta, opaqueRatio, maskablePadding }
}

async function emitResize(buf, size, outName) {
  const out = join(PUBLIC_DIR, outName)
  await sharp(buf).resize(size, size, { fit: 'contain', kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(out)
  const s = await stat(out)
  return { name: outName, size, bytes: s.size }
}

async function emitMaskable(buf, size, outName, paddingRatio) {
  const out = join(PUBLIC_DIR, outName)
  if (paddingRatio === 0) {
    return emitResize(buf, size, outName)
  }
  const innerSize = Math.round(size * (1 - paddingRatio * 2))
  const offset = Math.round((size - innerSize) / 2)
  const inner = await sharp(buf).resize(innerSize, innerSize, { fit: 'contain', kernel: 'lanczos3' }).png().toBuffer()
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: inner, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(out)
  const s = await stat(out)
  return { name: outName, size, bytes: s.size, paddingRatio }
}

async function emitFavicon(buf) {
  const sizes = [16, 32, 48]
  const buffers = await Promise.all(
    sizes.map((s) => sharp(buf).resize(s, s, { fit: 'contain', kernel: 'lanczos3' }).png().toBuffer())
  )
  const ico = await pngToIco(buffers)
  const out = join(PUBLIC_DIR, 'favicon.ico')
  await writeFile(out, ico)
  const s = await stat(out)
  return { name: 'favicon.ico', sizes, bytes: s.size }
}

async function main() {
  console.log(`[generate-icons] source: ${SOURCE}`)
  const { buf, meta, opaqueRatio } = await probeSource(SOURCE, 'icon-aios.png')
  console.log(
    `[generate-icons] probe squircle: ${meta.width}x${meta.height} ${meta.format} alpha=${meta.hasAlpha} ` +
      `opaqueRatio=${opaqueRatio.toFixed(3)}`
  )

  console.log(`[generate-icons] maskable source: ${MASKABLE_SOURCE}`)
  const { buf: maskBuf, meta: maskMeta } = await probeSource(MASKABLE_SOURCE, 'icon-aios-fullbleed.png')
  console.log(
    `[generate-icons] probe fullbleed: ${maskMeta.width}x${maskMeta.height} ${maskMeta.format} alpha=${maskMeta.hasAlpha}`
  )

  // La fuente fullbleed ya trae el glyph dentro de la safe-zone (GLYPH_SAFE_FRACTION=0.62 < 0.75
  // canonical Android maskable). Resize directo sin padding adicional preserva el gradient
  // hasta los bordes para que el adaptive icon de Android no muestre transparencia.
  const results = []
  results.push(await emitResize(buf, 32, 'icon-32.png'))
  results.push(await emitResize(buf, 192, 'icon-192.png'))
  results.push(await emitResize(buf, 512, 'icon-512.png'))
  results.push(await emitResize(maskBuf, 512, 'icon-512-maskable.png'))
  results.push(await emitResize(buf, 180, 'apple-touch-icon.png'))
  results.push(await emitFavicon(buf))

  for (const r of results) {
    console.log(`[generate-icons] wrote ${r.name} (${r.bytes} bytes)`)
  }
  console.log('[generate-icons] done')
}

main().catch((err) => {
  console.error('[generate-icons] FATAL:', err.message)
  process.exit(1)
})
