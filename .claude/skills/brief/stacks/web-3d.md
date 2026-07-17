# Stack Recipe: web-3d

> **Compatibilidad Praxis**: `EXTEND`
> **Plataforma objetivo**: Web (desktop prioritario; movil con LOD agresivo)

## KEEP
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 3.4 (UI overlay)
- Zustand (estado de escena)

## ADD
- **three** ^0.170
- **@react-three/fiber** ^9 (React renderer para Three)
- **@react-three/drei** (helpers: `OrbitControls`, `Environment`, `useGLTF`, `Text`)
- **@react-three/postprocessing** (efectos: bloom, SSAO, DOF)
- **leva** (controles de debug — quitar en prod)
- Opcional: **@react-three/rapier** (fisica)
- Opcional: **@react-three/xr** (WebXR / VR)
- Opcional: **maath** (utilidades matematicas)
- **draco3d** (compresion de modelos)
- **ktx2** (texturas comprimidas para movil)

## REPLACE
- Ninguno.

## REMOVE
- Ninguno critico.

## CONFIG
- Lazy load de escenas (`dynamic(() => import('./Scene'), { ssr: false })`)
- LOD: modelos con al menos 3 niveles (alto / medio / bajo)
- Texturas en **KTX2** (Basis Universal) para ahorrar memoria en movil
- Modelos en **glTF + Draco** (no OBJ, no FBX)
- `next.config.ts`: `config.module.rules.push({ test: /\.(gltf|glb)$/, type: 'asset/resource' })`
- `public/models/` para glTF publicos o CDN externa

## Archivos Praxis a eliminar
- Ninguno.

## Archivos nuevos a crear
- `src/features/scene/Canvas.tsx` (wrapper de `<Canvas>`)
- `src/features/scene/components/Model.tsx` (con `useGLTF`)
- `src/features/scene/hooks/useSceneStore.ts` (Zustand)
- `public/models/*.glb` (assets)

## IDE / Toolchain externo requerido
- Ninguno adicional.
- Opcional: **Blender** para crear/optimizar modelos glTF
- Opcional: **gltfjsx** CLI (`npx gltfjsx model.glb`) — genera componente React tipado desde un glTF
