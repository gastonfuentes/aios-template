# Gannet OS — Demo Congreso Minero

> Working document. Source of truth for the mining congress demo.
> Last updated: 2026-07-19

## Purpose

This is a **sales demonstration** for a mining industry congress. It is not a
production system for a real customer. All data is fabricated by us.

Design consequence: defensive layers that matter in production (exhaustive
validation, hostile-input sanitization) carry much less weight here. What
matters is that it **looks alive** and **does not break on stage**.

## Concept

The demo is built around a fictional company: **Andes Servicios Integrales
S.A.**, a multidisciplinary mining supplier. Rather than showing the system for
a single-trade company, this lets any supplier visiting the stand recognize part
of their own business in the system.

### Pitch

> Gannet OS is the Operating System for Mining Supplier Companies.

One system to run every area of a supplier business — clients, projects, staff,
vehicles, equipment, purchasing, stock, documentation and operations — with
integrated AI to query the information conversationally.

## Andes Servicios Integrales — services

1. Industrial maintenance
2. Civil works
3. Industrial electricity
4. Instrumentation and automation
5. Welding and assembly
6. Transport and logistics
7. Machinery and equipment rental
8. Earthmoving
9. Camp services
10. Industrial cleaning

## Modules

| # | Module | Notes |
|---|---|---|
| 1 | Executive dashboard | |
| 2 | Client CRM | |
| 3 | Quotes | |
| 4 | Projects | |
| 5 | Work orders (OT) | |
| 6 | Purchasing | |
| 7 | Stock and warehouse | |
| 8 | Equipment and tools | |
| 9 | Vehicle fleet | |
| 10 | Human resources | |
| 11 | Invoicing | |
| 12 | Documentation | |
| 13 | Integrated AI | Natural-language queries |

## Target seed volume

| Entity | Records |
|---|---|
| Clients | 30 |
| Contacts | 120 |
| Employees | 140 |
| Vehicles | 45 |
| Equipment and tools | 280 |
| Work orders | 1,350 |
| Quotes | 420 |
| Invoices | 980 |
| Purchase orders | 640 |
| Tasks and activities | 5,000 |

Approximately 9,000 records total.

### Fictional clients (mining companies)

Litio del Norte, Puna Minerals, Altos Andes Mining, Sal de los Andes,
Cordillera Lithium, Andean Copper.

## Critical finding: the vision inverts the current data model

Verified against the database on 2026-07-19.

The **existing** `demo_mineria` schema assumes the user **is the mining
company**, watching its suppliers:

- `demo_mineria.proveedores` — 8 rows, `CHECK (rubro IN ('gas', 'transporte',
  'personal', 'obras'))`
- Four activity tables hanging off `proveedor_id`: `entregas_gas`,
  `viajes_transporte`, `turnos_personal`, `avances_obra`
- `avances_obra.mina` holds mine names as **free text**, not as entities

The **new** vision inverts the roles: the user *is* the supplier (Andes), and
the mining companies are its **clients**.

Consequences:

1. Mining companies are promoted from string field to first-class entity.
2. The 8 current `proveedores` are no longer the subject. At most they survive
   as subcontractors under Purchasing.
3. The `/proveedores` screen already in production (commit `49fb565`) does not
   fit the new narrative. It must be reframed or retired.
4. The four trade tables map naturally onto **work orders** — each row is work
   executed for a client.
5. The four-trade check constraint is too narrow for ten services.

## Technical debt now blocking

The `demo_mineria` schema and the `demo_*` views are **not versioned in this
repository** — they exist only in the remote Supabase database. With one screen
this was tolerable. With thirteen modules it is not.

**All new SQL must go through `supabase/migrations/`.**

## Timeline — congress is 2026-07-24

Five days from 2026-07-19. Day 5 is reserved for rehearsal and cannot absorb
feature work.

| Day | Scope | Rationale |
|---|---|---|
| 1 | New schema (Andes as subject) + seed generator (~9,000 records) | Everything else depends on it. Highest-leverage day of the week. |
| 2 | All 13 modules navigable, lists populated | Demo becomes showable end to end, even if shallow. |
| 3 | Executive dashboard + work orders, in depth | The two modules presented live. |
| 4 | Integrated AI over the new data | Closes the pitch. Reuses the existing agent-server chat. |
| 5 | **Rehearsal, deploy, fixes. No new features.** | Non-negotiable. |

