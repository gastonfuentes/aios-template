# Animaciones — microinteracciones que se sienten premium

## Principios

1. **Duration < 300ms** para feedback inmediato. Animaciones largas (>500ms) se sienten lentas en interacciones core.
2. **Easing natural**: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out fuerte) para entradas, `cubic-bezier(0.4, 0, 1, 1)` para salidas.
3. **Solo animar `transform`, `opacity`, `color`, `box-shadow`** — propiedades compositor-only que el GPU maneja sin reflow. Animar `width`, `height`, `top`, `left` causa jank.
4. **Reduce motion** respetar `prefers-reduced-motion: reduce` para usuarios sensibles.

## Tailwind utilities canonicas

```ts
// tailwind.config.ts
extend: {
  transitionTimingFunction: {
    'praxis-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
    'praxis-in': 'cubic-bezier(0.4, 0, 1, 1)',
  },
  transitionDuration: {
    'praxis-fast': '150ms',
    'praxis-normal': '200ms',
    'praxis-slow': '300ms',
  },
  keyframes: {
    'fade-in': {
      from: { opacity: '0' },
      to: { opacity: '1' },
    },
    'scale-in': {
      from: { opacity: '0', transform: 'scale(0.95)' },
      to: { opacity: '1', transform: 'scale(1)' },
    },
    'slide-up': {
      from: { opacity: '0', transform: 'translateY(8px)' },
      to: { opacity: '1', transform: 'translateY(0)' },
    },
    'shimmer': {
      from: { backgroundPosition: '-1000px 0' },
      to: { backgroundPosition: '1000px 0' },
    },
  },
  animation: {
    'fade-in': 'fade-in 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    'scale-in': 'scale-in 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    'slide-up': 'slide-up 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    'shimmer': 'shimmer 2s linear infinite',
  },
}
```

## Patrones canonicos

### Boton hover lift

```tsx
className="transition-all duration-150 hover:-translate-y-px hover:shadow-praxis-lg active:scale-[0.98]"
```

### Modal entrada

```tsx
<DialogContent className="animate-scale-in">...</DialogContent>
```

### Toast slide-in

Sonner ya lo trae built-in. No reinventar.

### Lista de items que aparecen escalonados

```tsx
{items.map((item, i) => (
  <div
    key={item.id}
    className="animate-slide-up opacity-0"
    style={{
      animationDelay: `${i * 30}ms`,
      animationFillMode: 'forwards',
    }}
  >
    {item.label}
  </div>
))}
```

30ms de stagger se siente fluido sin hacer esperar al usuario en listas de 20+.

## Anti-patrones (NO hacer)

- ❌ `animate-pulse` con `transform: scale` o `width`. Causa reflow constante 60 veces por segundo. Usar solo opacity.
- ❌ Animaciones infinitas en >2 elementos a la vez. Distrae sin aportar.
- ❌ Spinner full-screen overlay para acciones <500ms. Overkill — usar boton disabled + texto "Guardando...".
- ❌ Bouncing buttons (`animate-bounce`). Se siente caricaturesco, no premium.
- ❌ Confetti automatico. Tolerable solo en eventos importantes (primera compra, milestone). Nunca en cada accion.

## Reduce motion

```tsx
// hooks/use-prefers-reduced-motion.ts
export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    mq.addEventListener('change', (e) => setReduce(e.matches));
  }, []);
  return reduce;
}

// uso
const reduce = usePrefersReducedMotion();
<div className={reduce ? '' : 'animate-fade-in'}>...</div>
```

O via CSS global:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
