/**
 * Puente de datos hacia el demo grounded (gannet-ia).
 *
 * El agente general (Telegram / web) corre como Claude Code en el repo y NO tiene
 * ninguna herramienta conectada a los datos del negocio, así que cuando le
 * preguntan por cotizaciones, stock, flota, etc. termina inventando. Este módulo
 * expone UNA herramienta que delega esas preguntas al servicio read-only del demo
 * (`gannet-ia`, 127.0.0.1:3131), que sí tiene las herramientas sobre las vistas
 * `gd_*` con los datos reales. La respuesta vuelve ya calculada y formateada para
 * proyector, de modo que el agente solo tiene que reproducirla tal cual.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

/** Endpoint del orquestador grounded del demo. Overridable por env. */
const GANNET_IA_URL = process.env['GANNET_IA_URL'] ?? 'http://127.0.0.1:3131/ask'

/** El orquestador tarda ~9-11s por turno; damos margen sin colgar la respuesta. */
const BRIDGE_TIMEOUT_MS = 60_000

const consultarDatosEmpresa = tool(
  'consultar_datos_empresa',
  'Consulta los datos REALES de la empresa Andes Servicios Integrales sobre cualquier tema de negocio: cotizaciones y pipeline comercial, clientes y su estado, facturación, cobranzas y deudas, compras, proveedores y órdenes de compra, flota de vehículos, equipos y calibraciones, stock de artículos y depósitos, proyectos, órdenes de trabajo, dotación de personal, faenas mineras, contactos y agenda. Devuelve la respuesta ya calculada y formateada desde el sistema. USAR SIEMPRE para cualquier pregunta sobre información de la empresa: es la ÚNICA fuente válida de esos datos.',
  { pregunta: z.string().min(1).max(500) },
  async (args) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS)
    try {
      const res = await fetch(GANNET_IA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: args.pregunta }),
        signal: controller.signal,
      })
      if (!res.ok) {
        return { content: [{ type: 'text' as const, text: 'No pude consultar ese dato en este momento.' }] }
      }
      const body = (await res.json()) as { answer?: unknown }
      const answer =
        typeof body.answer === 'string' && body.answer.trim().length > 0
          ? body.answer.trim()
          : 'No tengo ese dato.'
      return { content: [{ type: 'text' as const, text: answer }] }
    } catch {
      return { content: [{ type: 'text' as const, text: 'No pude consultar ese dato en este momento.' }] }
    } finally {
      clearTimeout(timeout)
    }
  },
)

/** MCP server in-process con la única herramienta de datos de la empresa. */
export const gannetBridgeServer = createSdkMcpServer({
  name: 'gannet_datos',
  version: '1.0.0',
  tools: [consultarDatosEmpresa],
})

/**
 * Instrucción que se appendea al system prompt de Claude Code para que el agente
 * use la herramienta y jamás invente datos del negocio.
 */
export const GANNET_GROUNDING_APPEND = `

DATOS DE LA EMPRESA — REGLA OBLIGATORIA:
Asistís a Andes Servicios Integrales S.A., un proveedor minero. Para CUALQUIER pregunta sobre datos del negocio —cotizaciones, ventas, pipeline, clientes, facturación, cobranzas, deudas, compras, proveedores, órdenes de compra, flota, vehículos, equipos, calibraciones, stock, artículos, depósitos, proyectos, obras, órdenes de trabajo, personal, dotación, RRHH, faenas, contactos, agenda— DEBÉS usar la herramienta "consultar_datos_empresa" y responder EXACTAMENTE lo que devuelve, sin agregar, redondear ni inventar ningún número, nombre, código o cifra. NUNCA respondas datos del negocio de memoria ni los inventes: los datos solo son válidos si vienen de esa herramienta. Si la herramienta devuelve "No tengo ese dato", respondé eso mismo. No uses la terminal ni leas archivos para responder preguntas de negocio: usá siempre esta herramienta.

FORMATO DE LA RESPUESTA (la respuesta va a Telegram): escribí en TEXTO PLANO. NO uses markdown de ningún tipo: nada de asteriscos para negrita (**), nada de almohadillas (#), nada de tablas, nada de etiquetas HTML. Reproducí el texto de la herramienta tal cual, con sus viñetas "- " y sus saltos de línea. Los datos deben coincidir letra por letra con lo que devuelve la herramienta.`