Ordering is deliberate: every day ends with something showable. Building module
by module would leave three perfect modules and ten missing ones by day 4.

### Depth tiers

A stand visitor gives you three to four minutes. They watch two or three modules
closely, then click the rest to check whether it is real. Uniform depth across
thirteen modules is neither achievable nor necessary.

| Tier | Modules | Treatment |
|---|---|---|
| 1 — The show | Executive dashboard, work orders, integrated AI | Interactive, with drill-down |
| 2 — The reality check | Client CRM, projects, fleet, HR | Navigable, real detail |
| 3 — Density | Quotes, purchasing, stock, equipment, invoicing, documentation | Populated read-only lists |

The seed generator is the highest-return investment in the project. A
well-populated read-only table of 980 invoices reads as more real than a
beautiful empty form. It is what turns tier 3 from mockup into system.

## Decisions made

| Decision | Rationale |
|---|---|
| Data ingestion via drop-zone in Mission Control | The pitch is a sovereign VPS. Starting the flow with a file in Google's cloud contradicts the sales argument. Also avoids OAuth, polling, and dependence on venue connectivity. |
| No n8n | Not needed once ingestion is in-app. Verified not installed. |
| **Drop-zone — cut to stretch** | Does not survive the five-day cut. Eligible for day 5 morning only if day 4 ends with AI working *and* rehearsed, with a hard midday cutoff. |
| **Telegram agent — cut** | Deferred until after the congress. It depends on phone connectivity inside a crowded venue; if the bot fails live, the audience reads it as "the system doesn't work", not "the network is bad". |
| **`/proveedores` — hidden, not removed** | It contradicts the new narrative, but deleting it costs time. Remove from navigation only. |
| If time allows, prefer drop-zone over Telegram | The drop-zone runs entirely on the presenter's machine — no network, no third party, nothing that can fail on stage. |
| **Local copy of the full stack, as fallback** | Venue wifi in a crowded mining congress is unreliable. If the demo is served from the VPS and the network saturates, the whole demo dies — and the audience reads that as "the system doesn't work", not "the network is bad". |
| **Kiosk mode: `SELECT` granted to `anon`** | No login, so no session can expire mid-congress. All data is fictional, so there is nothing to protect. One less failure mode on stage. |
| **Record a video of the demo on day 4** | Plan C. Costs nothing and covers total failure — dead laptop, no power. Far better than a black screen at the stand. |

### Seeded delinquency levels — reviewed and kept

The seed produces 54.5% of YTD billing uncollected and 39% overdue
($16,959 M of $43,496 M). This was raised as a plausibility concern: a services
company carrying that much overdue receivable would not be solvent, and an
industry visitor may read the figures as obviously fabricated.

The operator reviewed the numbers and chose to keep them. Do not re-open this
or silently adjust the seed. If it ever needs changing, it changes in the seed
generator, not in the views.

### Consequence: versioned SQL is now load-bearing

Versioning all SQL under `supabase/migrations/` started as good hygiene. With a
local fallback it becomes the *only* way the stack can boot from scratch on the
presenter's laptop: start Postgres, run the migrations, run the generator, and
the demo is identical to the VPS with no network involved.

This makes one requirement non-negotiable: **the seed generator must be
deterministic.** Same script, same database, locally and on the VPS. A random
generator would produce two different demos — and you would rehearse on one
while presenting the other.

## Progress log

### Day 1 — 2026-07-19 — complete

- Schema `gannet_demo` designed and applied: 24 tables, 138 indexes, 255 column
  comments (the AI module reads those comments as its semantic dictionary).
- `demo_mineria` captured as a versioned baseline migration, so it is now
  reversible. Left otherwise untouched; `/proveedores` still serves its 8 rows.
- Seed generator: 29,592 records, pure SQL, runs in ~8s.
- 33 `public.gd_*` views. Slowest is 5.9 ms, so 10s polling has ample headroom.
- Broken DDL fixed in the chassis migration: `ALTER TABLE … ADD CONSTRAINT IF
  NOT EXISTS` is not valid Postgres. The initial migration could not run from
  scratch — which the local fallback depends on.

### Day 2 — 2026-07-19 — complete

