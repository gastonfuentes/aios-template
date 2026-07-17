import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-system)',
  				'sans-serif'
  			],
  			display: [
  				'var(--font-display)',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-mono)',
  				'monospace'
  			]
  		},
  		borderRadius: {
  			field: '5px',
  			control: '6px',
  			'control-lg': '7px',
  			card: '8px',
  			'window-sm': '16px',
  			tile: '22px',
  			window: '26px',
  			sheet: '34px'
  		},
  		boxShadow: {
  			window: '0 16px 48px rgba(0,0,0,0.32), 0 0 0 1px rgba(0,0,0,0.20)',
  			glass: '0 8px 40px rgba(0,0,0,0.12)',
  			popover: '0 8px 24px rgba(0,0,0,0.20), 0 0 0 0.5px rgba(0,0,0,0.20)',
  			tooltip: '0 4px 12px rgba(0,0,0,0.18)',
  			control: 'inset 0 0.5px 0 rgba(255,255,255,0.55), 0 0.5px 1px rgba(0,0,0,0.10)',
  			toolbtn: 'inset 0 0.5px 0 rgba(255,255,255,0.45), 0 1px 0 rgba(0,0,0,0.05)'
  		},
  		backdropBlur: {
  			glass: '20px',
  			'glass-strong': '40px'
  		},
  		backdropSaturate: {
  			glass: '180%',
  			'glass-strong': '200%'
  		},
  		transitionTimingFunction: {
  			macos: 'cubic-bezier(0.4, 0, 0.2, 1)',
  			'macos-decelerate': 'cubic-bezier(0, 0, 0.2, 1)',
  			'macos-accelerate': 'cubic-bezier(0.4, 0, 1, 1)',
  			'macos-spring': 'cubic-bezier(0.5, 1.5, 0.5, 1)'
  		},
  		transitionDuration: {
  			fast: '120ms',
  			DEFAULT: '220ms',
  			slow: '320ms'
  		},
  		colors: {
  			/* DS macOS 26 — literal values (NO hsl envolvente). Preserva el
  			   contrato vivo del shell (PRP-020+). `accent` mantiene tipo nested
  			   con DEFAULT literal + foreground HSL split para que tanto
  			   `bg-accent` (azul Apple literal) como `text-accent-foreground`
  			   (de la capa shadcn) compilen. */
  			accent: {
  				DEFAULT: 'var(--accent)',
  				foreground: 'hsl(var(--accent-foreground))',
  			},
  			'accent-pressed': 'var(--accent-pressed)',
  			'label-primary': 'var(--label-primary)',
  			'label-secondary': 'var(--label-secondary)',
  			'label-tertiary': 'var(--label-tertiary)',
  			'label-quaternary': 'var(--label-quaternary)',
  			'fill-primary': 'var(--fill-primary)',
  			'fill-secondary': 'var(--fill-secondary)',
  			'fill-tertiary': 'var(--fill-tertiary)',
  			separator: 'var(--separator)',
  			/* Capa shadcn — HSL split mappeada desde `globals.css` `:root` +
  			   `[data-theme="dark"]`. CRÍTICO para que las utilities
  			   `bg-secondary`/`bg-card`/`bg-muted`/`text-foreground`/
  			   `border-border` que los componentes vendored shadcn-ui +
  			   AI Elements asumen funcionen visualmente. Bug latente de PRP-028
  			   resuelto en PRP-029 polish: las vars se declararon en
  			   `globals.css` pero nunca se conectaron al theme Tailwind. */
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))',
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))',
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))',
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))',
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))',
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			/* --ring está declarado como `var(--accent)` literal en globals.css,
  			   NO HSL split. Usar `var(--ring)` directo evita producir CSS
  			   inválido (`hsl(#007AFF)`). Mismo razonamiento que `accent.DEFAULT`. */
  			ring: 'var(--ring)',
  			/* --chart-X son literales `var(--sys-blue)` etc. en globals.css. */
  			chart: {
  				'1': 'var(--chart-1)',
  				'2': 'var(--chart-2)',
  				'3': 'var(--chart-3)',
  				'4': 'var(--chart-4)',
  				'5': 'var(--chart-5)',
  			},
  			/* Sidebar palette (shadcn convention). Consumido por Streamdown code
  			   blocks como container exterior. HSL split byte-exact al template
  			   shadcn neutral, dark adaptado al DS macOS 26. */
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				/* --sidebar-ring es literal var(--accent), no HSL split. */
  				ring: 'var(--sidebar-ring)',
  			},
  		},
  		fontSize: {
  			largetitle: [
  				'26px',
  				{
  					lineHeight: '32px',
  					fontWeight: '700',
  					letterSpacing: '-0.02em'
  				}
  			],
  			title1: [
  				'22px',
  				{
  					lineHeight: '26px',
  					fontWeight: '700',
  					letterSpacing: '-0.01em'
  				}
  			],
  			title2: [
  				'17px',
  				{
  					lineHeight: '22px',
  					fontWeight: '700'
  				}
  			],
  			title3: [
  				'15px',
  				{
  					lineHeight: '20px',
  					fontWeight: '600'
  				}
  			],
  			headline: [
  				'13px',
  				{
  					lineHeight: '16px',
  					fontWeight: '700'
  				}
  			],
  			body: [
  				'13px',
  				{
  					lineHeight: '16px',
  					fontWeight: '400'
  				}
  			],
  			callout: [
  				'12px',
  				{
  					lineHeight: '15px',
  					fontWeight: '400'
  				}
  			],
  			subheadline: [
  				'11px',
  				{
  					lineHeight: '14px',
  					fontWeight: '400'
  				}
  			],
  			footnote: [
  				'10px',
  				{
  					lineHeight: '13px',
  					fontWeight: '400'
  				}
  			],
  			caption1: [
  				'10px',
  				{
  					lineHeight: '13px',
  					fontWeight: '400'
  				}
  			],
  			caption2: [
  				'10px',
  				{
  					lineHeight: '13px',
  					fontWeight: '700',
  					letterSpacing: '0.04em'
  				}
  			]
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
}

export default config
