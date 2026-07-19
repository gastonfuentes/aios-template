# PRP-065: Deploy AIOS en VPS soberano (Coolify + Supabase self-hosted + Cloudflare Tunnel)

> **Estado**: EN PROGRESO
> **Fecha**: 2026-07-16
> **Aprobado**: 2026-07-16 (⚡ Run del operador)
> **Iniciado**: 2026-07-16
> **Proyecto**: AIOS Template — Mission Control soberano

---

## Origen

> Derivado de `@BRIEF-MASTER-vps-soberano.md` (raíz del repo). Cubre TODAS las fases de su `## Fases sugeridas para el PRP`.
> Hereda Directiva de Stack, Supuestos, Fuera de Alcance y aprendizajes heredados.
> El brief define un cuadrante custom `vps-soberano` que NO existe en `MATRIX.md`. **Donde el brief contradiga a `MATRIX.md` o a `setup/deploy-paths/vps-linux.md`, gana el brief.**

---

## Objetivo

> Voz: primera persona. Heredada del brief.

Quiero mi Mission Control corriendo entero dentro de mi propio VPS, con soberanía de datos total: la base de datos vive en el VPS, nada en Supabase Cloud ni en Vercel. Quiero que la IP del servidor nunca se exponga — cero puertos públicos salvo SSH — y que todo el tráfico entre por Cloudflare Tunnel. Quiero loguearme por magic-link en `mc.<dominio>`, chatear con mi agente y que la conversación quede persistida en mi Postgres local, y que si reinicio el VPS todo levante solo.

## Por Qué

> Voz: primera persona. Hereda el porqué del brief.

| Problema | Solución |
|----------|----------|
| Mis datos en la nube de un tercero (Supabase Cloud/Vercel) no es soberanía real | Postgres + apps corren dentro de mi VPS; el dato nunca sale |
| Exponer la IP del VPS con puertos abiertos es superficie de ataque | Zero Trust: solo SSH abierto; todo lo demás entra por Cloudflare Tunnel |
| Mantener nginx + certbot + systemd a mano es frágil | Coolify orquesta build, deploy, health y restart; Cloudflare resuelve TLS y routing |

**Valor**: Control end-to-end de mis datos y mi infra sin renunciar a acceso desde cualquier lado ni a las capabilities 24/7 (crons, Telegram, memoria semántica). Un solo VPS, todo reproducible, reinicio-resiliente.

## Qué

> Voz: impersonal. Contrato técnico.

### Criterios de éxito
- [ ] `curl https://agent.<dominio>/healthz` responde OK desde internet.
- [ ] `curl http://<IP-del-VPS>:3099` desde afuera NO responde (timeout/drop) — puerto no expuesto.
- [ ] Login por magic-link funciona de punta a punta en `mc.<dominio>`.
- [ ] Un mensaje en el chat del MC streamea respuesta y queda persistido en `chat_messages` del Postgres local.
- [ ] `docker ps` muestra todos los contenedores healthy; un reinicio del VPS levanta todo solo.
- [ ] Un cron de prueba programado desde la UI dispara a la hora indicada.
- [ ] `ufw status` muestra `default deny incoming` + solo SSH permitido (rate-limited); Postgres :5432 nunca escuchando en interfaz pública.

### Comportamiento esperado

El operador entra a `mc.<dominio>`, recibe magic-link en su correo (GoTrue vía SMTP), valida y obtiene sesión propia. Desde el chat manda un mensaje: el MC llama al agent-server (`agent.<dominio>`, protegido por Bearer `OPENCLAW_GATEWAY_TOKEN`), que streamea la respuesta del LLM y la persiste en el Postgres self-hosted vía Kong (`supabase.<dominio>`, JWT + RLS). El panel de Coolify (`coolify.<dominio>`) solo es accesible tras pasar Cloudflare Access con el email del operador. Todo el tráfico externo pasa por el túnel; ningún puerto de aplicación está abierto en el firewall del VPS.

