import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { logActivity } from '../activityStore.js'
import { createNotification } from '../notificationStore.js'
import { sendSecurityAlertEmail } from '../mailer.js'
import { findUserById } from '../userStore.js'
import {
  createPayment,
  getFreelancerDestinationAccount,
  getPaymentByAgreementId,
  listPaymentsForUser,
  updatePaymentStatus,
  type PaymentProvider,
} from '../paymentStore.js'
import pool from '../db.js'

const router = Router()

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as AuthedRequest, res, next).catch(next)
  }
}

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas intenciones de pago. Espera unos minutos.' },
})

/**
 * Consulta la cuenta bancaria de destino (cifrada en servidor) para el freelancer a contratar.
 * Retorna solo los datos seguros (banco, titular y últimos 4 dígitos) para la responsiva.
 */
router.get('/destination/:freelancerId', requireAuth, asyncRoute(async (req, res) => {
  const { freelancerId } = req.params
  const freelancer = await findUserById(freelancerId)
  if (!freelancer) {
    return res.status(404).json({ error: 'Freelancer no encontrado.' })
  }

  const destination = await getFreelancerDestinationAccount(freelancerId)
  res.json({ destination })
}))

/**
 * Lista el historial de pagos (realizados por el reclutador o recibidos por el freelancer).
 */
router.get('/my-payments', requireAuth, asyncRoute(async (req, res) => {
  const payments = await listPaymentsForUser(req.auth!.sub)
  res.json({ payments })
}))

/**
 * Procesa o simula un pago real asociado a una responsiva firmada.
 */
router.post('/checkout', requireAuth, checkoutLimiter, asyncRoute(async (req, res) => {
  const { agreementId, provider = 'stripe', paymentMethod = 'card' } = req.body ?? {}
  console.log(`[payments] Procesando cobro con ${provider} método: ${paymentMethod}`)


  if (typeof agreementId !== 'string') {
    return res.status(400).json({ error: 'Especifica la responsiva (agreementId) a pagar.' })
  }

  // Buscar responsiva
  const [agreements] = await pool.query<any[]>(
    'SELECT * FROM hiring_agreements WHERE id = ? AND recruiter_id = ?',
    [agreementId, req.auth!.sub],
  )
  if (agreements.length === 0) {
    return res.status(404).json({ error: 'Responsiva de contratación no encontrada o no te pertenece.' })
  }

  const agreement = agreements[0]
  const amount = Number(agreement.agreed_amount)

  // Obtener cuenta destino del freelancer
  const destination = await getFreelancerDestinationAccount(agreement.freelancer_id)

  const providerName: PaymentProvider = ['stripe', 'mercadopago', 'conekta', 'simulated'].includes(provider)
    ? (provider as PaymentProvider)
    : 'stripe'

  // Verificar si ya existe pago
  let payment = await getPaymentByAgreementId(agreementId)

  if (!payment) {
    const fakeTxId = `tx_${providerName}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    payment = await createPayment({
      agreementId,
      recruiterId: agreement.recruiter_id,
      freelancerId: agreement.freelancer_id,
      amount,
      currency: 'MXN',
      provider: providerName,
      providerPaymentId: fakeTxId,
      status: 'succeeded',
      destinationBankName: destination?.bankName ?? null,
      destinationAccountLast4: destination?.accountLast4 ?? null,
    })
  } else if (payment.status !== 'succeeded') {
    payment = await updatePaymentStatus(payment.id, 'succeeded', `tx_${providerName}_${Date.now()}`)
  }

  const recruiter = await findUserById(agreement.recruiter_id)
  const freelancer = await findUserById(agreement.freelancer_id)

  // Notificar al freelancer sobre el pago realizado
  if (freelancer) {
    const destInfo = destination
      ? `fondos en proceso de transferencia a tu cuenta ${destination.bankName} (****${destination.accountLast4}).`
      : 'se te notificará en cuanto se libere la transferencia a tu cuenta bancaria.'
    await createNotification(
      freelancer.id,
      'new_match',
      `¡Pago recibido de ${recruiter?.name ?? 'Reclutador'}!`,
      `Se procesó el pago de $${amount.toFixed(2)} MXN vía ${providerName.toUpperCase()}. ${destInfo}`,
    )
  }

  // Log de actividad y alerta de seguridad
  await logActivity(
    req.auth!.sub,
    'profile_updated',
    `Pago de $${amount.toFixed(2)} MXN procesado con éxito para ${freelancer?.name ?? 'freelancer'}.`,
    req.ip,
  )

  if (recruiter?.notifySecurity) {
    try {
      await sendSecurityAlertEmail(recruiter.email, {
        name: recruiter.name,
        eventTitle: 'Confirmación de Pago Exitoso',
        eventDescription: `Se ha procesado exitosamente el pago de $${amount.toFixed(2)} MXN a favor de ${freelancer?.name ?? 'Freelancer'} (${destination ? `${destination.bankName} ****${destination.accountLast4}` : 'Cuenta pendiente'}).`,
        timestamp: new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
        ipAddress: req.ip,
      })
    } catch (err) {
      console.error('[payments] No se pudo enviar el correo de confirmación de pago:', err)
    }
  }

  res.status(200).json({ payment, message: 'Pago completado con éxito.' })
}))

/**
 * Webhook para integraciones con pasarelas de pago externas (ej. Stripe Webhook).
 */
router.post('/webhook', (req, res) => {
  // Manejo de eventos de Stripe u otros proveedores
  console.log('[payments webhook] Recibido evento de pasarela de pago:', req.body?.type || 'evento')
  res.json({ received: true })
})

export default router
