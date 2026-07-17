# Catalogo de Tipos de Proyecto

> Marco **conceptual** que el agente usa para razonar sobre el tipo de proyecto que describe el usuario.

---

## Tabla de contenidos

- [Como se usa este catalogo](#como-se-usa-este-catalogo)
- [Niveles de compatibilidad con el stack Praxis](#niveles-de-compatibilidad-con-el-stack-praxis)
- [Categoria 1: Web Estatico](#categoria-1-web-estatico) — `web-landing`, `web-portfolio`, `web-docs-site`, `web-blog`
- [Categoria 2: Web App](#categoria-2-web-app) — `web-saas`, `web-dashboard`, `web-marketplace`, `web-ecommerce`
- [Categoria 3: AI App](#categoria-3-ai-app) — `ai-chatbot`, `ai-agent`, `ai-rag`
- [Categoria 4: Mobile](#categoria-4-mobile) — `mobile-expo`, `mobile-ios-native`, `mobile-android-native`
- [Categoria 5: Desktop](#categoria-5-desktop) — `desktop-tauri`, `desktop-electron`, `desktop-macos-native`, `desktop-windows-native`, `desktop-linux-native`, `desktop-flutter`, `desktop-dotnet-maui`
- [Categoria 6: Extension](#categoria-6-extension) — `ext-vscode`, `ext-chrome`, `ext-raycast`
- [Categoria 7: CLI / Tool](#categoria-7-cli--tool) — `cli-node`, `cli-rust`
- [Categoria 8: Especializado](#categoria-8-especializado) — `web-3d`, `web-realtime`, `web-game`, `custom-unknown`
- [Resumen de Compatibilidad](#resumen-de-compatibilidad)

**Total**: 28 tipos en 8 categorias.

---

## Como se usa este catalogo

El catalogo no es una tabla de matching. Es un mapa conceptual. Cuando la skill invoque el Paso 2, el agente lee el catalogo completo y **razona** desde la intencion de la idea del usuario para elegir el tipo que mejor la describe.

**Reglas**:

- No buscar palabras especificas de la idea del usuario en este archivo. Entender el proposito del proyecto y compararlo contra la **naturaleza** de cada tipo.
- Si dos tipos encajan parecido, hacer una pregunta aclaratoria corta al usuario.
- Si nada encaja → `custom-unknown` (investigacion libre).

Cada tipo esta descrito por 4 campos conceptuales:

- **Naturaleza** — que es el proyecto en esencia.
- **Plataforma objetivo** — donde vive y como lo usa el usuario final.
- **Pista de contexto** — pistas tipicas en el discurso del usuario o en el workspace que sugieren este tipo (son **indicios**, no gatillos; el agente los usa como signals, no como matching).
- **Compatibilidad Praxis** — cuanto del stack inyectado se mantiene (`MATCH` / `EXTEND` / `PARTIAL` / `REPLACE_FRONT` / `REPLACE`).

---

## Niveles de compatibilidad con el stack Praxis

El stack inyectado por Praxis es: **Next.js 16 + React 19 + Tailwind CSS 3.4 + Supabase + Vercel AI SDK v5 + Zod + Zustand + Playwright**.

| Nivel | Significa | Que hace el brief |
|-------|-----------|-------------------|
| `MATCH` | El stack Praxis es optimo sin cambios | Directiva solo enumera `KEEP` + deltas menores |
| `EXTEND` | Stack Praxis + anadir librerias | `KEEP` + `ADD` puntual |
| `PARTIAL` | Reemplaza una capa (frontend o runtime), conserva el resto | `KEEP` parcial + `REPLACE` + `ADD` |
| `REPLACE_FRONT` | Reemplaza Next.js por otro framework de UI, conserva Supabase/Zod/Zustand | `KEEP` backend + `REPLACE` frontend entero |
| `REPLACE` | Stack totalmente distinto | `REMOVE` todo el scaffold web + `ADD` stack nuevo |

---

## Categoria 1: Web Estatico

### web-landing
- **Naturaleza**: Pagina de venta, aterrizaje o promocional. Su unico trabajo es convertir — visitante a lead o a compra.
- **Plataforma objetivo**: Web publica, una sola URL, optimizada para first-paint rapido.
- **Pista de contexto**: el usuario quiere "una pagina" (singular), enfocada en mensaje, sin auth ni dashboard.
- **Compatibilidad**: `EXTEND` — Next.js/Tailwind encajan; anade animaciones / SEO avanzado.

### web-portfolio
- **Naturaleza**: Showcase personal o de agencia. Contenido estatico o casi estatico con foco visual.
- **Plataforma objetivo**: Web publica, multi-pagina ligera.
- **Pista de contexto**: el usuario quiere mostrar su trabajo o proyectos, cero backend transaccional.
- **Compatibilidad**: `EXTEND`.

### web-docs-site
- **Naturaleza**: Sitio de documentacion tecnica (como docs.stripe.com). Estructura de libro, busqueda, navegacion lateral.
- **Plataforma objetivo**: Web publica, orientada a lectura larga.
- **Pista de contexto**: el usuario habla de manuales, API reference, guias tecnicas, sistema de documentacion.
- **Compatibilidad**: `EXTEND` — anade MDX + framework tipo Fumadocs / Nextra / Starlight.

### web-blog
- **Naturaleza**: Blog personal o de marca, mas contenido que producto.
- **Plataforma objetivo**: Web publica, articulos por URL, feed.
- **Pista de contexto**: el foco es publicar contenido, opcionalmente con newsletter.
- **Compatibilidad**: `EXTEND`.

---

## Categoria 2: Web App

### web-saas
- **Naturaleza**: Producto SaaS completo: auth, dashboard, suscripciones, multi-tenant.
- **Plataforma objetivo**: Web autenticada, responsive pero desktop-first.
- **Pista de contexto**: el usuario habla de planes, trials, usuarios, datos por cuenta, pagos recurrentes.
- **Compatibilidad**: `MATCH` — el stack Praxis esta optimizado para este caso.

### web-dashboard
- **Naturaleza**: Panel de control interno o admin, sin marketing publico. Metricas, gestion, operaciones.
- **Plataforma objetivo**: Web autenticada, generalmente interno.
- **Pista de contexto**: el usuario habla de "panel", "admin", "tablero", "metricas internas", sin pretension publica.
- **Compatibilidad**: `MATCH`.

### web-marketplace
- **Naturaleza**: Marketplace de dos lados (vendedores + compradores). Catalogo, perfiles, transacciones entre partes.
- **Plataforma objetivo**: Web publica + areas autenticadas por rol.
- **Pista de contexto**: el usuario habla de vendedores y compradores, matching, comision, transaccion entre usuarios.
- **Compatibilidad**: `EXTEND` — anade Stripe Connect + busqueda avanzada.

### web-ecommerce
- **Naturaleza**: Tienda online propia (single-vendor). Carrito, checkout, inventario.
- **Plataforma objetivo**: Web publica + checkout seguro.
- **Pista de contexto**: el usuario habla de productos propios, tienda, catalogo con inventario, no matching.
- **Compatibilidad**: `EXTEND` — anade Stripe + gestion de inventario.

---

## Categoria 3: AI App

### ai-chatbot
- **Naturaleza**: Interfaz conversacional con streaming y memoria de sesion.
- **Plataforma objetivo**: Web (desktop + mobile responsive).
- **Pista de contexto**: el usuario habla de chat, asistente, conversacion, input de texto con respuesta incremental.
- **Compatibilidad**: `MATCH` — Vercel AI SDK cubre todo.

### ai-agent
- **Naturaleza**: Sistema autonomo que planifica y ejecuta tareas en multiples pasos con herramientas.
- **Plataforma objetivo**: Web + background workers.
- **Pista de contexto**: el usuario habla de automatizar, ejecutar multiple acciones, tool-use, workflows dirigidos por IA.
- **Compatibilidad**: `MATCH`.

### ai-rag
- **Naturaleza**: Retrieval Augmented Generation sobre base de conocimiento propia.
- **Plataforma objetivo**: Web + ingestion pipeline.
- **Pista de contexto**: el usuario quiere que la IA responda sobre documentos/datos propios, busqueda semantica.
- **Compatibilidad**: `MATCH` — Supabase pgvector + AI SDK.

---

## Categoria 4: Mobile

### mobile-expo
- **Naturaleza**: App movil cross-platform (iOS + Android) desde una base de codigo con React Native + Expo.
- **Plataforma objetivo**: iPhone y Android (y opcionalmente web con Expo Web).
- **Pista de contexto**: el usuario quiere app movil pero no esta casado con una sola plataforma, valora velocidad de iteracion sobre access a APIs exoticas.
- **Compatibilidad**: `REPLACE_FRONT` — reemplaza Next.js, mantiene Supabase/Zod/Zustand.

### mobile-ios-native
- **Naturaleza**: App exclusiva para iOS con Swift + SwiftUI, acceso completo a APIs Apple.
- **Plataforma objetivo**: iPhone / iPad (y opcionalmente visionOS / watchOS con extension).
- **Pista de contexto**: el usuario quiere solo iOS, con uso de APIs Apple especificas (HealthKit, ARKit, CoreML, HomeKit).
- **Compatibilidad**: `REPLACE`.

### mobile-android-native
- **Naturaleza**: App exclusiva para Android con Kotlin + Jetpack Compose.
- **Plataforma objetivo**: Android.
- **Pista de contexto**: el usuario quiere solo Android, con uso de APIs Google especificas o integracion profunda al OS.
- **Compatibilidad**: `REPLACE`.

---

## Categoria 5: Desktop

### desktop-tauri
- **Naturaleza**: App desktop cross-platform con UI web dentro de un binario nativo pequeno (Rust backend).
- **Plataforma objetivo**: macOS + Windows + Linux.
- **Pista de contexto**: el usuario quiere una app de escritorio cross-platform, valora tamano pequeno y prefiere UI web sobre nativa.
- **Compatibilidad**: `PARTIAL` — conserva React/Tailwind/Zod/Zustand, reemplaza Next.js por Vite + Rust.

### desktop-electron
- **Naturaleza**: App desktop cross-platform con Chromium + Node. Ecosistema maduro, binario grande.
- **Plataforma objetivo**: macOS + Windows + Linux.
- **Pista de contexto**: el usuario quiere una app tipo Slack/Notion/VS Code, y el tamano del binario no es critico.
- **Compatibilidad**: `PARTIAL`.

### desktop-macos-native
- **Naturaleza**: App exclusiva para macOS con Swift + SwiftUI, totalmente integrada a las HIG de Apple.
- **Plataforma objetivo**: macOS.
- **Pista de contexto**: el usuario quiere una app que se sienta parte del sistema Mac (menubar apps, Shortcuts, Widgets, Spotlight integration, Siri).
- **Compatibilidad**: `REPLACE`.

### desktop-windows-native
- **Naturaleza**: App exclusiva para Windows con C# (WinUI 3 / WPF / Avalonia), integracion profunda al OS.
- **Plataforma objetivo**: Windows.
- **Pista de contexto**: el usuario quiere integracion con Windows especifica (sistema, drivers, empresa que corre solo Windows).
- **Compatibilidad**: `REPLACE`.

### desktop-linux-native
- **Naturaleza**: App nativa Linux con GTK4 / Qt6 / Iced / Slint. Integracion con GNOME/KDE.
- **Plataforma objetivo**: Linux (mac/win opcionales con Qt6).
- **Pista de contexto**: el usuario quiere una app que se sienta GNOME o KDE nativa, distribuida por Flathub / Snap / AppImage.
- **Compatibilidad**: `REPLACE`.

### desktop-flutter
- **Naturaleza**: App desktop cross-platform con Flutter (Dart). Una base de codigo para mac/win/linux + mobile opcional.
- **Plataforma objetivo**: Desktop cross-platform + opcional mobile.
- **Pista de contexto**: el usuario ya tiene ecosistema Flutter o lo prefiere, quiere share entre desktop y mobile.
- **Compatibilidad**: `REPLACE`.

### desktop-dotnet-maui
- **Naturaleza**: Cross-platform con .NET MAUI (C#). Una base para mac/win/ios/android.
- **Plataforma objetivo**: Desktop (mac/win) + mobile (opcional).
- **Pista de contexto**: el usuario ya tiene ecosistema .NET / Visual Studio o viene de Xamarin.
- **Compatibilidad**: `REPLACE`.

---

## Categoria 6: Extension

### ext-vscode
- **Naturaleza**: Extension para editores de codigo (VS Code / Cursor / Windsurf / Eclipse Theia).
- **Plataforma objetivo**: IDE, ejecuta dentro del editor del desarrollador.
- **Pista de contexto**: el usuario quiere algo que viva dentro del IDE — comandos, panel lateral, language features, decoraciones.
- **Compatibilidad**: `REPLACE`.

### ext-chrome
- **Naturaleza**: Extension para navegadores Chromium (Chrome / Edge / Brave) en Manifest V3.
- **Plataforma objetivo**: Navegador del usuario, inyecta en paginas web o corre popup / side panel.
- **Pista de contexto**: el usuario quiere algo que modifique o extienda la experiencia de navegacion web.
- **Compatibilidad**: `REPLACE`.

### ext-raycast
- **Naturaleza**: Extension para Raycast (command launcher macOS). Comandos invocables con teclas rapidas.
- **Plataforma objetivo**: macOS (solo Raycast).
- **Pista de contexto**: el usuario usa Raycast y quiere comandos personalizados de busqueda / accion.
- **Compatibilidad**: `REPLACE`.

---

## Categoria 7: CLI / Tool

### cli-node
- **Naturaleza**: Herramienta de linea de comandos en Node.js / TypeScript.
- **Plataforma objetivo**: Terminal cross-platform (donde haya Node).
- **Pista de contexto**: el usuario quiere un comando `npx` o un binario para terminal, con prompts o flags.
- **Compatibilidad**: `REPLACE`.

### cli-rust
- **Naturaleza**: Herramienta CLI en Rust: binario nativo pequeno y rapido, cross-compiled.
- **Plataforma objetivo**: Terminal cross-platform, binarios distribuibles via Homebrew / Scoop / crates.io.
- **Pista de contexto**: performance o tamano del binario es critico; el usuario valora zero-dep en target.
- **Compatibilidad**: `REPLACE`.

---

## Categoria 8: Especializado

### web-3d
- **Naturaleza**: Experiencia web con 3D / WebGL (showcase, configurador, pieza interactiva).
- **Plataforma objetivo**: Web, con consideraciones de performance para movil.
- **Pista de contexto**: el usuario habla de escenas 3D, modelos, configurador visual, experiencia inmersiva.
- **Compatibilidad**: `EXTEND` — anade Three.js + React Three Fiber.

### web-realtime
- **Naturaleza**: App web con sincronizacion en tiempo real (chat, cursores compartidos, edicion colaborativa).
- **Plataforma objetivo**: Web.
- **Pista de contexto**: el usuario habla de colaboracion, multiplayer, ver cambios de otros en vivo.
- **Compatibilidad**: `EXTEND` — Supabase Realtime o Liveblocks / Yjs.

### web-game
- **Naturaleza**: Juego en navegador 2D o 3D.
- **Plataforma objetivo**: Web (desktop + mobile tactil).
- **Pista de contexto**: el usuario habla de juego, mecanicas, niveles, puntaje, personaje.
- **Compatibilidad**: `EXTEND` — anade Phaser / PixiJS / Babylon / Three.js.

### custom-unknown
- **Naturaleza**: Fallback. La idea del usuario no encaja en ninguna categoria anterior con razon clara.
- **Plataforma objetivo**: A definir.
- **Pista de contexto**: el agente no encuentra un tipo que describa la intencion del usuario despues de leer el catalogo completo.
- **Compatibilidad**: depende del resultado de la investigacion; el brief lo documenta.

---

## Resumen de Compatibilidad

| Tipo | Compatibilidad |
|------|----------------|
| web-landing / web-portfolio / web-docs-site / web-blog | `EXTEND` |
| web-saas / web-dashboard | `MATCH` |
| web-marketplace / web-ecommerce | `EXTEND` |
| ai-chatbot / ai-agent / ai-rag | `MATCH` |
| mobile-expo | `REPLACE_FRONT` |
| mobile-ios-native / mobile-android-native | `REPLACE` |
| desktop-tauri / desktop-electron | `PARTIAL` |
| desktop-macos-native / desktop-windows-native / desktop-linux-native | `REPLACE` |
| desktop-flutter / desktop-dotnet-maui | `REPLACE` |
| ext-vscode / ext-chrome / ext-raycast | `REPLACE` |
| cli-node / cli-rust | `REPLACE` |
| web-3d / web-realtime / web-game | `EXTEND` |
| custom-unknown | — |

**Total**: 28 tipos en 8 categorias.