### Casos borde
- **DNS aún no propagado a Cloudflare** al llegar a la Fase 3 → pausar y avisar (verificar con `dig NS <dominio>`).
- **SMTP no configurado** antes de Fase 4 → el magic-link no se envía y el operador no puede loguearse; bloquear Fase 4 hasta tener credenciales.
- **`OPENCLAW_GATEWAY_TOKEN` desalineado** entre MC y daemon → el chat falla con 401; el token debe ser byte-exact en ambos lados.
- **Buildpack de Coolify insuficiente** para Next.js standalone o el daemon → escribir Dockerfile explícito.
- **Lock-out de SSH** al aplicar `ufw` → permitir SSH (rate-limited) ANTES de activar `default deny`; no cerrar la sesión activa hasta verificar.
- **Keys opcionales ausentes** (Telegram, voice, OpenAI para memoria semántica) → fail-soft: el daemon arranca con WARN, sin morir.

---

## Contexto

> Voz: impersonal.

### Documentación externa
- Coolify self-hosted install — https://coolify.io/docs/installation — instalación oficial one-liner + gestión de servicios/apps.
- Supabase self-hosted (Docker) — https://supabase.com/docs/guides/self-hosting/docker — variables `.env` (JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SMTP_*), servicios (Kong, GoTrue, PostgREST, Realtime, Storage).
- Cloudflare Tunnel (remotely-managed / cloudflared) — https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/ — rutas multi-hostname → servicios internos.
- Cloudflare Access — https://developers.cloudflare.com/cloudflare-one/policies/access/ — policy por email para `coolify.<dominio>`.
- pgvector — extensión requerida por las 4 RPCs de memoria semántica (`agent_memories`).
- Next.js standalone output — https://nextjs.org/docs/app/api-reference/config/next-config-js/output — `output: 'standalone'` para imagen Docker mínima.

### Código existente a consultar
- `supabase/migrations/20260101000000_initial_schema.sql` — schema de las 22 tablas core + RPCs de memoria semántica; aplicar contra el Postgres self-hosted.
- `supabase/seed-demo.sql` — datos demo opcionales (Pregunta 7 de INTERVIEW).
- `setup/scripts/seed-supabase.sh` — adaptar: conexión directa `psql`/connection string interna, NO el CLI apuntando a la nube.
- `setup/scripts/start-cloudflare-tunnel.sh` — inspiración; adaptar a multi-subdominio (mc / agent / supabase / coolify).
- `setup/scripts/generate-vapid.sh` — VAPID keys para push PWA.
- `setup/scripts/smoke-test.sh` — adaptar: MC SSR, `/healthz` del daemon vía túnel, login magic-link real, chat streaming.
- `agent-server/.env.example` — plantilla de env del daemon (`OPENCLAW_GATEWAY_TOKEN`, `LLM_PROVIDER`, Supabase, etc.).
- `agent-server/src/llm-adapter/` — adapter cross-provider; `LLM_PROVIDER` selecciona claude-code-sdk / anthropic-api / openrouter.
- `mission-control/next.config.ts` — sin `output` config aún; añadir `output: 'standalone'` para el Dockerfile.

### Gotchas conocidas
- **Ni `mission-control/` ni `agent-server/` traen Dockerfile** — hay que escribir ambos (confirmado empíricamente).
- **`mission-control/next.config.ts` no tiene `output: 'standalone'`** — sin esto la imagen Docker de Next.js es pesada e incompleta.
- **`mission-control/` no trae `.env.example`** — derivar las env del MC del código + del brief (`MC_BASE_URL`, `MISSION_CONTROL_ORIGIN`, `NEXT_PUBLIC_SUPABASE_URL`, etc.).
- **RLS antes del primer write** — las tablas del schema ya declaran RLS; verificar que quede activo tras la migración.
- **pgvector debe habilitarse** (`CREATE EXTENSION vector`) antes de aplicar las RPCs de `agent_memories`.
- **Postgres :5432 solo en red interna de Docker** — nunca publicar el puerto al host ni al túnel. Lo único ruteado de Supabase es Kong.
- **SMTP es prerequisito duro de GoTrue** — sin SMTP no hay magic-link, sin magic-link no hay login.
- **`OPENCLAW_GATEWAY_TOKEN` byte-exact** en MC y daemon; cualquier divergencia rompe el gateway.
- **URLs Supabase duales**: el browser usa `https://supabase.<dominio>` (público vía Kong); el daemon puede usar la URL interna de Docker donde aplique.
- **Cero secretos en stdout** (regla del template): sembrar via `>> .env` + verificar con `grep -c`, nunca `cat`/`echo`.

