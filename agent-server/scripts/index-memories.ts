#!/usr/bin/env tsx
/**
 * Indexer one-shot de memorias {{AGENT_NAME}} a `public.{{AGENT_TABLE_PREFIX}}_memories` (PRP-026, Fase 3).
 *
 * Lee `.claude/agent-memory/{{AGENT_NAME}}/*.md` (Memory Tool nativo SDK 0.2.128, PRP-025),
 * computa `sha256(body)` para idempotencia, genera embedding 1536d con OpenAI
 * `text-embedding-3-small`, y hace UPSERT en `{{AGENT_TABLE_PREFIX}}_memories` con
 * `ON CONFLICT (source, content_hash) DO NOTHING`.
 *
 * Uso (desde `agent-server/`):
 *   npm run index-memories            # default: indexa todo .claude/agent-memory/{{AGENT_NAME}}/
 *   tsx scripts/index-memories.ts     # equivalente directo
 *
 * Fase 4 (PRP-027) reemplazará la invocación manual con un cron job
 * `nightly-memory-consolidation` que llama esta lógica + suma extracción LLM.
 */

import { createHash } from 'crypto'
import { readdirSync, readFileSync, statSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createClient } from '@supabase/supabase-js'
import { embedText, EmbeddingNotConfiguredError } from '../src/embed.js'
import { readEnvFile } from '../src/env.js'
import { logger } from '../src/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const MEMORY_DIR = join(PROJECT_ROOT, '.claude', 'agent-memory', 'marley')

interface IndexResult {
  source: string
  status: 'inserted' | 'skipped' | 'error'
  reason?: string
}

function listMemoryFiles(): string[] {
  try {
    const entries = readdirSync(MEMORY_DIR)
    return entries
      .filter(name => name.endsWith('.md') && name !== '.gitkeep')
      .map(name => join(MEMORY_DIR, name))
      .filter(path => {
        try {
          return statSync(path).isFile()
        } catch {
          return false
        }
      })
  } catch (err) {
    logger.error({ err, MEMORY_DIR }, 'index-memories: failed to read directory')
    return []
  }
}

function sha256(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex')
}

async function indexOne(
  client: ReturnType<typeof createClient>,
  filePath: string,
): Promise<IndexResult> {
  const source = basename(filePath, extname(filePath))
  let body: string
  try {
    body = readFileSync(filePath, 'utf8')
  } catch (err) {
    return { source, status: 'error', reason: `read failed: ${String(err)}` }
  }

  if (body.trim().length === 0) {
    return { source, status: 'skipped', reason: 'empty body' }
  }

  const contentHash = sha256(body)

  // Pre-check: idempotencia barata sin gastar embedding si ya existe.
  const { data: existing, error: selectErr } = await client
    .from('{{AGENT_TABLE_PREFIX}}_memories')
    .select('id')
    .eq('source', source)
    .eq('content_hash', contentHash)
    .maybeSingle()

  if (selectErr) {
    return { source, status: 'error', reason: `select failed: ${selectErr.message}` }
  }
  if (existing) {
    return { source, status: 'skipped', reason: 'hash unchanged' }
  }

  let embedding: number[]
  try {
    embedding = await embedText(body, { skipCache: true })
  } catch (err) {
    if (err instanceof EmbeddingNotConfiguredError) {
      return { source, status: 'error', reason: 'OPENAI_API_KEY not set' }
    }
    return { source, status: 'error', reason: `embed failed: ${String(err)}` }
  }

  const { error: insertErr } = await client.from('{{AGENT_TABLE_PREFIX}}_memories').insert({
    content: body,
    embedding,
    source,
    content_hash: contentHash,
    metadata: {
      file_path: filePath.replace(`${PROJECT_ROOT}/`, ''),
      body_bytes: Buffer.byteLength(body, 'utf8'),
      indexed_at: new Date().toISOString(),
    },
  })

  if (insertErr) {
    // El UNIQUE constraint puede dispararse si otro proceso insertó entre el SELECT y el INSERT.
    // Igualmente cuenta como skipped (idempotente).
    if (insertErr.code === '23505') {
      return { source, status: 'skipped', reason: 'race-condition: already inserted' }
    }
    return { source, status: 'error', reason: `insert failed: ${insertErr.message}` }
  }

  return { source, status: 'inserted' }
}

async function main(): Promise<void> {
  const env = readEnvFile(['MC_SUPABASE_URL', 'MC_SUPABASE_KEY', 'OPENAI_API_KEY'])
  const url = env['MC_SUPABASE_URL']
  const key = env['MC_SUPABASE_KEY']
  if (!url || !key) {
    console.error('FATAL: MC_SUPABASE_URL / MC_SUPABASE_KEY ausentes en agent-server/.env')
    process.exit(1)
  }
  if (!env['OPENAI_API_KEY']) {
    console.error('FATAL: OPENAI_API_KEY ausente en agent-server/.env — indexer requiere embeddings provider')
    process.exit(1)
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const files = listMemoryFiles()
  if (files.length === 0) {
    console.log(`No memory files found in ${MEMORY_DIR}. Nothing to index.`)
    return
  }

  console.log(`Indexing ${files.length} memory file(s) from ${MEMORY_DIR}...`)

  let inserted = 0
  let skipped = 0
  let errors = 0
  const errorDetails: IndexResult[] = []

  for (const file of files) {
    const result = await indexOne(client, file)
    if (result.status === 'inserted') {
      inserted += 1
      console.log(`  + ${result.source}`)
    } else if (result.status === 'skipped') {
      skipped += 1
      console.log(`  · ${result.source} (${result.reason})`)
    } else {
      errors += 1
      errorDetails.push(result)
      console.error(`  ! ${result.source}: ${result.reason}`)
    }
  }

  console.log(`\nIndexed: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`)

  if (errors > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('index-memories fatal:', err)
  process.exit(1)
})
