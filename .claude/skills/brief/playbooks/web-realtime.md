# Playbook: web-realtime

## Targets obligatorios
- **Approach decision**: Supabase Realtime (simple) vs Liveblocks (managed premium) vs Yjs (CRDT self-hosted).
- **Reconexion logic**: backoff exponencial, estado optimista, resolver conflictos.
- **Presence**: quien esta online, cursores, selections.
- **Persistence**: ¿los mensajes se pierden al desconectar o se replay? Supabase guarda; broadcast puro no.
- **Rate limits**: Supabase Realtime (limits por plan), Liveblocks (MAU), Yjs (depende del server).

## Targets opcionales
- **Server-authoritative vs eventually-consistent**: game / chat / editor tienen tradeoffs distintos.
- **WebRTC** (P2P mesh) si la red lo permite — mas barato que pub/sub server.
- **E2E encryption** si los mensajes son sensibles.

## Busquedas sugeridas
- "Yjs vs Liveblocks 2026 collaborative editor"
- "Supabase Realtime scale limits"
- "CRDT conflict resolution guide"

## Fuentes primarias
- https://supabase.com/docs/guides/realtime
- https://liveblocks.io/docs
- https://docs.yjs.dev

## Riesgos a investigar activamente
- **Network partitions**: offline edits que colisionan al reconectar — CRDT los resuelve, pub/sub no.
- **Scaling** con Supabase Realtime >100 concurrent users por channel — verificar limits de tu plan.
- **Latencia** — region de hosting importa.
