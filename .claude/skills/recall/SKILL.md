---
name: recall
description: "Consulta la memoria semántica de {{AGENT_NAME}} (tabla {{AGENT_TABLE_PREFIX}}_memories en Supabase + pgvector) vía endpoint /recall del daemon AIOS. Genera embedding 1536d del query con OpenAI text-embedding-3-small, devuelve top-K memorias ordenadas por similitud coseno descendente. Complementa al Memory Tool nativo (PRP-025, que escribe .claude/agent-memory/{{AGENT_NAME}}/*.md) sumando retrieval por significado en vez de lectura full-text. Activar cuando el operador pregunta por hechos concretos sobre sí mismo o su contexto: qué sabes de X, te acuerdas de Y, en qué quedamos con Z, qué dije sobre W, recuerda V, qué café toma, dónde vive, cómo se llama su gato, cuál es su prioridad esta semana."
allowed-tools: Bash
---

# recall — retrieval semántico sobre `{{AGENT_TABLE_PREFIX}}_memories`

> Memoria activa de {{AGENT_NAME}} indexada con embeddings 1536d. Cuando el operador pregunta por un dato concreto sobre sí mismo o su contexto, {{AGENT_NAME}} le pregunta a la tabla `{{AGENT_TABLE_PREFIX}}_memories` antes de responder por inferencia.
>
> Coexiste con dos skills hermanas:
>
> - `memory-manager` opera sobre `.claude/memory/*.md` (memoria del operador, curada a mano, cero auto-injection). Triggers solapados pero superficie distinta.
> - El **Memory Tool nativo SDK 0.2.128** (PRP-025) escribe `.claude/agent-memory/{{AGENT_NAME}}/*.md`. Esos archivos son el source que el indexer (`agent-server/scripts/index-memories.ts`) procesa para poblar `{{AGENT_TABLE_PREFIX}}_memories`.
>
> Esta skill consume el espejo indexable del Memory Tool — NO lo escribe. Para guardar hechos nuevos, {{AGENT_NAME}} usa el Memory Tool directamente; el indexer cierra el círculo más tarde (manual ahora, cron nocturno en PRP-027/Fase 4).

---

## Cuándo activar

- "¿qué sabes de X?" / "¿te acuerdas de Y?" / "¿en qué quedamos con Z?" — pregunta semántica sobre dato concreto.
- "¿qué café toma?" / "¿cómo se llama su gato?" / "¿dónde vive?" — pregunta sobre atributos del operador.
- "¿qué dije la semana pasada sobre X?" / "¿qué decidí sobre Y?" — recuperación histórica.
- Cualquier pregunta donde la respuesta dependa de un hecho que {{AGENT_NAME}} guardó vía Memory Tool y necesita recuperar por significado, no por nombre de archivo exacto.

## Cuándo NO activar

- Pregunta sobre código, doctrina del proyecto, o estructura técnica del repo (CLAUDE.md + skills hacen el trabajo).
- Pregunta sobre datos de negocio (BI, funnel, revenue) — `aios-supabase` y `funnel-tracking` cubren esos casos.
- Pregunta sobre datos curados manualmente por el operador (`people.md`, `decisiones.md`, etc.) — `memory-manager` lo hace.
- Conversación abierta sin trigger semántico de recall ("explícame X", "qué piensas de Y") — el recall es soporte, no orquestador.

## Antes de empezar

Verificar empíricamente que el daemon está vivo + endpoint cableado:

- [ ] `curl -s http://127.0.0.1:3099/healthz` retorna `{"ok":true,...}` o el endpoint público `https://YOUR_DAEMON_PUBLIC_URL/healthz` responde 200.
- [ ] `OPENCLAW_GATEWAY_TOKEN` está disponible en el environment de {{AGENT_NAME}} (sembrado en `agent-server/.env` + `.claude/.env` si {{AGENT_NAME}} corre fuera del daemon).

Si el daemon está offline → degradar a fallback (siguiente sección). Si el token no está disponible → escalar al operador con instrucción clara (no inventar).

---

## Cómo opera

### 1. Construir la URL del endpoint

Base URL:

- Desde la máquina del operador donde corre el daemon: `http://127.0.0.1:3099/recall`.
- Desde superficies remotas (Telegram, MC en Vercel) o cualquier sesión que no corre en el host del daemon: `https://YOUR_DAEMON_PUBLIC_URL/recall`.

Params:

- `query` — texto de la pregunta del operador, URL-encoded.
- `limit` — top-K (default 5, cap 20). En la mayoría de los casos `5` sobra.

### 2. Invocar el endpoint

```bash
curl -s -G \
  --data-urlencode "query=<TEXTO DE LA PREGUNTA DEL OPERADOR>" \
  --data-urlencode "limit=5" \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  "https://YOUR_DAEMON_PUBLIC_URL/recall"
```

Response 200 shape:

