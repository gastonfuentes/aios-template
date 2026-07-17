---
name: frontend-design
description: "Construye interfaces premium con shadcn/ui + Tailwind sobre el stack Praxis. Genera dashboards, landings y componentes minimalistas con jerarquia visual clara, microinteracciones sutiles y tipografia escalada. Activar cuando el usuario menciona construir UI, hacer la pagina, dashboard, landing, mejorar el diseño, que se vea premium, refactor visual, agregar animaciones, o pide componentes nuevos."
allowed-tools: Read, Write, Edit, Bash
---

# frontend-design — interfaces premium con voz Praxis

> Skill transversal. Cualquier otra skill que produce UI visible (emails, web-3d, pwa, ai-sdk-kit) hereda principios de aqui.

---

## Cuando activar

- "Construyeme la pagina de inicio."
- "Quiero un dashboard para mi alumno."
- "Hacelo que se vea premium / como Stripe / como Linear."
- "Agrega animaciones sutiles."
- "Refactorea esto, se ve generico."
- "Diseña el componente de pricing / settings / profile."

## Cuando NO activar

- El usuario pide solo logica de negocio sin UI ("calcula el churn", "expone una API"). Eso lo cubren `supabase-admin` o `ai-sdk-kit`.
- El usuario quiere una landing 3D scroll-driven cinematica. Eso es `web-3d`, esta skill aporta solo paleta y tipografia.

## Regla central: jerarquia clara con un solo punto de atencion

Cada vista debe tener **un solo elemento dominante** que el ojo reconoce en menos de 200ms al cargar la pagina. Razon: el usuario hispanohablante que aprende Vibe Coding suele venir de plantillas saturadas; cuando ve una interface limpia con jerarquia clara, percibe inmediatamente que es premium. La densidad la roba la calidad.

Tres niveles de jerarquia obligatorios:

1. **Primary** — el call-to-action principal. Maximo uno por pantalla.
2. **Secondary** — soporte visual al primary (botones de fila inferior, navegacion).
3. **Tertiary** — texto base, metadatos, helpers.

## Antes de empezar — verifica empiricamente

- [ ] `tailwind.config.ts` existe y tiene `darkMode: 'class'`. Si no, agregarlo.
- [ ] `components.json` (shadcn/ui) existe. Si no, `npx shadcn init` con preset que respete la paleta YOUR_COMMUNITY (ver `references/sistema-de-diseño.md`).
- [ ] Componentes core de shadcn instalados: `button`, `input`, `dialog`, `card`, `dropdown-menu`. Si no, `npx shadcn add <name>`.

## Flujo principal

### Paso 1: define la paleta + tipografia

Antes del primer componente, fija la base. Plantilla en `references/sistema-de-diseño.md` con tokens listos para `tailwind.config.ts`. Paleta canonica Praxis:

- Primary gradient: `linear-gradient(135deg, #0a84ff 0%, #00d9ff 100%)` (azul Apple → cyan).
- Neutro oscuro: zinc-950 / zinc-900 / zinc-800 para fondos.
- Neutro claro: zinc-50 / zinc-100 / zinc-200 para texto sobre oscuro.
- Tipografia: stack del sistema con fallback `Inter`. H1-H6 con escala `1.250` (Major Third), line-height generoso (1.5 base, 1.2 headings).

**Por que no usar el purple SF heredado** (hex que empieza con 683): no tiene heritage en el ecosistema premium hispanohablante (Stripe-azul, Apple-azul, Linear-violeta, Vercel-negro). El gradient cyan YOUR_COMMUNITY es propio y discrimable.

### Paso 2: layout con respiracion (8pt grid)

Todo padding y margin son multiplos de 8 (`p-2`=8, `p-4`=16, `p-6`=24, `p-8`=32). Razon: el ojo entrenado percibe disonancia ante valores irregulares (13, 17, 22) sin saber explicar por que. La grilla 8pt se siente subconcientemente correcta.

Excepcion permitida: `p-1` y `p-3` (4 y 12) para densidad fina (badges, chips, navbar).

Ver `references/layouts.md` para grids canonicos: dashboard 2-column con sidebar, settings 3-pane, landing hero centered, signup centered narrow.

### Paso 3: componentes premium con shadcn/ui

shadcn/ui es la base. NUNCA copiar codigo de Material-UI o Chakra ni mezclar — el alumno detecta la inconsistencia visual aunque no sepa por que.

