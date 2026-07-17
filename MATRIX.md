# MATRIX.md — mapa decisión cuadrante → ejecución

> Tabla cruzada que el agente del alumno consulta tras la entrevista para obtener la lista exacta de scripts + docs a aplicar para el cuadrante elegido. Cero ambigüedad.

---

## Reglas

- Cada celda apunta a archivos exactos en `setup/` que el agente lee y ejecuta.
- Si una capability NO aplica al cuadrante (ej. Telegram bot en pwa-only-cloud sin daemon), el agente la salta sin pregunta.
- El agente NO improvisa scripts — solo invoca los que están en `setup/scripts/` o `setup/service-manager/`.

---

## Cuadrante 1: `local-only`

**Características**: laptop sin tunnel. MC accesible solo en `localhost:3000`. Daemon corre en background (opcional service manager). Cero exposición pública.

**Setup time target**: ≤ 5 minutos.

**Pipeline de scripts** (en orden):

1. `setup/scripts/install-deps-{macos,linux,windows-wsl2}.sh` (según OS detectado).
2. `setup/scripts/seed-supabase.sh` (aplica migrations + opcional seed-demo).
3. `setup/scripts/generate-vapid.sh` (genera VAPID keys para PWA push).
4. `setup/scripts/start-daemon-local.sh` (arranca daemon en background, sin service manager).
5. `setup/scripts/smoke-test.sh` (valida MC SSR + daemon healthz + auth gate).

**Docs a consultar para info adicional**:
- `setup/deploy-paths/local-only.md`
- `setup/llm-providers/<provider>.md` (según elección Pregunta 3).

**Env vars críticas**:
- `LLM_PROVIDER`, provider key correspondiente.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `ALLOWED_EMAILS` (email del operador).
- `MC_BASE_URL=http://localhost:3000`.

---

## Cuadrante 2: `local-tunnel`

**Características**: laptop + tunnel (Cloudflare / Tailscale / ngrok). MC accesible desde móvil y cualquier red. Daemon corre via service manager para always-on durante laptop encendida.

**Setup time target**: ≤ 15 minutos.

**Pipeline de scripts** (en orden):

1. `setup/scripts/install-deps-{macos,linux,windows-wsl2}.sh`.
2. `setup/scripts/seed-supabase.sh`.
3. `setup/scripts/generate-vapid.sh`.
4. `setup/scripts/start-{cloudflare,tailscale,ngrok}-tunnel.sh` (según elección Pregunta 5).
5. `setup/scripts/install-service-manager.sh` (renderea launchd/systemd template + bootstrap).
6. `setup/scripts/smoke-test.sh`.
7. Opcional: `setup/scripts/deploy-vercel.sh` para deployar MC PWA a Vercel (apuntando al daemon vía tunnel).

**Docs a consultar**:
- `setup/deploy-paths/local-tunnel.md`
- `setup/tunneling/{cloudflare,tailscale,ngrok}.md` (según elección).
- `setup/service-manager/{launchd-macos,systemd-linux}.service.template` (según OS).
- `setup/llm-providers/<provider>.md`.

**Env vars críticas**:
- Todo lo del local-only +
- `MC_BASE_URL=https://<tunnel-domain>` (según provider de tunnel).
- `MISSION_CONTROL_ORIGIN=https://<mc-domain>,http://localhost:3000` (CORS).

---

## Cuadrante 3: `vps-linux`

**Características**: VPS Ubuntu 22+ con dominio propio + nginx + SSL Let's Encrypt. Daemon corre via systemd. PWA en Vercel apuntando al daemon público. Para alumnos production-grade o agencias con cliente.

**Setup time target**: ≤ 30 minutos.

**Pipeline de scripts** (en orden, ejecutados sobre el VPS via SSH del agente):

1. `setup/scripts/install-deps-linux.sh` (en VPS).
2. `setup/scripts/seed-supabase.sh` (aplica desde local del operador).
3. `setup/scripts/generate-vapid.sh`.
4. `setup/scripts/install-nginx-letsencrypt.sh` (en VPS, configura nginx + certbot).
5. `setup/scripts/install-service-manager.sh` (systemd en VPS).
6. `setup/scripts/deploy-vercel.sh` (PWA en Vercel apuntando al VPS).
7. `setup/scripts/smoke-test.sh` (validate end-to-end).

