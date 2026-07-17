'use client'
import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let cancelled = false
    let checkInterval: ReturnType<typeof setInterval> | null = null

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        if (cancelled) return

        checkInterval = setInterval(() => {
          reg.update().catch(() => undefined)
        }, 60 * 60 * 1000)

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      } catch (err) {
        console.error('SW registration failed:', err)
      }
    }

    register()

    return () => {
      cancelled = true
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [])

  return null
}
