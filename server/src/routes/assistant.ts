/**
 * routes/assistant.ts — Chat interactivo con el Asistente IA de TalentFlow AI.
 *
 * Endpoint único:
 *   POST /api/assistant/message — Envía un mensaje del usuario y devuelve la
 *     respuesta del asistente (Gemini, con fallback heurístico sin API key).
 *
 * El historial de la conversación NO se persiste en base de datos: el
 * frontend lo mantiene en memoria y lo reenvía en cada request (igual que el
 * patrón ya usado por /api/messages/analyze-ai). Esto evita crear una tabla
 * nueva para un chat efímero de asistencia, sin afectar la mensajería directa
 * (conversations/messages) ni el chat legado (chat_messages) ya existentes.
 *
 * Entrada/salida de voz (STT/TTS) ocurre enteramente en el navegador vía Web
 * Speech API; este endpoint solo trabaja con texto.
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { getAssistantReply, type AssistantChatMessage } from '../aiAssistant.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { findUserById } from '../userStore.js'

const router = Router()

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as AuthedRequest, res, next).catch(next)
  }
}

// Límite generoso pero acotado para evitar abuso de la API de Gemini desde
// el widget flotante (visible en todo el dashboard).
const assistantLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados mensajes al asistente. Espera unos minutos.' },
})

const MAX_MESSAGE_LENGTH = 2000
const MAX_HISTORY_ITEMS = 20

function isValidHistory(value: unknown): value is AssistantChatMessage[] {
  if (!Array.isArray(value)) return false
  if (value.length > MAX_HISTORY_ITEMS) return false
  return value.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.content === 'string' &&
      item.content.length <= MAX_MESSAGE_LENGTH,
  )
}

/**
 * Envía un mensaje al asistente conversacional y devuelve su respuesta.
 * Body: { message: string, history?: { role: 'user'|'assistant', content: string }[] }
 */
router.post(
  '/message',
  requireAuth,
  assistantLimiter,
  asyncRoute(async (req, res) => {
    const { message, history } = req.body ?? {}

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.` })
    }
    if (history !== undefined && !isValidHistory(history)) {
      return res.status(400).json({ error: 'El historial de la conversación no es válido.' })
    }

    const user = await findUserById(req.auth!.sub)
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }

    const reply = await getAssistantReply(
      { name: user.name, role: user.role, profession: user.profession },
      (history as AssistantChatMessage[] | undefined) ?? [],
      message,
    )

    res.json({ reply })
  }),
)

export default router
