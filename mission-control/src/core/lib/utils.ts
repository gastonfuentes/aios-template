import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * `cn` helper canónico shadcn/ui: combina `clsx` (resuelve condicionales
 * `{ "foo": cond }` + arrays anidados) con `twMerge` (deduplica tokens Tailwind
 * que entran en conflicto: ej. `px-2 px-4` queda `px-4`).
 *
 * Usar en cualquier componente que reciba `className` opcional:
 *   ```tsx
 *   <div className={cn("base classes", className, cond && "conditional")} />
 *   ```
 *
 * Bundle: `clsx` ~0.5 KB gzipped + `tailwind-merge` ~5 KB gzipped.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
