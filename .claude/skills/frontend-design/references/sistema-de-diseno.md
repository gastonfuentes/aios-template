# Sistema de diseño — paleta, tipografia, espaciado

## Paleta canonica

```ts
// tailwind.config.ts
extend: {
  colors: {
    praxis: {
      'cyan-50': '#e6fbff',
      'cyan-100': '#b3f3ff',
      'cyan-300': '#5cdfff',
      'cyan-500': '#00d9ff',
      'cyan-700': '#0099bb',
      'blue-300': '#5ca9ff',
      'blue-500': '#0a84ff',
      'blue-700': '#0059b3',
    },
  },
  backgroundImage: {
    'praxis-gradient': 'linear-gradient(135deg, #0a84ff 0%, #00d9ff 100%)',
  },
}
```

## Tipografia

```ts
// tailwind.config.ts
extend: {
  fontFamily: {
    sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
  },
  fontSize: {
    'xs': ['0.75rem', { lineHeight: '1.5' }],     // 12
    'sm': ['0.875rem', { lineHeight: '1.5' }],    // 14
    'base': ['1rem', { lineHeight: '1.5' }],      // 16
    'lg': ['1.125rem', { lineHeight: '1.5' }],    // 18
    'xl': ['1.25rem', { lineHeight: '1.4' }],     // 20
    '2xl': ['1.5rem', { lineHeight: '1.3' }],     // 24
    '3xl': ['2rem', { lineHeight: '1.2' }],       // 32
    '4xl': ['2.5rem', { lineHeight: '1.1' }],     // 40
    '5xl': ['3.5rem', { lineHeight: '1.1' }],     // 56
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
}
```

Escala 1.25 (Major Third). H1 → 5xl. H2 → 4xl. H3 → 3xl. Body → base. Caption → sm.

## Espaciado (8pt grid)

Tailwind ya usa 4pt base; usar multiplos de 2 (`p-2`=8, `p-4`=16, `p-6`=24, `p-8`=32, `p-12`=48, `p-16`=64). Excepciones permitidas: `p-1` (4) y `p-3` (12) para densidad fina.

## Border radius

- Inputs y buttons: `rounded-lg` (8px).
- Cards: `rounded-xl` (12px).
- Modals: `rounded-2xl` (16px).
- Pills/badges: `rounded-full`.

## Shadows (sutiles)

```ts
extend: {
  boxShadow: {
    'praxis-soft': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    'praxis-md': '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
    'praxis-lg': '0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05)',
    'praxis-xl': '0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04)',
  },
}
```

## Dark mode tokens

```css
/* globals.css */
@layer base {
  :root {
    --bg-primary: 255 255 255;
    --bg-secondary: 250 250 250;
    --text-primary: 15 23 42;
    --text-secondary: 100 116 139;
    --border: 226 232 240;
  }
  .dark {
    --bg-primary: 9 9 11;
    --bg-secondary: 24 24 27;
    --text-primary: 248 250 252;
    --text-secondary: 161 161 170;
    --border: 39 39 42;
  }
}
```
