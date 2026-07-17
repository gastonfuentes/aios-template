#!/usr/bin/env node
/**
 * PRP-034 Sub-fase 4: persiste un .excalidraw JSON a `public.draw_canvases`
 * Supabase (service-role bypass-RLS) e invoca `POST /open-url` del daemon
 * para abrir la URL del canvas en pestaña del browser.
 *
 * Uso:
 *   node scripts/save_to_mc.mjs <ruta-al-json> [--title "Diagrama X"] [--target host|push|both]
 *
 * Env requeridas:
 *   MC_SUPABASE_URL, MC_SUPABASE_SERVICE_ROLE
 *   OPENCLAW_GATEWAY_TOKEN
 *   AGENT_URL (default http://127.0.0.1:3099)
 *   MC_BASE_URL (default https://YOUR_MC_PUBLIC_URL)
 *
 * Lee env de `agent-server/.env` automáticamente si no están en process.env.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../..')

function readEnvFile(path) {
  if (!existsSync(path)) return {}
  const content = readFileSync(path, 'utf-8')
  const out = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const fileEnv = readEnvFile(resolve(REPO_ROOT, 'agent-server/.env'))

function env(name, fallback = '') {
  return process.env[name] ?? fileEnv[name] ?? fallback
}

const SUPABASE_URL = env('MC_SUPABASE_URL')
const SERVICE_ROLE = env('MC_SUPABASE_SERVICE_ROLE')
const GATEWAY_TOKEN = env('OPENCLAW_GATEWAY_TOKEN')
const AGENT_URL = env('AGENT_URL', 'http://127.0.0.1:3099')
const MC_BASE_URL = env('MC_BASE_URL', 'https://YOUR_MC_PUBLIC_URL')

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    'Error: MC_SUPABASE_URL + MC_SUPABASE_SERVICE_ROLE requeridos. Cárgalos en agent-server/.env.',
  )
  process.exit(1)
}

// ─── Parse args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
let jsonPath = null
let title = null
let target = 'host'

for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--title' && args[i + 1]) {
    title = args[++i]
  } else if (a === '--target' && args[i + 1]) {
    target = args[++i]
  } else if (!a.startsWith('--')) {
    jsonPath = a
  }
}

if (!jsonPath) {
  console.error('Uso: node save_to_mc.mjs <ruta.excalidraw> [--title "Foo"] [--target host|push|both]')
  process.exit(1)
}

const fullPath = resolve(jsonPath)
if (!existsSync(fullPath)) {
  console.error(`Archivo no existe: ${fullPath}`)
  process.exit(1)
}

const raw = readFileSync(fullPath, 'utf-8')
let parsed
try {
  parsed = JSON.parse(raw)
} catch (err) {
  console.error(`JSON inválido: ${err.message}`)
  process.exit(1)
}

if (!Array.isArray(parsed.elements)) {
  console.error('JSON no tiene `elements: []` — no es un .excalidraw válido')
  process.exit(1)
}

const finalTitle = title ?? basename(fullPath, '.excalidraw')

// ─── Step 1: get owner_id (único profile en AIOS single-operator) ───────────

async function fetchOwnerId() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  })
  if (!res.ok) throw new Error(`profiles fetch failed: ${res.status}`)
  const rows = await res.json()
  if (!rows[0]?.id) throw new Error('no profile found in profiles')
  return rows[0].id
}

// ─── Step 2: INSERT a draw_canvases ──────────────────────────────────────────

async function insertCanvas(ownerId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/draw_canvases`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      title: finalTitle,
      elements: parsed.elements,
      app_state: parsed.appState ?? {},
      files: parsed.files ?? {},
      owner_id: ownerId,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`insert failed (${res.status}): ${err}`)
  }
  const rows = await res.json()
  return rows[0]
}

// ─── Step 3: POST /open-url al daemon ────────────────────────────────────────

async function openInBrowser(canvasUrl) {
  if (!GATEWAY_TOKEN) {
    console.warn('OPENCLAW_GATEWAY_TOKEN no configurado — skipping browser open.')
    return null
  }
  try {
    const res = await fetch(`${AGENT_URL}/open-url`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: canvasUrl, target }),
    })
    if (!res.ok) {
      console.warn(`/open-url returned ${res.status}: ${await res.text()}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn(`/open-url failed (daemon offline?): ${err.message}`)
    return null
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

try {
  const ownerId = await fetchOwnerId()
  const canvas = await insertCanvas(ownerId)
  const canvasUrl = `${MC_BASE_URL}/draw/${canvas.id}`
  console.log(`✓ Canvas guardado: ${canvas.id}`)
  console.log(`  URL: ${canvasUrl}`)
  const openResult = await openInBrowser(canvasUrl)
  if (openResult) {
    console.log(`  Open: ${JSON.stringify(openResult.results)}`)
  }
  // Emit JSON summary in stdout for tooling consumption
  console.log(
    JSON.stringify({ id: canvas.id, url: canvasUrl, title: canvas.title }, null, 2),
  )
} catch (err) {
  console.error(`Error: ${err.message}`)
  process.exit(1)
}
