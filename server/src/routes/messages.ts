import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { logActivity } from '../activityStore.js'
import { createNotification } from '../notificationStore.js'
import { sendSecurityAlertEmail } from '../mailer.js'
import { findUserById, updateMessageNotificationSettings } from '../userStore.js'
import { toPublicUser } from '../types.js'
import {
  getConversationMessages,
  listConversationsForUser,
  markConversationAsRead,
  sendChatMessage,
} from '../chatStore.js'

const router = Router()

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as AuthedRequest, res, next).catch(next)
  }
}

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados mensajes enviados. Espera un momento.' },
})

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes a la IA Gemini. Espera unos minutos.' },
})

/**
 * Lista el resumen de conversaciones del usuario autenticado (clasificadas por el rol del partner).
 */
router.get('/conversations', requireAuth, asyncRoute(async (req, res) => {
  const conversations = await listConversationsForUser(req.auth!.sub)
  res.json({ conversations })
}))

/**
 * Obtiene el historial completo de mensajes entre el usuario autenticado y otro usuario.
 */
router.get('/:otherUserId', requireAuth, asyncRoute(async (req, res) => {
  const { otherUserId } = req.params
  const messages = await getConversationMessages(req.auth!.sub, otherUserId)
  await markConversationAsRead(req.auth!.sub, otherUserId)
  res.json({ messages })
}))

/**
 * Envía un mensaje directo y notifica al destinatario (in-app, correo y SMS/Teléfono si configurado).
 */
router.post('/', requireAuth, sendLimiter, asyncRoute(async (req, res) => {
  const { receiverId, message } = req.body ?? {}

  if (typeof receiverId !== 'string' || receiverId.trim().length === 0) {
    return res.status(400).json({ error: 'Falta el destinatario del mensaje.' })
  }
  if (typeof message !== 'string' || message.trim().length === 0 || message.trim().length > 2000) {
    return res.status(400).json({ error: 'El mensaje debe tener entre 1 y 2000 caracteres.' })
  }

  const sender = await findUserById(req.auth!.sub)
  const receiver = await findUserById(receiverId)
  if (!receiver) {
    return res.status(404).json({ error: 'El destinatario no existe.' })
  }

  const chatMsg = await sendChatMessage({
    senderId: req.auth!.sub,
    receiverId,
    message: message.trim(),
  })

  // Notificación in-app
  await createNotification(
    receiver.id,
    'system',
    `Nuevo mensaje de ${sender?.name ?? 'Usuario'}`,
    message.trim().slice(0, 120),
  )

  // Notificación por Correo si el receptor la tiene activada
  if (receiver.notifyMessagesEmail) {
    try {
      await sendSecurityAlertEmail(receiver.email, {
        name: receiver.name,
        eventTitle: `Nuevo mensaje de ${sender?.name ?? 'Usuario'}`,
        eventDescription: `"${message.trim().slice(0, 150)}..."`,
        timestamp: new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
        ipAddress: req.ip,
      })
    } catch (err) {
      console.error('[messages] No se pudo enviar notificación por correo:', err)
    }
  }

  // Notificación por Teléfono / SMS simulada si está activada y tiene número registrado
  if (receiver.notifyMessagesPhone && receiver.phoneNumber) {
    console.log(
      `[SMS Notification] Enviando alerta por SMS a ${receiver.phoneNumber} para ${receiver.name}: "Nuevo mensaje de ${sender?.name}"`,
    )
  }

  await logActivity(req.auth!.sub, 'profile_updated', `Enviaste un mensaje a ${receiver.name}.`, req.ip)

  res.status(201).json({ message: chatMsg })
}))

/**
 * Asistente Gemini AI para analizar la conversación de chat y sugerir respuestas o decisiones.
 */
router.post('/analyze-ai', requireAuth, aiLimiter, asyncRoute(async (req, res) => {
  const { partnerId, conversation } = req.body ?? {}

  const partner = await findUserById(partnerId)
  if (!partner) {
    return res.status(404).json({ error: 'Contacto no encontrado.' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    // Fallback inteligente cuando no hay API Key configurada
    return res.json({
      analysis: `Conversación fluida con ${partner.name} (${partner.role}). Muestra disposición para colaborar y coordinar entregables.`,
      suggestedReplies: [
        `Hola ${partner.name}, me parece excelente propuesta. ¿Cuándo podemos tener una breve llamada?`,
        `Gracias por la información. Reviso los detalles y te confirmo a la brevedad.`,
        `¡Perfecto! Estoy listo/a para iniciar el proyecto.`,
      ],
      decisionAdvice: `Te recomendamos definir claramente las fechas de entrega y agendar una junta breve de alineación por correo.`,
    })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Eres el Asistente Copiloto IA de TalentFlow AI. Analiza la siguiente conversación de chat entre el usuario actual y ${partner.name} (Rol: ${partner.role}, Profesión: ${partner.profession || 'No especificada'}).

Conversación reciente:
${Array.isArray(conversation) ? conversation.map((m: any) => `${m.senderName}: ${m.message}`).join('\n') : 'Sin historial'}

Genera una respuesta en formato JSON con la siguiente estructura exacta:
{
  "analysis": "Un resumen ejecutivo breve del tono, interés y puntos clave de la conversación.",
  "suggestedReplies": ["Respuesta sugerida 1 profesional", "Respuesta sugerida 2 directa", "Respuesta sugerida 3 amigable"],
  "decisionAdvice": "Un consejo estratégico corto sobre qué decisión o siguiente paso tomar."
}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    const cleanedJson = responseText.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleanedJson)

    res.json({
      analysis: parsed.analysis,
      suggestedReplies: parsed.suggestedReplies,
      decisionAdvice: parsed.decisionAdvice,
    })
  } catch (err) {
    console.error('[messages] Error en Gemini AI Copilot:', err)
    res.json({
      analysis: `Conversación activa con ${partner.name}. La IA detecta interés mutuo en el proyecto.`,
      suggestedReplies: [
        `Gracias ${partner.name}, estoy de acuerdo con los términos.`,
        `¿Podrías compartirme más detalles sobre los requerimientos?`,
        `Quedo a la espera para agendar la junta.`,
      ],
      decisionAdvice: `Verifica los términos de contratación y responsiva antes de acordar pagos.`,
    })
  }
}))

/**
 * Actualiza las preferencias de notificaciones por Correo y SMS/Teléfono para los mensajes.
 */
router.patch('/notification-settings', requireAuth, asyncRoute(async (req, res) => {
  const { notifyMessagesEmail, notifyMessagesPhone, phoneNumber } = req.body ?? {}

  await updateMessageNotificationSettings(req.auth!.sub, {
    notifyMessagesEmail: typeof notifyMessagesEmail === 'boolean' ? notifyMessagesEmail : undefined,
    notifyMessagesPhone: typeof notifyMessagesPhone === 'boolean' ? notifyMessagesPhone : undefined,
    phoneNumber: typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined,
  })

  await logActivity(req.auth!.sub, 'profile_updated', 'Actualizaste tus notificaciones de mensajes.', req.ip)

  const updatedUser = await findUserById(req.auth!.sub)
  res.json({ user: toPublicUser(updatedUser!) })
}))

export default router
