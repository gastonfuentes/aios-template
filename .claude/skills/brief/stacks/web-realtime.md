# Stack Recipe: web-realtime

> **Compatibilidad Praxis**: `EXTEND`
> **Plataforma objetivo**: Web (desktop + mobile con reconexion robusta)

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4
- Supabase (Auth + DB + **Realtime channels**)
- Zod + Zustand

## ADD (elegir approach)

### Approach A: Supabase Realtime (simple, pub/sub + postgres changes)
- `@supabase/supabase-js` (ya viene) + `supabase.channel(...)`
- Ideal para: notificaciones, presence, chat simple, live cursors basico

### Approach B: Liveblocks (managed, alta calidad colab)
- `@liveblocks/client` + `@liveblocks/react`
- Ideal para: cursores compartidos, selections sync, comments
- **Costo**: freemium, escala con MAU

### Approach C: Yjs (CRDT, edicion colaborativa tipo Google Docs)
- `yjs` + `y-websocket` + `y-presence` + `y-indexeddb`
- `@tiptap/extension-collaboration` + `@tiptap/extension-collaboration-cursor` (si editor)
- Servidor: Hocuspocus (WebSocket server self-hosted) o Liveblocks como transport
- Ideal para: editores de texto/documento colaborativos

## REPLACE
- Ninguno.

## REMOVE
- Ninguno.

## CONFIG
- Habilitar Realtime replication en Supabase (si Approach A) en tablas relevantes
- Rate limiting en mensajes broadcast
- Reconexion con backoff exponencial
- Presence con `untrack` en `window.beforeunload`
- Variables: `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` o `LIVEBLOCKS_SECRET` (si B)

## Archivos Praxis a eliminar
- Ninguno.

## Archivos nuevos a crear
- `src/features/realtime/hooks/usePresence.ts`
- `src/features/realtime/hooks/useBroadcast.ts`
- `src/features/realtime/RoomProvider.tsx` (Liveblocks)
- `src/features/collab/editor.tsx` (si Yjs + Tiptap)
- `src/app/api/liveblocks-auth/route.ts` (si B)

## IDE / Toolchain externo requerido
- Ninguno para Approach A o C (self-hosted)
- Cuenta Liveblocks si Approach B