### Modelo de datos (si aplica)

No se crean tablas nuevas. Se aplica el schema existente (`supabase/migrations/20260101000000_initial_schema.sql`) contra el Postgres self-hosted: 22 tablas core (profiles, agents, tasks, conversations, messages, chat_sessions, chat_messages, ops_events, push_subscriptions, notifications, drawings, draw_canvases, agent_notifications, scheduled_tasks, labels, documents, saved_views, agent_memories, …) con RLS activo + las 4 RPCs de memoria semántica sobre `agent_memories` (requieren `pgvector`).

---

## Directiva de Stack heredada

> Voz: impersonal. Derivada del brief origen (el brief no trae bloque KEEP/ADD/... formal; se sintetiza de sus "Desviaciones explícitas").

### Clasificación
- **Tipo**: Deploy / Infraestructura self-hosted (DevOps de un producto Next.js + daemon + Supabase).
- **Compatibilidad con Praxis**: **PARTIAL** — el stack de aplicación (Next.js 16 + React 19 + Supabase + Claude Agent SDK + daemon Node) se conserva byte-exact; la capa de infraestructura/deploy se reemplaza por completo.

### KEEP
- `mission-control/` (Next.js 16 + React 19 + Tailwind + shadcn) — sin cambios de lógica.
- `agent-server/` (Node 20 + better-sqlite3 scheduler + grammY) — sin cambios de lógica.
- Supabase (Auth + DB + RLS + Storage) como motor — pero self-hosted.
- Adapter LLM cross-provider (`LLM_PROVIDER`).
- Schema y migraciones existentes.

### ADD
- **Coolify** (self-hosted PaaS) — orquesta build/deploy/health/restart de todos los servicios.
- **Supabase self-hosted** (stack Docker: Postgres + Kong + GoTrue + PostgREST + Realtime + Storage) como servicio en Coolify.
- **`cloudflared`** (Cloudflare Tunnel) — contenedor o systemd, rutas multi-subdominio.
- **Cloudflare Access** — policy por email para `coolify.<dominio>`.
- **Dockerfile para `mission-control/`** (build Next.js standalone).
- **Dockerfile para `agent-server/`** (Node 20 + build TS + volúmenes persistentes SQLite scheduler + `.claude/agent-memory/`).
- **Hardening**: usuario no-root con sudo, `ufw`, `fail2ban`, `unattended-upgrades`.
- **SMTP externo** (Resend/Brevo) para GoTrue.
- **pg_dump** diario (retención) + backup del SQLite del daemon.

### REPLACE
- **nginx + Let's Encrypt → Cloudflare Tunnel** (TLS + routing). NO escribir `install-nginx-letsencrypt.sh` (no existe y no hace falta).
- **Vercel → Coolify** para el Mission Control. `deploy-vercel.sh` no aplica.
- **Supabase Cloud → Supabase self-hosted** en Coolify. `seed-supabase.sh` se adapta a `psql` con connection string interna.
- **systemd/service-manager para el daemon → contenedor gestionado por Coolify**. Ignorar `install-service-manager.sh`.

### REMOVE
- `setup/scripts/install-nginx-letsencrypt.sh` (no se usa; ni siquiera existe).
- `setup/scripts/deploy-vercel.sh` (no aplica).
- `setup/scripts/install-service-manager.sh` (reemplazado por Coolify).

### CONFIG
- `mission-control/next.config.ts` → añadir `output: 'standalone'`.
- Postgres → `pgvector` habilitado; puerto 5432 solo en red interna de Docker (nunca publicado).
- `.env` MC + daemon → `OPENCLAW_GATEWAY_TOKEN` byte-exact, `MC_BASE_URL=https://mc.<dominio>`, `MISSION_CONTROL_ORIGIN=https://mc.<dominio>`, `NEXT_PUBLIC_SUPABASE_URL=https://supabase.<dominio>`, URL interna de Docker para el daemon donde aplique.
- GoTrue → `SMTP_*` sembrado; `SITE_URL`/redirect a `https://mc.<dominio>`.
- Cloudflare → 4 rutas de túnel + Access policy en `coolify.<dominio>`.

