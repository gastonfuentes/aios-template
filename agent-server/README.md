# agent-server

Daemon Node 20+ long-lived que aloja la conversación con Claude Agent SDK + HTTP server + SQLite + Telegram bot opcional. Vive en la máquina del operador (laptop, mini-PC always-on, o VPS) en el puerto `127.0.0.1:3099`. Mission Control PWA + CLI Claude Code + Telegram bot consumen los mismos endpoints autenticados con bearer.

---

## Arrancar el daemon

Desde este directorio (`agent-server/`):

```bash
npm install     # instala todas las deps
npm run dev     # tsx src/index.ts (con pino-pretty)
# o
npm run build && npm start  # tsc → dist/ → node dist/index.js
```

Boot esperado (sin Telegram configurado):

```
╔═══════════════════════════════════╗
║       AIOS Template Agent         ║
╚═══════════════════════════════════╝
INFO env validated { requiredCount: 6 }
INFO database initialized { store: '.../agent-server/store' }
INFO hook guard installed { guardPath: '.../.claude/hooks/agent-server-guard.sh' }
WARN bot disabled (missing TELEGRAM_BOT_TOKEN or ALLOWED_CHAT_ID)
INFO MC web server listening on 127.0.0.1 { port: 3099, origin: 'http://localhost:3000' }
INFO SDK pre-warm complete { cwd: '<PROJECT_ROOT>' }
```

Con Telegram configurado, el `WARN bot disabled` se reemplaza por `INFO bot online { username: '...' }` cuando grammY consigue handshake con `getMe`.

Apagado: `Ctrl-C` (SIGINT). El daemon llama `bot.stop()` (si aplica), cierra el HTTP server, libera el PID lock (`store/agent-server.pid`) y sale con exit 0.

---

## Endpoints HTTP

Todos requieren `Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}` con `crypto.timingSafeEqual`. CORS solo expone los orígenes listados en `MISSION_CONTROL_ORIGIN` (CSV).

| Endpoint | Descripción |
|---|---|
| `GET /healthz` | `{ ok, uptime, pid, sdkPrewarmed }` |
| `GET /models` | Modelos del SDK con fallback estático si SDK retorna `[]` |
| `GET /usage?days=N` | Agregado de `query_usage` SQLite |
| `GET /ops/stream` | SSE de `OpsEvent` (burst inicial 50 + live + ping 30s) |
| `GET /ops/recent?limit=N` | Snapshot JSON de eventos recientes |
| `POST /chat/stream` | Stream SSE del chat — token-por-token + thinking + tool_use + tool_output |
| `POST /chat/interrupt` | Aborta stream activo |
| `POST /newchat` | Limpia mapping SDK + crea sesión nueva |
| `GET /commands` | Lista de slash-commands disponibles |
| `GET /sessions?limit=N` | Sesiones recientes del SDK (incluye linkedChatSessionId) |
| `GET /sessions/:id/messages` | Mensajes de una sesión SDK por id |
| `POST /embed` | Genera embedding 1536d con OpenAI `text-embedding-3-small` |
| `GET /recall?query=...&limit=5` | Top-K memorias semánticas más cercanas vía pgvector |
| `POST /schedule`, `PATCH /schedule/:id`, `DELETE /schedule/:id` | CRUD cron jobs |
| `POST /open-url` | Abre URL en browser del operador (`host`/`push`/`both`) |

---

## Telegram bot + voz (opcional)

`bot.ts` corre en el mismo proceso que el HTTP server vía long polling outbound de grammY (no necesita puerto local). Activación gateada por `isBotConfigured()`: si `TELEGRAM_BOT_TOKEN` o `ALLOWED_CHAT_ID` faltan, el daemon arranca sin bot (fail-soft, log `WARN bot disabled`) y sigue sirviendo el HTTP server normal.

Comandos: `/start`, `/chatid`, `/newchat`, `/voice`, `/schedule`. Handlers: `:text`, `:voice`, `:photo`, `:document`. La autorización es single-chat: cualquier `chat_id ≠ ALLOWED_CHAT_ID` recibe `Unauthorized.`