- 12 modules built and navigable; `tsc`, lint and build all clean.
- Public route group `(demo)` so the modules open with no session. A route must
  be **both** in `GANNET_PUBLIC_ROUTES` and inside `(demo)` to be reachable — it
  fails closed if either is missing.
- `/proveedores` removed from navigation; route left intact.

#### Traps found and handled

| Trap | Consequence if missed |
|---|---|
| `PGRST_DB_MAX_ROWS=1000` truncates silently | The flagship work-orders module served 1,000 of 1,350 rows with no error. Fixed by paging until exhausted. |
| `setseed()` + `random()` is not order-stable | A parallel query plan produced different data. Rehearse on one demo, present another. Replaced with a pure hash. |
| Seed timezone vs. query timezone | Seeding "today" in Argentine time while Postgres queries in UTC returned **zero** activity for today — exactly the number that makes the demo look alive. Both fixed to UTC. |
| Next.js 16 renamed `middleware.ts` to `proxy.ts` | Moving the folders was not enough; the proxy intercepts before any layout. All 12 modules still redirected to `/login` after the move. |
| Supabase `ALTER DEFAULT PRIVILEGES` | Every new view in `public` is born writable by `anon`, and a later `GRANT SELECT` is a no-op. Requires `REVOKE ALL` first. This was a real hole in this project once already. |

#### Known, pre-existing, not introduced here

- `/api/proveedores` and `/api/proveedores/[id]` answer 200 **without a
  session**. Nobody chose to open them; they simply have no auth check.
- `/api/notifications` returns 500 even *with* a session on this instance:
  `public.aios_notifications` does not exist. Missing migration, unrelated.
- `mission-control/` has no `.env*` file in this checkout, so the app cannot
  boot locally as-is. This blocks the local fallback and must be resolved before
  day 5.

### Preview — live

**https://preview.gannetlabs.com** — all 12 modules, no login.

Served by systemd unit `gannet-preview.service` (port 3111, bound to 127.0.0.1,
enabled, `Restart=on-failure`, survives reboot). Environment lives in
`/etc/gannet-preview.env` (mode 0600, outside the repo so it cannot be
committed). Cloudflared ingress restarted with `systemctl restart` — never
`kill -HUP`, which kills the tunnel and takes every hostname down with it.
Backup: `/etc/cloudflared/config.yml.bak.20260719-054802`.

### Open items for day 3

Found by looking at the running preview. None were caught by `tsc`, the build,
or the security review — they only surface in a browser.

| # | Item | Fix location | Why it matters |
|---|---|---|---|
| 1 | Truck brands are wrong: "Volvo Atego", "Iveco Atego". Atego is a Mercedes-Benz model. | Seed generator | A fleet manager at the stand spots this instantly, and from that moment reads all the data as fabricated. |
| 2 | Fleet KPI contradicts its own table: "38/45 in condition to drive" while the table shows `OPERATIVO` vehicles with `VTV VENCIDO HACE 20 D`. | View or label | VTV compliance is exactly what a mining audience checks. |
| 3 | Inconsistent number scales in one card row: "$3749,4 M" beside "$23,7 mil M". | Dashboard formatting | On a projector it reads as a bug. |
| 4 | `/api/notifications` returns 401 on every public demo page — one console error per module. | Skip the call on public routes | Invisible unless someone opens devtools, but it is the only console noise left. |

### Day 3 plan

1. Fix the four items above (1 and 2 go through the seed generator, so they need
   a migration to keep the local fallback bootable).
2. Executive dashboard in depth — charts over `gd_facturacion_mensual`,
   `gd_ingresos_por_servicio`, `gd_ranking_clientes`. **No chart library is
   installed**; either add one or build with inline SVG.
3. Work orders in depth — drill-down from the 1,350-row grid into a single
   order: crew, vehicle, equipment, materials, documents.
4. Resolve the missing `.env` so the local fallback can actually boot. This is
   still the biggest unmitigated risk to plan B.

**Still unanswered, and it shapes the dashboard:** what is the three-minute
walkthrough? Which screen opens first, which number gets pointed at, what closes
the pitch.

## Available infrastructure

Verified 2026-07-19: 11 GB RAM (8 GB free), 6 cores, 163 GB free disk.
Supabase (including Storage on MinIO), Coolify, Traefik all running.
