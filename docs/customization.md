# Customización post-deploy

> **TL;DR**: Cómo el operador adapta el MC a su negocio. Cambia identidad, branding, agrega tablas BI propias, escribe skills custom, modifica wallpapers y crons.

---

## Identidad del agente

3 archivos canónicos en `.claude/identity/`:

### `SOUL.md` — voz y valores
Cómo se comporta tu agente. Reemplaza placeholders del template:
- Nombre, voz, valores.
- Communication style.
- Hard limits (qué NO hará).
- Continuity (cómo se reconoce cross-session).

### `USER.md` — perfil del operador
Quién eres. Reemplaza:
- Modelo de negocio.
- Audiencias.
- Modus operandi.
- Preferencias.

### `HEARTBEAT.md` — cron jobs activos
Espejo declarativo de cron jobs. Lista los activos con schedule + propósito.

**Cómo editar**: simplemente `Edit` los archivos. Cambios se aplican a la próxima sesión (`settingSources: ['project','user']` los relee).

---

## Branding visual

### Logo / brand mark

Reemplaza `mission-control/public/brand-mark-source.png` con tu logo (1024×1024 recomendado, PNG con transparencia o fondo opaco).

Regenera los icons:
```bash
cd mission-control
npm run icons:generate
```

Pipeline canónico macOS 26 squircle clip aplica automáticamente:
- `icon-aios.png` con clip squircle 22% radius (PWA + web + iOS).
- `icon-aios-fullbleed.png` sin clip (Android maskable).
- 6 variantes generadas (32/192/512/512-maskable/apple-touch-icon/favicon).

### Wallpapers

Reemplaza `mission-control/public/wallpaper-aurora.png` con tu wallpaper preferido. Recomendado: 1920×1080+ con feel de tu marca.

Si quieres ofrecer múltiples wallpapers al operador, edita `mission-control/src/core/components/macos/WallpaperLibrary.tsx`.

### Tipografía

Default: SF Pro stack nativo (`-apple-system, "SF Pro", ...`). No webfont propio.

Para cambiar a tu tipografía custom:
1. Agrega `@font-face` a `src/app/globals.css` con tu woff2.
2. Edita `--font-system` var en `tokens.css` para apuntar a tu nueva fuente.

---

## Tablas BI custom

El template viene con 26 tablas core. Si tu negocio necesita métricas custom (funnel, comunidad, revenue, pipeline), tienes 2 caminos:

### Camino 1: Adoptar las tablas BI de referencia

`examples/bi-tables/` incluye migraciones referenciales para:
- `funnel_events` — taxonomía cerrada de eventos top-of-funnel.
- `community_metrics` — snapshots semanales/mensuales de tu comunidad.
- `youtube_metrics` — retention/views/CTR de canal YouTube.
- `revenue_snapshot` — MRR mensual por fuente.
- `agencia_pipeline` — leads y stages para agencia.

Copia las que te sirvan a `supabase/migrations/` y aplica:
```bash
cd supabase
supabase db push
```

### Camino 2: Diseñar tus propias

1. Crea archivo `supabase/migrations/<timestamp>_<feature>.sql`.
2. Define tablas + RLS owner-only via política canónica:
   ```sql
   ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "owner_full_access" ON public.<table>
     FOR ALL TO authenticated
     USING (public.is_owner()) WITH CHECK (public.is_owner());
   ```
3. Aplica via `supabase db push` o MCP Supabase `apply_migration`.

---

## Skills custom

Las 16 skills universales viven en `.claude/skills/`. Para agregar tus propias:

### Opción A: Copiar de ejemplos

`examples/skills/` incluye skills de inspiración:
- Análisis de métricas de YouTube.
- Gestión de comunidad Skool.
- Funnel tracking con drill-down.
- Pipeline de contenido para creators.

Copia las que te sirvan a `.claude/skills/<name>/` y ajusta el frontmatter + body a tu contexto.

### Opción B: Usar `skill-creator`

Skill bundled del template. Activar pidiendo:

> Crea una skill que [descripción del use case].

`skill-creator` genera bundle siguiendo Skills 2.0 spec de Anthropic:
- Frontmatter validado (name, description tercera persona ≤1024 chars, allowed-tools).
- `SKILL.md` ≤ 500 líneas.
- `references/` one-level-deep.
- `scripts/` ejecutables.
- `evals/evals.json` ≥ 3 escenarios.

---

## Cron jobs custom

Los crons viven en SQLite del daemon (`agent-server/store/scheduler.db`).

### Agregar cron via UI

1. Abre MC PWA → `/scheduled`.
2. Click "+ Nuevo".
3. Define: nombre, schedule (cron expression), prompt al agente.

### Agregar cron via JSON seed

`examples/scheduled-jobs/` incluye ejemplos para:
- Daily briefing 6am.
- Nightly community pulse.
- Memory consolidation 3am.
- Monthly snapshot.

Copia los que quieras y aplícalos via daemon (`POST /schedule` o seed SQLite directo).

### Memoria viva del agente

3 capas disjuntas:

1. **Memoria operador curada** (`.claude/memory/*.md`): tú editas. Versionada en Git. Cero auto-injection.
2. **Memoria activa nativa** (`.claude/agent-memory/<agent>/*.md`): el agente escribe cuando le dices *"recuerda que..."*. Memory Tool nativo SDK (si Claude Code CLI).
3. **Memoria semántica indexada** (Supabase `agent_memories` o renombrada): espejo pgvector con embedding 1536d OpenAI. Retrieval por similitud coseno.

Lee `docs/architecture.md` para flow de datos completo.