Voice notes: descarga `.oga` → renombra a `.ogg` → Groq Whisper-large-v3 → mensaje al SDK con prefijo `[Nota de voz]:`. Si `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` están seteados, la respuesta vuelve como audio MP3 (modelo `eleven_flash_v2_5`). Sin esas keys, la respuesta es texto.

Fotos y documentos: descarga al `store/uploads/` con timestamp + filename sanitizado. El SDK recibe el path local y lee el archivo con sus tools nativas (`Read`, `view`, etc.).

**Cero memory injection** por convención: el bot pasa el texto raw al SDK, sin preámbulos de memoria. Las conversaciones de Telegram viven en la sesión SDK (`~/.claude/projects/<project-slug>/`) y aparecen en el sidebar del MC con badge **📱 Telegram**.

`cleanupOldUploads()` corre al boot y borra archivos en `store/uploads/` con `mtime > 24h`.

---

## Variables de entorno

`agent-server/.env` (gitignored). Plantilla pública con docs por var: `agent-server/.env.example`.

Variables críticas (daemon aborta al boot si faltan):

- `MC_SUPABASE_URL` — project Supabase del operador.
- `MC_SUPABASE_KEY` — service_role JWT (bypassea RLS para escribir `ops_events`).
- `OPENCLAW_GATEWAY_TOKEN` — bearer compartido byte-exact con `mission-control/.env.local`.
- `MISSION_CONTROL_ORIGIN` — CSV de orígenes permitidos por CORS.
- `MISSION_CONTROL_URL` — webhook target del daemon hacia MC.
- `MISSION_CONTROL_TOKEN` — bearer outgoing (= `OPENCLAW_GATEWAY_TOKEN`).

Opcionales con defaults:
- `MC_SERVER_PORT` (default `3099`).
- `LOG_LEVEL` (default `info`).
- `NODE_ENV` (cuando es `production`, pino emite JSON puro a stdout).
- `MEMORY_TABLE_PREFIX` (default `agent`).
- `AGENT_NAME` (default `agent`).

Telegram bot + voz (fail-soft, daemon arranca igual si faltan):
- `TELEGRAM_BOT_TOKEN` — del @BotFather.
- `ALLOWED_CHAT_ID` — único chat autorizado.
- `GROQ_API_KEY` — STT Whisper-large-v3.
- `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` — TTS.

Memoria semántica + crons (fail-soft):
- `OPENAI_API_KEY` — embeddings.
- `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`).
- `MEMORY_CONSOLIDATION_MODEL` (default `claude-sonnet-4-5`).
- `MEMORY_DECAY_*` / `MEMORY_COMPACT_THRESHOLD` (defaults conservadores).

Google Workspace skill:
- `GOG_KEYRING_PASSWORD`, `GOG_ENABLE_COMMANDS`.