**Docs a consultar**:
- `setup/deploy-paths/vps-linux.md`
- `setup/service-manager/systemd-linux.service.template`
- `setup/llm-providers/<provider>.md`.

**Env vars críticas**:
- Todo +
- `MC_BASE_URL=https://mc.<dominio-cliente>.com`.
- `MISSION_CONTROL_ORIGIN=https://mc.<dominio-cliente>.com`.
- `LLM_PROVIDER=openrouter` recomendado (control fino de costo si es deployment de cliente).

---

## Cuadrante 4: `pwa-only-cloud`

**Características**: 100% Vercel + Supabase. Cero daemon. MC funciona solo como dashboard + chat directo al provider LLM via Vercel AI SDK route. Pierde crons 24/7, Telegram bot, voice STT/TTS, always-push receiver, memoria semántica indexada. Gana cero infra para mantener.

**Setup time target**: ≤ 5 minutos.

**Pipeline de scripts** (en orden):

1. `setup/scripts/install-deps-{macos,linux,windows-wsl2}.sh` (solo para build local).
2. `setup/scripts/seed-supabase.sh` (aplica migrations subset PWA-only).
3. `setup/scripts/generate-vapid.sh` (opcional — push notifications PWA siguen funcionando).
4. `setup/scripts/deploy-vercel.sh` (build + deploy MC).
5. `setup/scripts/smoke-test.sh` (validate MC SSR + auth + chat directo al provider).

**Docs a consultar**:
- `setup/deploy-paths/pwa-only-cloud.md`
- `setup/llm-providers/<provider>.md`.

**Env vars críticas** (todas en Vercel project, NO local):
- `LLM_PROVIDER`, provider key.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `ALLOWED_EMAILS`.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (opcional para push).

---

## Capabilities por cuadrante

| Capability | local-only | local-tunnel | vps-linux | pwa-only-cloud |
|---|:-:|:-:|:-:|:-:|
| MC PWA + chat | ✅ | ✅ | ✅ | ✅ |
| Auth magic-link | ✅ | ✅ | ✅ | ✅ |
| Scheduled tasks (UI) | ✅ | ✅ | ✅ | ⚠ readonly |
| Draw whiteboard | ✅ | ✅ | ✅ | ✅ |
| Ops events stream | ✅ | ✅ | ✅ | ⚠ static |
| Search federado | ✅ | ✅ | ✅ | ⚠ Supabase only |
| Notifications PWA | ✅ | ✅ | ✅ | ✅ |
| Crons 24/7 | ⚠ si laptop encendida | ⚠ si laptop encendida | ✅ | ❌ |
| Telegram bot | ⚠ con keys | ✅ | ✅ | ❌ |
| Voice STT/TTS | ⚠ con keys | ✅ | ✅ | ❌ |
| Memory Tool nativo SDK | ✅ si Claude Code | ✅ si Claude Code | ✅ si Claude Code | ❌ |
| Memoria semántica indexada | ✅ con OpenAI key | ✅ con OpenAI key | ✅ con OpenAI key | ❌ |
| Always-push receiver | ✅ local | ✅ remoto | ✅ remoto | ❌ |
| Acceso desde móvil | ❌ LAN only | ✅ | ✅ | ✅ |

---

## Combinaciones LLM provider × cuadrante

Cualquier `LLM_PROVIDER` funciona en cualquier cuadrante. El adapter activo determina capabilities provider-específicas:

- `claude-code-sdk`: preserva Memory Tool nativo + cwd-shared sessions. Requiere Claude Code CLI instalado + plan Pro/Max.
- `anthropic-api`: cross-provider Anthropic via API directa. Memory Tool reimplementado via Supabase. Reasoning summarized soportado.
- `openrouter`: 300+ modelos. Reasoning depende del modelo. Memory Tool via Supabase.

---

## Cuando el cuadrante elegido no se mapea limpio

Si el operador eligió combinaciones raras (ej. Windows nativo sin WSL2), el agente:

1. Detecta empíricamente la limitación.
2. Documenta la incompatibilidad en `docs/troubleshooting.md` para alumnos futuros.
3. Sugiere migración (ej. "Windows nativo no está soportado v1. Te sugiero instalar WSL2 — te guío con `wsl --install`").
4. **NO procede al deploy** hasta que el operador acepte la migración o explicite que asume el riesgo de unsupported.
