# Playbook: web-3d

## Targets obligatorios
- **Performance en movil**: LOD (levels of detail) obligatorios, max drawcalls < 100, texturas KTX2.
- **R3F + Drei patterns**: `useGLTF` + `Preload`, `Instances` para muchos objetos, Suspense boundaries.
- **Asset pipeline**: glTF + Draco compression, KTX2 textures. Blender workflow.
- **WebGL2 vs WebGPU** status 2026: WebGL2 universal, WebGPU en progreso (Chrome estable, Firefox progreso, Safari experimental).
- **A11y + UX**: controles por teclado, escape hatch para motion sickness, reduce-motion.

## Targets opcionales
- **Fisica con Rapier**: @react-three/rapier, mas rapido que cannon-es.
- **XR / VR**: @react-three/xr, WebXR compatibility.
- **Netcode multiplayer**: WebRTC o WebSocket + server authoritative.

## Busquedas sugeridas
- "React Three Fiber best practices 2026"
- "glTF Draco KTX2 pipeline Blender"
- "WebGPU vs WebGL2 2026 compatibility"

## Fuentes primarias
- https://r3f.docs.pmnd.rs
- https://threejs.org/docs
- https://github.com/pmndrs/drei

## Riesgos a investigar activamente
- **Memoria en iOS Safari** — mata escenas pesadas sin warning (>100MB de texturas).
- **Thermal throttling** en mobile despues de ~5 min de render intenso.
- **Motion sickness** en experiencias VR sin precauciones — teleport locomotion, comfort options.
