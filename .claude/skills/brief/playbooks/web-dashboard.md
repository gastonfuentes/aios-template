# Playbook: web-dashboard

## Targets obligatorios
- **Information density**: como balancear densidad con legibilidad (Tufte, Miller's law).
- **Filtros y facetas**: patterns de URL-sync (shareable views), reset state.
- **Exportacion CSV/XLSX/PDF**: library choices, performance con 50k+ filas.
- **Performance de tablas grandes**: virtualization obligatoria pasando de ~500 filas.

## Targets opcionales
- **Saved views / dashboards personalizados** por usuario.
- **Scheduled reports**: enviar semanal/mensual por email.
- **Alerts**: reglas con umbrales (ej: "si revenue < $X mandame slack").

## Busquedas sugeridas
- "dashboard UX patterns 2026"
- "react-table virtualization large datasets"
- "Supabase aggregation queries performance"

## Fuentes primarias
- https://tanstack.com/table/latest
- https://recharts.org/en-US/
- https://supabase.com/docs/guides/database/functions (para agregaciones)

## Riesgos a investigar activamente
- Queries N+1 en listings complejos — usar `select()` anidado de Supabase.
- Aggregations en Postgres pueden ser lentas sin indices — `EXPLAIN ANALYZE`.
- Permisos granulares: RLS + checks en queries.
