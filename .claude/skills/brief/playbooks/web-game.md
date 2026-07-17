# Playbook: web-game

## Targets obligatorios
- **Engine decision**: Phaser 3 (2D, madurez), PixiJS (2D low-level), Babylon.js (3D integral), Three.js (3D flexible).
- **Frame budget**: 60 FPS desktop, 30 FPS movil minimum. Profile en Safari iOS que suele ser el cuello.
- **Asset pipeline**: sprite atlases (TexturePacker), audio sprites (howler), lazy load por nivel.
- **Save system**: localStorage para basico, Supabase para cloud saves + leaderboard.
- **Anti-cheat minimo**: server-validate scores, hash de inputs, replay protection para leaderboard publico.

## Targets opcionales
- **Monetization**: ads (AdSense, Adinplay), IAP (Stripe), subscription.
- **Multiplayer**: authoritative server o lockstep, netcode complexity alto.
- **Portabilidad a mobile**: Capacitor wrap del canvas si eventualmente se publica en stores.

## Busquedas sugeridas
- "Phaser 3 vs PixiJS 2026"
- "web game performance mobile Safari"
- "HTML5 game leaderboard anti-cheat"

## Fuentes primarias
- https://phaser.io/docs
- https://pixijs.com/8.x/guides
- https://doc.babylonjs.com

## Riesgos a investigar activamente
- **iOS Safari audio unlock**: audio requiere user gesture, no autoplay.
- **Bundle size**: Babylon full ~1.5MB, Phaser ~1MB minified — considerar lazy load.
- **Touch vs keyboard controls**: UX diverge mucho entre desktop y mobile.
