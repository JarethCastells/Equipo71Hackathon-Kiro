/**
 * aiAssistant.ts — Asistente conversacional de IA (chat de texto/voz) de TalentFlow AI.
 *
 * Reutiliza el mismo patrón que aiMatcher.ts: Google Gemini con una cadena de
 * modelos de fallback, y un modo heurístico (respuestas predefinidas en
 * español) cuando no hay GEMINI_API_KEY configurada, para que el asistente
 * nunca deje al usuario sin respuesta.
 *
 * Este módulo es independiente del matching de postulantes (aiMatcher.ts) y
 * del copiloto de conversaciones de mensajería (routes/messages.ts): es un
 * asistente general de la plataforma, pensado para responder dudas sobre
 * TalentFlow AI y dar consejos según el rol del usuario (freelancer,
 * voluntario o reclutador). Soporta entrada/salida de voz desde el frontend
 * (Web Speech API), pero aquí solo se maneja texto: la conversión de voz a
 * texto y de texto a voz ocurre en el navegador.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AccountRole } from './types.js'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface AssistantChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantUserContext {
  name: string
  role: AccountRole
  profession: string | null
}

// ─── Configuración de Gemini ────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

// Misma cadena de fallback que aiMatcher.ts: si un modelo da 429/503 o falla,
// se prueba el siguiente automáticamente.
const MODEL_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
]

let genAI: GoogleGenerativeAI | null = null
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
}

const MAX_HISTORY_MESSAGES = 12
const MAX_MESSAGE_LENGTH = 2000

// ─── Prompt del sistema ─────────────────────────────────────────────────────

const ROLE_CONTEXT: Record<AccountRole, string> = {
  freelancer:
    'Es un freelancer que ofrece sus servicios profesionales por tarifa (hora o proyecto). Le interesa encontrar ofertas compatibles, mejorar su CV y perfil, y comunicarse bien con reclutadores.',
  voluntario:
    'Es un voluntario que ofrece su tiempo sin cobrar tarifa, declarando disponibilidad e intereses. Le interesa encontrar oportunidades relevantes y coordinarse con quien publica la oferta.',
  reclutador:
    'Es un reclutador que publica ofertas de proyecto, revisa postulantes y contrata firmando una responsiva de pago. Le interesa evaluar candidatos, redactar buenas ofertas y gestionar el proceso de contratación.',
}

function buildSystemPrompt(user: AssistantUserContext): string {
  return `Eres el Asistente IA de TalentFlow AI, una plataforma que conecta freelancers, voluntarios y reclutadores mediante emparejamiento inteligente por presupuesto, perfil y disponibilidad.

Hablas en español de México, con un tono relajado, cercano y con buena onda (como un compa que sabe del tema) pero sin perder profesionalismo. Puedes usar expresiones naturales mexicanas de forma moderada ("va", "de una", "sale", "qué tal") sin exagerar ni sonar forzado. Evita sonar robótico o acartonado.

Sé directo y conversacional: respuestas cortas (2-4 oraciones) salvo que el usuario pida más detalle o el tema lo requiera. Nunca uses markdown (sin **negritas**, sin títulos con #, sin listas con guiones ni bloques de código) porque tus respuestas también se leen en voz alta: escribe en prosa natural, como si hablaras.

Usuario actual:
- Nombre: ${user.name}
- Rol: ${user.role} — ${ROLE_CONTEXT[user.role]}
- Profesión: ${user.profession ?? 'No especificada'}

Puedes ayudar con:
- Dudas sobre cómo usar la plataforma (ofertas, postulaciones, mensajes, responsivas, pagos, CV).
- Consejos para mejorar su perfil, su CV o sus ofertas publicadas según su rol.
- Preguntas generales de orientación laboral o de contratación.

No inventes datos concretos de otros usuarios, ofertas o pagos reales que no te haya compartido el usuario en la conversación. Si te preguntan algo fuera de tu alcance (no relacionado con trabajo/freelance/voluntariado/reclutamiento), respóndelo brevemente igual, con buena disposición, y si aplica conecta la respuesta con algo útil de la plataforma.`
}

// ─── Fallback heurístico (sin API key) ──────────────────────────────────────

const FALLBACK_BY_ROLE: Record<AccountRole, string> = {
  freelancer:
    'Ahorita no tengo acceso a mi cerebro de IA (falta configurar GEMINI_API_KEY en el servidor), pero no te dejo colgado: échale un ojo a "Buscar ofertas" para ver vacantes que peguen con tu perfil, y prueba el "Optimizador CV IA" para dejar tu currículum bien afilado.',
  voluntario:
    'Ahorita no tengo acceso a mi cerebro de IA (falta configurar GEMINI_API_KEY en el servidor), pero no te dejo colgado: revisa "Oportunidades" para ver ofertas de voluntariado que coincidan con tu disponibilidad e intereses.',
  reclutador:
    'Ahorita no tengo acceso a mi cerebro de IA (falta configurar GEMINI_API_KEY en el servidor), pero no te dejo colgado: en "Mis ofertas" puedes ver el ranking de postulantes y usar el asistente de esa sección para dudas sobre candidatos.',
}

function fallbackReply(user: AssistantUserContext): string {
  return FALLBACK_BY_ROLE[user.role]
}

// ─── Llamada a Gemini con fallback automático entre modelos ────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callGeminiChat(
  systemPrompt: string,
  history: AssistantChatMessage[],
  message: string,
): Promise<string> {
  if (!genAI) throw new Error('No GEMINI_API_KEY configured')

  // Gemini usa roles 'user' | 'model'; el historial de la app usa 'assistant'.
  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.content }],
    })),
    { role: 'user' as const, parts: [{ text: message }] },
  ]

  const attempt = async (modelName: string) => {
    const model = genAI!.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
    })
    const result = await model.generateContent({ contents })
    return result.response.text()
  }

  for (const modelName of MODEL_CHAIN) {
    try {
      return await attempt(modelName)
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 80) : 'error desconocido'
      console.warn(`[aiAssistant] ${modelName} falló: ${message}`)
      continue
    }
  }

  // Reintento único tras una breve espera, igual que aiMatcher.ts.
  console.warn('[aiAssistant] Todos los modelos fallaron, esperando 5s y reintentando...')
  await sleep(5000)
  try {
    return await attempt(MODEL_CHAIN[0])
  } catch {
    throw new Error('Todos los modelos de Gemini fallaron (rate limit)')
  }
}

// ─── Función pública: chat conversacional del asistente ─────────────────────

/**
 * Genera la siguiente respuesta del asistente dado el contexto del usuario,
 * el historial reciente de la conversación y el nuevo mensaje.
 * Nunca lanza: ante cualquier fallo devuelve un mensaje de respaldo en español.
 */
export async function getAssistantReply(
  user: AssistantUserContext,
  history: AssistantChatMessage[],
  message: string,
): Promise<string> {
  const trimmedMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH)
  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES)

  if (!GEMINI_API_KEY) {
    return fallbackReply(user)
  }

  try {
    const systemPrompt = buildSystemPrompt(user)
    const reply = await callGeminiChat(systemPrompt, recentHistory, trimmedMessage)
    return reply.trim() || fallbackReply(user)
  } catch (err) {
    console.warn('[aiAssistant] Chat IA falló, usando respuesta de respaldo:', (err as Error).message)
    return fallbackReply(user)
  }
}
