# Stack Recipe: web-game

> **Compatibilidad Praxis**: `EXTEND`
> **Plataforma objetivo**: Web (desktop + mobile tactil con controles adaptados)

## Variantes (elegir una durante el brief)

1. **2D arcade / puzzle**: Phaser 3 o PixiJS
2. **3D casual**: Three.js o Babylon.js
3. **2D con React**: `excalidraw`-style canvas libre

## KEEP
- Next.js 16 + React 19 + TypeScript (opcional — algunos juegos funcionan mejor vanilla)
- Tailwind CSS (UI HUD)
- Supabase (leaderboard, auth, save states)
- Zustand (estado global del juego)

## ADD (variante 2D con Phaser)
- **Phaser** ^3.86
- **matter-js** (fisica 2D) si no basta con la de Phaser
- **howler.js** (audio con spatial sound opcional)
- **simplex-noise** (procedural)
- `dynamic()` import para lazy load de escenas pesadas

## ADD (variante 3D con Babylon)
- **@babylonjs/core** + **@babylonjs/loaders** + **@babylonjs/materials**
- **cannon-es** (fisica) o Havok (licencia Microsoft)
- **recast-detour** (navmesh)

## REPLACE
- Ninguno (Next.js sigue para hosting + auth; el game engine es paralelo).

## REMOVE
- Ninguno.

## CONFIG
- `dynamic()` imports para separar game engine del bundle inicial
- `next.config.ts`: `transpilePackages` si el engine no ships ESM
- Asset pipeline: sprites atlas (`TexturePacker`), audio `.ogg`/`.webm`, modelos glTF
- Frame budget: target 60 FPS, mobile budget 30 FPS
- Leaderboard en Supabase con RLS estricta (solo INSERT del propio score)

## Archivos Praxis a eliminar
- Ninguno.

## Archivos nuevos a crear
- `src/features/game/GameCanvas.tsx` (wrapper)
- `src/features/game/scenes/*.ts` (Phaser scenes o Babylon scenes)
- `src/features/game/systems/*.ts` (input, physics, AI)
- `public/assets/sprites/`, `public/assets/audio/`

## IDE / Toolchain externo requerido
- Ninguno adicional para empezar.
- **TexturePacker** (sprites atlas — ~$40 licencia) o `free-tex-packer` web (gratis)
- **Tiled** (mapas 2D tile-based, gratis)
- **Blender** si hay assets 3D