### Refinamientos a la Directiva durante este PRP
- Confirmado que faltan ambos Dockerfiles y el `output: 'standalone'` → son subtareas de la Fase 5 (y prerequisito de build en Coolify).
- `mission-control/` no trae `.env.example` → derivar el set de env del MC en la Fase 5 leyendo el código.

---

## Supuestos heredados

> Voz: impersonal. Lo que tiene que ser verdad antes de que el bucle-agentico arranque cada fase.

- [ ] VPS Ubuntu aprovisionado, 6 vCPU / 12 GB RAM / 200 GB SSD, acceso SSH root, agente corriendo en el VPS. **(Verificado: Ubuntu 5.15, 6 vCPU, 11 GB RAM, 191 GB libres, root.)**
- [ ] Dominio propio con DNS migrado a Cloudflare (nameservers apuntando a CF). **Verificar con `dig NS <dominio>` antes de la Fase 3; si no propagó, pausar y avisar.**
- [ ] Soberanía de datos no negociable: DB dentro del VPS, nada de Supabase Cloud ni Vercel.
- [ ] Zero Trust: cero puertos públicos salvo SSH; todo entra por Cloudflare Tunnel.

### Supuestos adicionales (específicos de este PRP)
- [ ] El operador puede aportar credenciales SMTP (Resend/Brevo) antes de la Fase 4.
- [ ] El operador tiene una cuenta Cloudflare con el dominio, y puede autorizar el túnel (token de API o login `cloudflared`).
- [ ] El operador elige nombre de agente + `LLM_PROVIDER` + provee la key correspondiente.

---

## Fuera de Alcance heredado

> Voz: impersonal. Derivado del brief origen.

- **NO** nginx + Let's Encrypt (TLS/routing lo resuelve Cloudflare Tunnel).
- **NO** Vercel (MC se despliega en Coolify).
- **NO** Supabase Cloud (Supabase self-hosted en Coolify).
- **NO** exponer Postgres :5432 fuera de la red interna de Docker.
- **NO** exponer la IP del VPS ni abrir puertos públicos salvo SSH.
- **NO** exponer Supabase Studio (salvo que el operador lo pida, y solo detrás de Cloudflare Access).
- **NO** gestionar el daemon con systemd (lo gestiona Coolify).

### Fuera de Alcance adicional (específico de este PRP)
- Migración de datos preexistentes (es un deploy limpio).
- Alta disponibilidad multi-nodo / réplicas de Postgres (un solo VPS).
- CDN/edge caching más allá de lo que Cloudflare da por default.

---

## Aprendizajes heredados de fases previas

> Voz: impersonal.

No hay aprendizajes heredados — primer PRP del brief `vps-soberano`. La sección `## Aprendizajes acumulados` de `CLAUDE.md` está vacía.

---

## Plan de implementación

> IMPORTANTE: solo se definen FASES aquí. Las subtareas se generan al ENTRAR a cada fase
> siguiendo el bucle-agentico (mapear contexto → generar subtareas → ejecutar). Cada nivel
> planea solo su propio nivel.

### Fase 1: Hardening
- **Objetivo**: dejar el VPS endurecido — usuario no-root con sudo, `ufw default deny incoming` + allow SSH rate-limited, `fail2ban`, `unattended-upgrades`.
- **Validación**: `ufw status` = deny incoming + solo SSH permitido; `fail2ban-client status sshd` activo; usuario no-root con sudo puede escalar; la sesión SSH activa NO se pierde al aplicar reglas.

### Fase 2: Coolify
- **Objetivo**: instalar Coolify (installer oficial), panel operativo pero accesible solo vía túnel + Access (mientras no exista el túnel, acceso por SSH port-forward — nunca abriendo el puerto).
- **Validación**: Coolify corriendo (`docker ps` lo muestra healthy); panel accesible por `localhost:8000` vía SSH port-forward; puerto 8000 NO abierto en `ufw`.

### Fase 3: Cloudflare Tunnel
- **Objetivo**: `cloudflared` (contenedor o systemd) con las 4 rutas — `mc`/`agent`/`supabase`/`coolify` → destinos internos — y Access policy (solo email del operador) en `coolify.<dominio>`.
- **Validación**: `dig NS <dominio>` confirma Cloudflare; cada subdominio resuelve por el túnel; `coolify.<dominio>` exige login Access; ningún puerto de app abierto en `ufw`.

