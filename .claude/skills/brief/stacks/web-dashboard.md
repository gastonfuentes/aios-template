# Stack Recipe: web-dashboard

> **Compatibilidad Praxis**: `MATCH`
> **Plataforma objetivo**: Web (desktop-first, tablet OK)

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4
- Supabase (Auth + DB con RLS por rol)
- Zod + Zustand

## ADD
- `@tanstack/react-table` ^8 (tablas complejas con sorting/filter)
- `recharts` o `@nivo/core` (graficos)
- `date-fns` + `react-day-picker` (rangos de fecha)
- `tanstack/react-query` ^5 (cache)
- Opcional: `@tremor/react` (componentes dashboard ya estilizados)
- Opcional: `@tanstack/react-virtual` (tablas muy largas)

## REPLACE
- Ninguno.

## REMOVE
- `src/app/(landing)/` si existe (dashboard no tiene home publica)

## CONFIG
- RLS estricta por rol: `admin`, `member`, `viewer`
- Row-level filtering con `auth.uid()` + claims
- Cron jobs de agregacion: `pg_cron` en Supabase o Vercel Cron
- Export CSV/XLSX: ruta `app/api/export/[report]/route.ts`

## Archivos Praxis a eliminar
- `src/features/<landing>/` si aplicara

## Archivos nuevos a crear
- `src/features/dashboard/components/MetricCard.tsx`
- `src/features/dashboard/components/DataTable.tsx`
- `src/features/dashboard/components/DateRangePicker.tsx`
- `supabase/migrations/**_rls_roles.sql`
- `src/app/api/export/[report]/route.ts`

## IDE / Toolchain externo requerido
- Supabase CLI.
