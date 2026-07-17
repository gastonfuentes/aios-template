/**
 * Ruta productiva `/ai-agent` (Server Component) — antes `/chat`, renombrada
 * en PRP-030 polish para coherencia con el sidebar item "AI Agent".
 *
 * Sub-fase 1 (PRP-029): esqueleto placeholder — solo lee `?session=<uuid>` del
 * searchParam y monta un placeholder. Sub-fase 2 reemplaza el placeholder por
 * `<ChatPage>` Client. Sub-fase 5 cabla el SSR fetch a `chat_messages` para
 * el reload de conversación.
 *
 * Auth gate: heredado del layout `(app)/layout.tsx` (Server async con
 * `createClient + getUser + isEmailAllowed + redirect`). Cero llamada
 * redundante aquí.
 */

import { ChatLayout } from '@/features/chat/components/ChatLayout'
import {
  loadSessionMessages,
  loadSdkSessionMessages,
} from '@/features/chat/api/persistence'
import { createClient } from '@/core/adapters/supabase/server'
import type { Message as ChatMessage } from '@/features/chat/contracts/messages'
import { z } from 'zod'

const UuidSchema = z.string().uuid()

type Props = {
  searchParams: Promise<{ session?: string; sdk?: string }>
}

export default async function ChatRoutePage({ searchParams }: Props) {
  const params = await searchParams
  const rawSession = params.session
  const rawSdk = params.sdk

  // SSR hydration con dos modos discriminados (PRP-030 polish bug-fix #1+#3):
  //
  //   - `?session=<uuid>` → conversación nacida en MC web (always-push receiver
  //     escribió en `chat_messages`). Reload via Supabase SSR (RLS owner-only filtra).
  //
  //   - `?sdk=<sdkSessionId>` → conversación cross-superficie (CLI directo en
  //     la máquina del daemon, Telegram bot, cron) cuyo contenido vive solo en el `.jsonl`
  //     del SDK del daemon. Reload via daemon `/sessions/:id/messages` con bearer.
  //     Cierra la promesa central del brief: una sola memoria de agent accesible
  //     desde tres superficies.
  //
  // Si ambos vienen, gana `?session=` (más confiable porque ya está en BD).
  // Si ninguno, empty state.
  let initialMessages: ChatMessage[] = []
  let initialChatSessionId: string | undefined
  let activeSdkSessionId: string | undefined

  const sessionParse = UuidSchema.safeParse(rawSession)
  const sdkParse = UuidSchema.safeParse(rawSdk)

  if (sessionParse.success) {
    initialChatSessionId = sessionParse.data
    const supabase = await createClient()
    initialMessages = await loadSessionMessages(supabase, sessionParse.data)
  } else if (sdkParse.success) {
    activeSdkSessionId = sdkParse.data
    const agentUrl = process.env.AGENT_URL
    const bearer = process.env.OPENCLAW_GATEWAY_TOKEN
    if (agentUrl && bearer) {
      initialMessages = await loadSdkSessionMessages(sdkParse.data, agentUrl, bearer)
    }
    // Nota: NO setteamos initialChatSessionId — la sesión NO tiene mapping en
    // chat_sessions Supabase. Si el operador escribe un mensaje nuevo desde aquí,
    // useAgentChat genera un UUID v4 nuevo y arranca una conversación derivada
    // (el daemon NO sabrá que continúa la del SDK). Es el trade-off documentado
    // del cross-superficie: lectura sí, escritura genera nueva sesión.
  }

  return (
    <ChatLayout
      initialMessages={initialMessages}
      initialChatSessionId={initialChatSessionId}
      activeSdkSessionId={activeSdkSessionId}
    />
  )
}
