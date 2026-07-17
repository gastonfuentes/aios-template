# Troubleshooting — catálogo de errores comunes

> **TL;DR**: Catálogo condensado de errores frecuentes con fixes accionables. Extraído de aprendizajes históricos del template (PRP-001 a PRP-036). Si tu síntoma está aquí, hay fix probado.

---

## Setup inicial

### Magic-link `email rate limit exceeded`

**Causa**: SMTP nativo Supabase cap 2/h.

**Fix**: Configurar SMTP custom (Resend recomendado).
1. Crea cuenta en [resend.com](https://resend.com).
2. Verify domain `mail.<tudominio.com>` con DKIM/MX/SPF en Cloudflare DNS.
3. Supabase Dashboard → Authentication → Email Templates → SMTP Settings:
   ```
   Host: smtp.resend.com
   Port: 465
   Username: resend
   Password: <resend-api-key>
   Sender: noreply@mail.<tudominio.com>
   ```
4. PATCH rate limit a `rate_limit_email_sent: 30` (10x del default).

---

### Daemon `EADDRINUSE :::3099` al arrancar

**Causa**: Otro proceso ocupando el puerto (probablemente daemon previo no terminó limpio).

**Fix**:
```bash
lsof -ti:3099 | xargs kill -9
# o si tienes el PID lockfile:
rm agent-server/store/daemon.pid
```

---

### `next dev` arroja `react-hooks/set-state-in-effect`

**Causa**: ESLint stricter del template prohíbe `setState` directo en `useEffect`.

**Fix**: 3 patrones canónicos según caso:
- Estado derivado de input → `useMemo` sin effect.
- Async probing externo → fn pura + `cancelled` flag.
- Trigger boolean → mover `setState` al handler.

Para fetch HTTP on mount sin Suspense, único caso legítimo de `eslint-disable-next-line`:
```ts
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void load();  // load() hace await fetch + setState
}, []);
```

---

### `npm install` falla en `node-gyp`

**Causa**: Dep nativa (better-sqlite3, sharp, bcrypt) sin binding para Node version.

**Fix**:
```bash
# Verificar engines de la dep
npm view <pkg> engines
# Bumpear a versión que declare Node 20+
npm install <pkg>@latest
```

Si persiste, instala build tools del sistema:
```bash
# macOS
xcode-select --install

# Linux Ubuntu
sudo apt install -y build-essential python3
```

---

## Auth & Supabase

### PWA `/chat` carga pero sin sesiones, sidebar vacío

**Causa**: Daemon offline. Las rutas degradan graceful con `[]` cuando el daemon no responde.

**Fix**:
```bash
# macOS
launchctl print gui/$UID/com.<agent>.agent
# Si "crashed":
launchctl kickstart -k gui/$UID/com.<agent>.agent
tail -f ~/Library/Logs/<agent>/agent.err.log

# Linux
systemctl --user status <agent>-agent
journalctl --user -u <agent>-agent -f
```

---

### Supabase advisor WARN `is_owner` SECURITY DEFINER

**Causa**: Falso positivo consciente (clase B). El body de `is_owner()` filtra internamente por `auth.uid()`.

**Fix**: No silenciar. Es seguro. Documentado en arquitectura del template.

---

### `CREATE EXTENSION <ext>` queda en schema `public` y dispara advisor

**Causa**: Falta cláusula `SCHEMA extensions` en el `CREATE EXTENSION`.

**Fix**:
```sql
-- Migración fix
ALTER EXTENSION vector SET SCHEMA extensions;
-- O incluir SCHEMA en la migración inicial:
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;
```

---

## Deploy & Vercel

### Vercel `aios` no auto-deploya desde push

**Causa**: Project `link=None`.

**Fix**:
```bash
cd mission-control
npx vercel git connect <repo-url> --yes
npx vercel project inspect <project-name>
# Verifica que "Connected Git Repository" no diga None
```

---

### `vercel env add VAR` con `\n` literal en el valor

**Causa**: `echo` añade newline al pipeline.

**Fix**:
```bash
printf "%s" "$VAL" | vercel env add VAR production
# Verifica
vercel env pull --environment=production .env.check
```

---

### CORS bloqueado en daemon

**Causa**: `MISSION_CONTROL_ORIGIN` no incluye el origin del browser.

**Fix**:
```bash
# agent-server/.env (CSV multi-origin)
MISSION_CONTROL_ORIGIN=https://mc.dominio.com,http://localhost:3000

# Restart daemon
launchctl kickstart -k gui/$UID/com.<agent>.agent
```

CORS + bearer NO acepta wildcard `*` — debe echo-back el origin exact.

---

## Tunneling

### Cloudflare Tunnel `auth expired`

**Fix**:
```bash
cloudflared tunnel login
# OAuth abre en browser
```

---

### Tailscale Funnel `Funnel not enabled`

**Fix**: Habilitar en admin panel:
1. [login.tailscale.com/admin/dnssetup](https://login.tailscale.com/admin/dnssetup) → Toggle MagicDNS ON.
2. [login.tailscale.com/admin/acls](https://login.tailscale.com/admin/acls) → Agregar `nodeAttrs: ["funnel"]` a tu tag.

---

### ngrok URL random rota tras restart

**Causa**: Free tier no preserva URL.

**Fix**: Upgrade a paid plan ($8/mes Personal) para custom domain. O re-sembrar env vars cada restart si aceptas free tier.

---

## SDK & LLM provider

### `claude: command not found`

**Causa**: CLI no instalado o PATH sin `/opt/homebrew/bin`.

**Fix**:
```bash
# Verificar instalación
which claude
ls /opt/homebrew/bin/claude

# Si falta:
npm install -g @anthropic-ai/claude-code

# Verificar PATH del daemon (launchd)
launchctl print gui/$UID/com.<agent>.agent | grep PATH
# Debe incluir /opt/homebrew/bin en EnvironmentVariables.PATH
```

---

### Memory Tool NO recall en sesión nueva

**Causa**: Mismatch entre `agentType` y filename del subagente.

**Fix**: Verificar:
- `.claude/agents/<lowercase>.md` filename matchea `agentType` esperado.
- Path canónico `.claude/agent-memory/<lowercase>/` existe.
- Frontmatter del subagente tiene `memory: project`.

---

### OpenRouter `429 rate limited`

**Causa**: Free tier o tier 1 inicial.

**Fix**:
- Load créditos en [openrouter.ai/credits](https://openrouter.ai/credits).
- Configura fallback automático: `OPENROUTER_FALLBACK_MODELS=openai/gpt-5,google/gemini-2.5-pro`.

---

## Build & lint

### `npm run lint --max-warnings=0` rompe con `Unused eslint-disable directive`

**Causa**: `eslint-disable-next-line` puesto sin que la regla efectivamente flagee la línea.

**Fix**: Remover el disable directive. Solo suprimir cuando ESLint efectivamente marca el call. La regla `react-hooks/set-state-in-effect` solo flagea setState directos en effects, NO setState en callbacks (EventSource, fetch.then, etc.).

---

### `npx tsc --noEmit` reporta TS2307 sobre archivos que existen

**Causa**: `.next/dev/types/validator.ts` stale tras eliminar rutas.

**Fix**:
```bash
rm -rf mission-control/.next
cd mission-control && npm run dev
# Typegen se regenera limpio
```

---

## Git

### `git push` falla `rejected non-fast-forward`

**Causa**: Remote avanzó.

**Fix**:
```bash
git pull --rebase
git push
```

Si requiere force push (raro), pregunta al operador antes — política `--force` prohibida sin orden explícita.

---

## Otros

### `cd <dir> && git ...` requiere permission prompt en sandbox

**Causa**: Compound command dispara sandbox alert.

**Fix**: Quitar el `cd` prefix. `git` opera sobre el cwd actual del agente.

---

### Bash `for f in $FILES; do ...` falla en zsh con un solo path concatenado

**Causa**: zsh NO word-splittea `$()` por default.

**Fix**: Usar `while IFS= read -r f`:
```bash
grep -rl <pattern> <dir> | while IFS= read -r f; do
  echo "Processing: $f"
done
```

Funciona idéntico en bash y zsh.

---

## Cuando nada funciona

Si tu síntoma NO está en este catálogo:

1. Lee `BOOT.md` para protocolo de investigación 6-pasos.
2. Pídele al agente que diagnostique con MCPs disponibles (`get_logs`, `get_advisors`, `list_tables`).
3. Abre issue en GitHub con: error completo + stack trace + cuadrante elegido + OS + Node version.
4. Si reproducible, el operador del template responde con fix + agrega entry a este doc.