### Fase 4: Supabase self-hosted
- **Objetivo**: desplegar el stack Supabase self-hosted en Coolify + SMTP para GoTrue + `pgvector` + aplicar `supabase/migrations/20260101000000_initial_schema.sql` + verificar las 4 RPCs de memoria semántica.
- **Validación**: Kong accesible vía `supabase.<dominio>`; Postgres :5432 solo en red interna; migración aplicada (count de tablas); RLS activo en todas; `CREATE EXTENSION vector` OK; las 4 RPCs de `agent_memories` responden; magic-link de prueba sale por SMTP.

### Fase 5: Apps (Mission Control + agent-server)
- **Objetivo**: escribir Dockerfiles (MC standalone + daemon con volúmenes persistentes), añadir `output: 'standalone'`, desplegar ambos en Coolify, sembrar `.env` (`OPENCLAW_GATEWAY_TOKEN` byte-exact, `MC_BASE_URL`/`MISSION_CONTROL_ORIGIN=https://mc.<dominio>`, URLs Supabase públicas para browser + internas para daemon), VAPID keys.
- **Validación**: MC responde SSR en `mc.<dominio>` con auth gate → `/login`; daemon responde `/healthz` vía `agent.<dominio>` con Bearer; `docker ps` healthy; volúmenes del daemon persisten SQLite + agent-memory.

### Fase 6: Operación (validación final)
- **Objetivo**: backups (pg_dump diario con retención + backup del SQLite del daemon), smoke test end-to-end, monitoreo (sugerencia UptimeRobot → `https://agent.<dominio>/healthz`), verificar resiliencia a reinicio.
- **Validación**:
  - [ ] Todos los criterios de éxito de `## Qué` cumplidos.
  - [ ] `curl https://agent.<dominio>/healthz` OK desde internet; `curl http://<IP>:3099` desde afuera dropea.
  - [ ] Login magic-link end-to-end en `mc.<dominio>`; mensaje de chat persistido en `chat_messages`.
  - [ ] `docker ps` all healthy; `reboot` del VPS levanta todo solo (restart policies).
  - [ ] Cron de prueba desde la UI dispara a la hora indicada.
  - [ ] pg_dump diario + backup SQLite programados y verificados una vez.

---

## Aprendizajes

> Esta sección crece con cada error durante la ejecución del bucle-agentico.

### 2026-07-16: Docker bypassea ufw — hay que blindar la cadena DOCKER-USER
- **Error**: tras instalar Coolify, `coolify-proxy` y `coolify` publican `0.0.0.0:80/443/8000/8080`. Docker inserta sus reglas iptables por debajo de la cadena INPUT que gobierna `ufw`, así que `ufw default deny incoming` NO bloquea puertos publicados por Docker — quedaban expuestos a internet, violando el Zero Trust del brief.
- **Fix**: reglas en la cadena `DOCKER-USER` scoped a la interfaz WAN (`eth0`): `ACCEPT` para ESTABLISHED,RELATED + `DROP` para todo lo nuevo entrante. El túnel Cloudflare entra por conexión saliente, así que no necesita puertos abiertos. Persistido con un servicio systemd (`praxis-docker-firewall.service`, `After=docker.service`) para sobrevivir reinicios y restarts de Docker. Verificado: red interna Docker + egress intactos; panel solo alcanzable por localhost/SSH port-forward.
- **Aplicar en**: cualquier deploy Docker + ufw en el que se exija Zero Trust. Reutilizable en Fase 3 (el túnel no requiere abrir puertos) y Fase 6 (criterio de éxito: `curl http://<IP>:3099` desde afuera debe dropear).