Patrones canonicos en `references/componentes.md`:

- **Card** con borde sutil + shadow casi imperceptible + radius 12px.
- **Button primary** gradient cyan + hover lift + active scale-[0.98].
- **Input** con label flotante o etiqueta arriba (no placeholder-only — es accessibility nightmare).
- **Empty state** con icono grande + frase + CTA — nunca pagina en blanco.
- **Loading state** skeleton o spinner contextual, no overlay full-screen.
- **Error state** mensaje claro + accion para reintentar.

### Paso 4: microinteracciones sutiles

Cada interaccion del usuario merece feedback en menos de 100ms. La animacion correcta es **invisible cuando todo va bien y visible cuando algo cambia**. Ver `references/animaciones.md`:

- Botones: hover lift 1px + active scale 0.98, duration 150ms cubic-bezier.
- Modal: fade-in + scale 0.95→1.0, duration 200ms.
- Toast: slide-in desde top-right, duration 300ms ease-out.
- Loading: spinner cyan rotando, no parpadeo de opacity (genera ansiedad).

**Anti-patron**: animaciones infinitas que mueven layout (transform: scale en pulse, width animado). Ver aprendizaje 2026-04-27 del meta-repo Praxis (PRP-023 v2): solo animar `box-shadow`, `opacity`, `color` para preservar 60fps en WebViews y embeds.

### Paso 5: dark mode obligatorio + accessibility

- Toggle theme en navbar superior derecha. Persistir en `localStorage` con key `theme`.
- Contraste minimo WCAG AA (4.5:1) en texto base sobre fondo. Verificar con DevTools.
- Focus ring visible en todos los elementos interactivos (`outline-2 outline-offset-2 outline-cyan-500`).
- Labels asociados a inputs por `htmlFor`/`id`.
- Mensajes de error con `role="alert"`.

## Si tu Directiva no es Next.js + Tailwind

- React Native: cambiar shadcn/ui por `react-native-paper` o `nativewind`. Tokens de paleta y tipografia se mantienen.
- Svelte/Vue: shadcn tiene ports oficiales (`shadcn-svelte`, `shadcn-vue`). Mismos componentes, sintaxis nativa de cada framework.
- HTML estatico (ej. landing page sin React): usar Tailwind via CDN y reescribir componentes core a HTML semantico. Ver `references/no-react.md`.

## Cross-references con skills hermanas

- `@.claude/skills/auth-stack/SKILL.md` — el componente `SigninForm` y la pagina `/(public)/signin` heredan paleta + tipografia + microinteracciones de aqui.
- `@.claude/skills/emails-transactional/SKILL.md` — los templates de email replican paleta y jerarquia. Ningun email lleva el purple SF.
- `@.claude/skills/web-3d/SKILL.md` — la landing scroll-driven hereda navbar pill, glass-morphism y tipografia de esta skill.
- `@.claude/skills/pwa-mobile/SKILL.md` — el banner de install y los toasts de notificacion respetan estos tokens.
- `@.claude/skills/ai-sdk-kit/SKILL.md` — la UI del chatbot (burbujas, input, sidebar de conversaciones) usa los componentes de aqui.

## Archivos lazy-loaded

- `references/sistema-de-diseño.md` — paleta completa, escala tipografica, espaciado, tokens listos para `tailwind.config.ts`.
- `references/componentes.md` — Card, Button, Input, Dropdown, Modal, Toast, Empty/Loading/Error states.
- `references/layouts.md` — dashboard, settings, landing hero, signup, error.
- `references/animaciones.md` — microinteracciones, transiciones, anti-patrones.
- `references/anti-patrones.md` — gradients estridentes, glassmorphism abusado, overuse de iconos.
- `references/no-react.md` — adaptacion a HTML estatico + Tailwind via CDN.

## Validacion al cerrar

- [ ] Lighthouse Accessibility score >= 95 en la pagina principal (`npx lighthouse http://localhost:3000 --only-categories=accessibility`).
- [ ] Dark mode toggle funciona y persiste tras reload.
- [ ] Cero residuos de purple SF en estilos (verificar con grep contra los hex prohibidos del STYLE-GUIDE).
- [ ] Cada interaccion tiene feedback visible en menos de 100ms.
- [ ] Empty state, loading state y error state implementados al menos en la vista principal.