```json
{
  "memories": [
    {
      "id": "uuid",
      "content": "texto completo de la memoria",
      "tags": ["tag1", "tag2"],
      "entity": "operator|pet|business|null",
      "importance": 1.0,
      "accessed_count": 3,
      "last_accessed_at": "2026-05-12T12:00:00Z",
      "created_at": "2026-05-10T08:00:00Z",
      "source": "operator-pet-pelusa",
      "similarity": 0.87
    }
  ],
  "query": "echo de la query original",
  "limit": 5
}
```

`memories` está ordenada por `similarity` descendente (la primera fila es la más cercana semánticamente).

### 3. Interpretar la respuesta

- `memories.length === 0` → {{AGENT_NAME}} responde "no tengo memoria sobre eso, ¿quieres que la guarde?" (operador puede usar el Memory Tool para persistir el hecho).
- `memories[0].similarity >= 0.5` → match fuerte, {{AGENT_NAME}} cita directamente el `content` de la fila y opcionalmente el `source` como referencia.
- `memories[0].similarity < 0.3` → match débil, {{AGENT_NAME}} menciona la incertidumbre ("podría estar pensando en esto: …") en lugar de afirmar.
- Múltiples memorias con similitudes similares → {{AGENT_NAME}} las combina narrativamente en la respuesta.

### 4. Outputs esperados

La skill devuelve a {{AGENT_NAME}} un array de memorias estructuradas. {{AGENT_NAME}} las usa para construir su respuesta en lenguaje natural al operador. La skill NO escribe a memoria, NO modifica la BD (excepto el `touch` interno que bumpea `accessed_count` + `last_accessed_at` automáticamente vía RPC `touch_{{AGENT_TABLE_PREFIX}}_memory` en el daemon — invisible para la skill).

---

## Casos borde

- **HTTP 401**: bearer ausente o inválido. Re-verificar `OPENCLAW_GATEWAY_TOKEN`. Si está bien, el token pudo rotarse — escalar al operador.
- **HTTP 503 `embeddings provider not configured`**: `OPENAI_API_KEY` no sembrado en `agent-server/.env`. Degradar al fallback (siguiente sección). Informar al operador: "Mi memoria semántica no está cableada todavía — voy a buscar en los archivos directamente".
- **HTTP 503 `recall not configured: missing supabase`**: `MC_SUPABASE_URL`/`MC_SUPABASE_KEY` ausentes. Patológico — escalar al operador (daemon mal configurado).
- **HTTP 502 `upstream embedding failed` con `retryable: true`**: rate limit u outage temporal de OpenAI. Reintentar una vez tras 2-3s. Si vuelve a fallar, degradar al fallback.
- **HTTP 500**: error en el daemon. Leer los logs del daemon (macOS launchd: `~/Library/Logs/aios/agent.err.log`; Linux systemd: `journalctl --user -u aios-agent`; Windows: `agent-server/store/*.log`) o el output de `/ops/recent` para diagnosticar.
- **Daemon offline (`curl` retorna `Connection refused` o timeout)**: degradar al fallback. Informar al operador.

### Fallback: Bash + Read directo sobre `.claude/agent-memory/{{AGENT_NAME}}/*.md`

Cuando el endpoint `/recall` no esté disponible, {{AGENT_NAME}} recurre al recall proactivo PRP-025:

```bash
ls .claude/agent-memory/{{AGENT_NAME}}/ | grep -v gitkeep
grep -ril "<palabra clave>" .claude/agent-memory/{{AGENT_NAME}}/
```

Lee los archivos relevantes con la tool `Read`. Es lento e ineficiente con muchos archivos pero garantiza que la memoria siempre se puede consultar aunque el daemon esté caído.

---

## Referencias

- `agent-server/src/embed.ts` — wrapper OpenAI text-embedding-3-small.
- `agent-server/src/recall.ts` — helper de retrieval + touch fire-and-forget.
- `agent-server/src/server.ts` — endpoints HTTP `POST /embed` + `GET /recall`.
- `agent-server/scripts/index-memories.ts` — indexer one-shot manual.
- `.claude/PRPs/PRP-026-marley-semantic-memory-pgvector.md` — PRP origen.
- `.claude/skills/memory-manager/SKILL.md` — skill hermana sobre memoria curada del operador.

---

## Aprendizajes propagables

[2026-05-12]: skill `recall` arranca en modo on-demand (descubrimiento por triggers semánticos), NO auto-injection cada turn → respeta cero-auto-injection PRP-008 y evita latencia + costo innecesario cuando el turn no necesita memoria histórica.

[2026-05-12]: el endpoint `/recall` cierra el círculo del Memory Tool nativo (PRP-025) → el `.md` que {{AGENT_NAME}} escribe queda visible (Bash+Read fallback) **y** indexable (embeddings 1536d). Doble lectura del mismo dato, distintos costos de acceso.