### 2026-07-16: Tokens `cfut_` vs `cfat_` — verificar contra el endpoint equivocado simula un token inválido
- **Error**: el API token de Cloudflare creado para Access se validó contra `GET /client/v4/user/tokens/verify` y devolvió `1000 Invalid API Token`. Se diagnosticó como token mal transcrito y se hizo rollear el token al operador (perdiendo el original) y desarmar el filtro de IP — dos acciones destructivas persiguiendo una causa inexistente. El token era válido desde el principio.
- **Fix**: Cloudflare tiene dos clases de credencial con prefijo distinto y endpoints de verificación distintos. `cfut_` = **user token** → `/client/v4/user/tokens/verify`. `cfat_` = **account token** (los que emite la pantalla "Account API tokens") → `/client/v4/accounts/{account_id}/tokens/verify`. Un account token contra el endpoint de user devuelve `1000`, indistinguible de un string corrupto. Verificado: mismo token, endpoint scoped a cuenta → `{"success":true,"status":"active"}`.
- **Aplicar en**: toda credencial de Cloudflare en Fases 4-6. Leer el prefijo antes de elegir el endpoint. Regla general: cuando una credencial falla, comparar contra otra credencial que SÍ funcione (aquí, el `apiToken` del `cert.pem`, prefijo `cfut_`) aísla la variable real. `1000` de Cloudflare es deliberadamente ambiguo — cubre token inválido, endpoint equivocado y rechazo por filtro de IP.

### 2026-07-16: El VPS sale a internet por IPv6 por default
- **Error**: se restringió el API token de Cloudflare por IP de cliente a `147.93.187.127` (la IPv4). Pero el egreso por default del VPS es **IPv6**: `curl https://api.cloudflare.com/cdn-cgi/trace` devuelve `ip=2605:a143:2270:8711::1`. El conector del túnel ya lo registraba como ORIGIN IP y pasó desapercibido. Un filtro solo-IPv4 rechaza toda llamada que no fuerce `-4`.
- **Fix**: en filtros de IP de Cloudflare incluir ambas: `147.93.187.127` y `2605:a143:2270:8711::1`. Alternativa por llamada: `curl -4`.
- **Aplicar en**: cualquier allowlist por IP que involucre a este VPS (Cloudflare, SMTP en Fase 4, webhooks, UptimeRobot en Fase 6). La IPv4 no es la identidad de red por default de este host.

### 2026-07-16: Publicar el panel de Coolify antes de Access regala la cuenta admin
- **Error**: al crear la ruta `coolify.gannetlabs.com` en el túnel, el panel quedó accesible desde internet respondiendo `302` — la pantalla de **registro inicial**, con la cuenta admin todavía sin crear. Cualquiera que abriera esa URL se hacía administrador del panel que orquesta todo el VPS. `coolify.` es un subdominio trivial de adivinar y el VPS está bajo escaneo activo (fail2ban con 6 IPs baneadas). El orden de las subtareas creó la exposición: se ruteó el hostname antes de que existiera su control de acceso.
- **Fix**: regla de ingress de `coolify` comentada en `/etc/cloudflared/config.yml` + `systemctl restart cloudflared`. Verificado: `coolify.gannetlabs.com` → `404` (catch-all) desde internet; panel intacto en `localhost:8000`. Acceso interino por SSH port-forward. La regla se restaura solo cuando Access esté enforcing.
- **Aplicar en**: cualquier hostname cuyo backend tenga registro-inicial abierto o auth aún no configurada. **Access primero, ruta después** — o crear la cuenta admin antes de rutear. Vale para Supabase Studio (Fase 4) y para el panel en Fase 6.

### 2026-07-16: El resolver local del VPS cachea el DNS viejo y rompe toda verificación
- **Error**: tras migrar los nameservers a Cloudflare, todo `curl` desde el VPS a `*.gannetlabs.com` fallaba con exit 6 (`couldn't resolve host`), simulando un túnel roto. La causa es el resolver local (`127.0.0.53`, systemd-resolved) que sigue sirviendo `ns1/ns2.dns-parking.com` con TTL ~7000 s; `resolvectl flush-caches` no lo limpia porque el upstream también cachea. La delegación real ya estaba correcta.
- **Fix**: verificar contra la autoridad, no contra el caché. `dig +short NS <dominio> @1.1.1.1` para la zona, y para HTTP: `CFIP=$(dig +short <host> @1.1.1.1 | head -1); curl --resolve <host>:443:$CFIP https://<host>`.
- **Aplicar en**: toda validación desde el VPS en Fases 4-6. Un fallo de resolución local NO es evidencia de que el túnel o el deploy estén rotos — verificar siempre saltando el resolver antes de diagnosticar.

