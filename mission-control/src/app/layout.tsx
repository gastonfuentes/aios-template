import type { Metadata, Viewport } from 'next'
import { Providers } from '@/core/components/Providers'
import { PWARegister } from '@/core/components/PWARegister'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gannet OS',
  description: 'El Sistema Operativo para Empresas Proveedoras de la Minería.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-32.png?v=20260518', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png?v=20260518', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png?v=20260518', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=20260518', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gannet OS',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <body className="bg-wallpaper">
        <Providers>{children}</Providers>
        <PWARegister />
      </body>
    </html>
  )
}