Push notifications PWA:
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`.

---

## Estructura

```
agent-server/
├── package.json           # type: module, scripts dev/build/start/typecheck/test
├── tsconfig.json          # NodeNext + strict
├── README.md              # este archivo
├── .env, .env.example     # gitignored / template
├── src/
│   ├── env.ts             # readEnvFile + validateRequiredEnv
│   ├── config.ts          # PROJECT_ROOT, STORE_DIR, UPLOADS_DIR, MC_SERVER_PORT
│   ├── logger.ts          # pino + pino-pretty (dev only)
│   ├── db.ts              # SQLite WAL + currentWeekKey ISO-8601
│   ├── security.ts        # validateInput, validateUrl, redactSecrets
│   ├── ops-logger.ts      # EventEmitter + ring buffer + persist a public.ops_events
│   ├── mc-client.ts       # mcStart/mcEnd/mcError/mcCronResult fire-and-forget
│   ├── agent.ts           # SDK invocation + runAgent/runAgentStream + getAvailableModels
│   ├── llm-adapter/       # Adapter cross-provider (Claude Code SDK / Anthropic API / OpenRouter)
│   ├── server.ts          # HTTP 127.0.0.1:3099 + bearer + CORS + endpoints
│   ├── voice.ts           # Groq Whisper STT + ElevenLabs TTS (fail-soft)
│   ├── media.ts           # downloadMedia / cleanupOldUploads / build*Message
│   ├── bot.ts             # grammY bot + handlers + formatForTelegram + splitMessage
│   ├── embed.ts           # OpenAI embeddings + cache LRU
│   ├── recall.ts          # pgvector retrieval via match_<prefix>_memories RPC
│   ├── consolidate.ts     # Nightly memory consolidation (cron)
│   ├── notifications.ts   # PWA push helpers + emitNotification API
│   ├── scheduler.ts       # Cron poller 60s + claim race-safe
│   ├── multipart.ts       # Manual multipart parser zero-dep
│   ├── error-alerts.ts    # Alert on hard errors
│   ├── housekeeping.ts    # Cleanup .jsonl orphans
│   ├── *.test.ts          # vitest — 190 tests verdes baseline
│   └── index.ts           # main: validar env, lock, init DB, hook guard, prewarm, start, bot, shutdown
├── scripts/
│   ├── index-memories.ts  # One-shot indexer .claude/agent-memory/<agent>/*.md → agent_memories
│   └── consolidate.ts     # Entry del cron nightly-memory-consolidation
├── store/
│   ├── agent-server.db    # gitignored — SQLite WAL
│   ├── agent-server.pid   # gitignored — singleton lock
│   └── uploads/           # gitignored — descargas de Telegram, cleanup automático >24h
└── dist/                  # gitignored — output de tsc
```

---

## Decisiones load-bearing

- `cwd: PROJECT_ROOT` (NO `agent-server/`) → unifica sesiones SDK con Claude Code CLI bajo `~/.claude/projects/<project-slug>/`. Cualquier `claude` desde el repo retoma la misma sesión que el daemon.
- `hooks: {}` override en cada `query()` → evita que hooks de `~/.claude/settings.json` se disparen en el subprocess y creen ghost sessions.
- `env: { ...process.env, AGENT_SERVER_DAEMON: '1' }` → activa el guard pattern instalado en `~/.claude/hooks/agent-server-guard.sh` que hace `exit 0` cuando esa variable está presente. Sin la guarda, el daemon entraría en bucle de auto-invocación.
- `permissionMode: 'bypassPermissions'` → tools sin prompt de confirmación. Solo dentro del trust boundary (`127.0.0.1` + bearer + máquina local del operador).
- `includePartialMessages: true` → habilita `text_delta` + `thinking_delta` + `input_json_delta` del streaming SSE.
- `getISOWeek` + `getISOWeekYear` de `date-fns ^4.1.0` para `currentWeekKey()` ISO-8601 correcto.
- HTTP bind a `127.0.0.1` (no `0.0.0.0`). La exposición externa pasa por Cloudflare Tunnel (Quick Tunnel `*.trycloudflare.com` o Named Tunnel con DNS).
- `better-sqlite3 ^12.9.0` (compat Node ≥ 24).
- Adapter LLM cross-provider (`llm-adapter/`): el operador elige Claude Code SDK (Max plan), Anthropic API directa, u OpenRouter (300+ modelos) via env `LLM_PROVIDER`. Default `claude-code-sdk`.

---

## Verificar que está vivo

```bash
TOKEN=$(grep '^OPENCLAW_GATEWAY_TOKEN=' .env | cut -d'=' -f2-)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3099/healthz
# → {"ok":true,"uptime":N,"pid":XXX,"sdkPrewarmed":true}
```

Sin bearer válido: `401 Unauthorized`. Con bearer + origen distinto a `MISSION_CONTROL_ORIGIN`: `Access-Control-Allow-Origin` no echo'd → browser bloquea.
