'use client'

/**
 * Hook para grabación de audio con MediaRecorder + transcripción via daemon
 * (PRP-031 Sub-fase 3 brief master chat-mission-control).
 *
 * Estados:
 *   - `idle` — listo para grabar
 *   - `requesting-permission` — esperando getUserMedia
 *   - `recording` — grabando activamente
 *   - `transcribing` — uploadeando blob a `/api/chat/transcribe`
 *   - `error` — algo falló (permission denied, network, daemon offline)
 *   - `unsupported` — browser sin MediaRecorder
 *
 * Uso típico:
 *   const { state, start, stop, error, secondsRecording } = useVoiceRecorder({
 *     onTranscribed: (text) => appendToTextarea(text),
 *   })
 *
 * Respeta Trust Stack y reglas Praxis (cero setState in effect; cleanup
 * proper de stream + recorder en unmount + abort del fetch).
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export type VoiceRecorderState =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'transcribing'
  | 'error'
  | 'unsupported'

export type UseVoiceRecorderOptions = {
  /** Callback invocado con el texto transcrito tras stop(). */
  onTranscribed?: (text: string) => void
  /** Callback opcional con el error si transcribe falla. */
  onError?: (error: string) => void
}

export type UseVoiceRecorderReturn = {
  state: VoiceRecorderState
  error: string | null
  /** Segundos transcurridos desde start(); 0 si no está grabando. */
  secondsRecording: number
  /** Boolean conveniente — true si state === 'recording'. */
  isRecording: boolean
  /** Boolean conveniente — true si state === 'transcribing'. */
  isTranscribing: boolean
  /** Boolean conveniente — soporte browser disponible. */
  isSupported: boolean
  /** Arranca grabación (requestUserMedia + new MediaRecorder). */
  start: () => Promise<void>
  /** Detiene grabación + dispara transcribe. */
  stop: () => Promise<void>
  /** Cancela todo + descarta el audio (no transcribe). */
  cancel: () => void
}

function detectSupport(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'MediaRecorder' in window &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}

// useSyncExternalStore canónico Praxis (PRP-020) para evitar hydration mismatch:
// el server siempre renderea con `false` (getServerSnapshot), el primer client
// render también retorna `false` (snapshot estable mientras no haya cambios), y
// el subscribe sólo dispara updates cross-tab teóricos. Resultado: SSR y client
// inicial coinciden; React rehidrata sin warning.
function isSupportedSubscribe(): () => void {
  // No hay eventos del browser para detectar cambios runtime de capability —
  // MediaRecorder support se establece al boot del browser. Subscribe vacío.
  return () => {}
}
function isSupportedGetSnapshot(): boolean {
  return detectSupport()
}
function isSupportedGetServerSnapshot(): boolean {
  return false
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  // Orden de preferencia: webm (Chrome/Edge), mp4 (Safari), ogg (Firefox).
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

function extOf(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

export function useVoiceRecorder(
  options: UseVoiceRecorderOptions = {},
): UseVoiceRecorderReturn {
  // useSyncExternalStore para isSupported — getServerSnapshot retorna false
  // consistentemente con el primer client render, evitando hydration mismatch
  // (PRP-031 Sub-fase 7 bug #2 fix canónico Praxis PRP-020 doctrina).
  const isSupported = useSyncExternalStore(
    isSupportedSubscribe,
    isSupportedGetSnapshot,
    isSupportedGetServerSnapshot,
  )
  const [state, setState] = useState<VoiceRecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [secondsRecording, setSecondsRecording] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimestampRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Sync prop callbacks → refs para evitar stale closure (PRP-030 canónico).
  const onTranscribedRef = useRef<UseVoiceRecorderOptions['onTranscribed']>(options.onTranscribed)
  const onErrorRef = useRef<UseVoiceRecorderOptions['onError']>(options.onError)
  useEffect(() => {
    onTranscribedRef.current = options.onTranscribed
    onErrorRef.current = options.onError
  })

  // Cleanup global on unmount.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop()
        } catch {
          /* ignore */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      abortRef.current?.abort()
    }
  }, [])

  const cleanupStream = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  const start = useCallback(async () => {
    if (!isSupported) {
      setError('Tu navegador no soporta grabación de audio.')
      setState('error')
      return
    }
    setError(null)
    setState('requesting-permission')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.addEventListener('dataavailable', (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      })

      recorder.start(250) // emit chunks every 250ms
      startTimestampRef.current = Date.now()
      setSecondsRecording(0)
      setState('recording')

      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimestampRef.current) / 1000)
        setSecondsRecording(elapsed)
      }, 250)
    } catch (err) {
      cleanupStream()
      const msg = err instanceof Error ? err.message : String(err)
      const friendly = msg.includes('Permission denied') || msg.includes('NotAllowedError')
        ? 'Necesito permiso para usar tu micrófono. Toca el candado de la URL y permite acceso.'
        : `No pude arrancar la grabación: ${msg}`
      setError(friendly)
      setState('error')
      onErrorRef.current?.(friendly)
    }
  }, [isSupported, cleanupStream])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      cleanupStream()
      setState('idle')
      return
    }

    setState('transcribing')

    // Promesa que se resuelve cuando MediaRecorder emite el último chunk.
    const stopped = new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          const mimeType = recorder.mimeType || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type: mimeType })
          resolve(blob)
        },
        { once: true },
      )
    })

    try {
      recorder.stop()
    } catch {
      /* already stopped */
    }

    let blob: Blob
    try {
      blob = await stopped
    } catch (err) {
      cleanupStream()
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setState('error')
      onErrorRef.current?.(msg)
      return
    }

    cleanupStream()
    if (blob.size === 0) {
      setError('No grabé nada. Mantén presionado un par de segundos.')
      setState('error')
      onErrorRef.current?.('empty audio')
      return
    }

    const ext = extOf(blob.type)
    const formData = new FormData()
    formData.set('file', blob, `audio.${ext}`)

    const ac = new AbortController()
    abortRef.current = ac

    try {
      const res = await fetch('/api/chat/transcribe', {
        method: 'POST',
        body: formData,
        signal: ac.signal,
      })
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        let detail = `HTTP ${res.status}`
        try {
          const parsed = JSON.parse(errBody) as { detail?: string; error?: string }
          detail = parsed.detail || parsed.error || detail
        } catch {
          /* keep status */
        }
        throw new Error(detail)
      }
      const json = (await res.json()) as { text?: string }
      const text = (json.text ?? '').trim()
      if (!text) {
        setError('La transcripción salió vacía. Vuelve a intentar.')
        setState('error')
        onErrorRef.current?.('empty transcription')
        return
      }
      setState('idle')
      setSecondsRecording(0)
      onTranscribedRef.current?.(text)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState('idle')
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      const friendly = msg.includes('voice STT not configured')
        ? 'Voice transcribe no está configurado en el daemon.'
        : `No pude transcribir tu audio: ${msg}`
      setError(friendly)
      setState('error')
      onErrorRef.current?.(friendly)
    }
  }, [cleanupStream])

  const cancel = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        /* ignore */
      }
    }
    abortRef.current?.abort()
    cleanupStream()
    setState('idle')
    setSecondsRecording(0)
    setError(null)
  }, [cleanupStream])

  return {
    state,
    error,
    secondsRecording,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
    isSupported,
    start,
    stop,
    cancel,
  }
}