### 2026-07-16: `enabled` no es `active` — el servicio del firewall nunca se había ejecutado
- **Error**: `praxis-docker-firewall.service` se creó y se habilitó, y las reglas `DOCKER-USER` se aplicaron a mano en la misma sesión. Pero el servicio nunca se arrancó: reportaba `inactive (dead)` cuando, con `Type=oneshot` + `RemainAfterExit=yes`, un arranque exitoso debe reportar `active (exited)`. Estaba `enabled`, así que habría corrido en el próximo boot — pero la persistencia del perímetro Zero Trust dependía de un servicio que jamás se ejecutó ni se verificó una sola vez. El estado "reglas cargadas en memoria" enmascaraba el hueco.
- **Fix**: `systemctl start praxis-docker-firewall.service` → `active`. Cadena `DOCKER-USER` verificada sin duplicados (el script es idempotente: borra en loop con `iptables -D` antes de reinsertar con `-I`).
- **Aplicar en**: cualquier unidad systemd que persista estado de infraestructura. Habilitar no prueba nada; arrancar y verificar `is-active` en la misma sesión en que se crea la unidad es lo que la prueba. Vale para las restart policies de la Fase 6.

### 2026-07-16: DNS de `gannetlabs.com` parkeado en Hostinger — Fase 3 bloqueada
- **Error**: el supuesto heredado del brief ("dominio con DNS ya migrado a Cloudflare") es falso. `dig +short NS gannetlabs.com` devuelve `ns1.dns-parking.com` / `ns2.dns-parking.com`, con SOA en `dns.hostinger.com` y un registro A a `2.57.91.91` (IP de parking de Hostinger, no el VPS). El dominio nunca se agregó a Cloudflare.
- **Fix**: se dispara el caso borde ya documentado en `## Casos borde` → Fase 3 pausada sin tocar nada. El desbloqueo requiere acceso a las cuentas del operador (agregar el dominio a Cloudflare, cambiar nameservers en Hostinger, esperar propagación), lo cual el agente no puede hacer por él.
- **Aplicar en**: verificar los supuestos de infraestructura con un comando diagnóstico ANTES de entrar a la fase que los consume, no al planearla. El gate `dig NS` estaba escrito en el PRP y funcionó exactamente como se diseñó.

### 2026-07-16: Entorno del VPS verificado
- **Contexto**: VPS = `147.93.187.127`, WAN `eth0`, Ubuntu 5.15, 6 vCPU, 11 GB RAM, 191 GB libres, root. Coolify **4.1.2**, Docker **29.6.1**. Usuario no-root `ubuntu` (ya existía en la imagen cloud) endurecido con sudo + llave SSH de root.
- **Aplicar en**: referencia de infraestructura para todas las fases.

---

## Anti-patrones

- **NO generar nuevos PRPs durante la ejecución de este PRP** (un PRP = una sola sesión, un solo plan).
- No exponer Postgres :5432 al host ni al túnel — solo red interna de Docker.
- No abrir puertos públicos en `ufw` salvo SSH.
- No usar nginx/Let's Encrypt ni Vercel ni Supabase Cloud (contradicen el brief).
- No imprimir secretos en stdout (`cat`/`echo` de `.env`); sembrar con `>>` + verificar con `grep -c`.
- No aplicar `ufw default deny` sin haber permitido SSH antes (rate-limited).
- No usar `any` en TypeScript (usar `unknown`); toda entrada del operador pasa por Zod.
- No dejar tablas Supabase sin RLS activo.
- No hardcodear el dominio ni el `OPENCLAW_GATEWAY_TOKEN` en código fuente.
- No pedir al operador que tipee comandos de shell ni git — el agente los ejecuta.

---

## Comandos de validación final

```bash
# Infra
docker ps --format '{{.Names}}\t{{.Status}}'          # todos healthy
ufw status verbose                                     # deny incoming + solo SSH
dig NS <dominio>                                       # nameservers Cloudflare

# Perímetro Zero Trust
curl -sS https://agent.<dominio>/healthz               # OK desde internet
curl -sS --max-time 5 http://<IP-del-VPS>:3099         # DEBE fallar (timeout/drop)

# Apps
bash setup/scripts/smoke-test.sh                       # adaptado: MC SSR + daemon healthz + magic-link + chat
# MC: build Next.js standalone
cd mission-control && npx tsc --noEmit && npm run lint && npm run build
# Daemon
cd agent-server && npm run typecheck && npm run build && npm run test
```

---

*PRP pendiente aprobación. No se ha modificado código.*
