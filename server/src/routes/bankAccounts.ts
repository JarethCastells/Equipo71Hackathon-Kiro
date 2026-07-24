import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { logActivity } from '../activityStore.js'
import { sendSecurityAlertEmail } from '../mailer.js'
import { addBankAccount, countBankAccounts, listBankAccounts, removeBankAccount } from '../bankAccountStore.js'
import { findUserById } from '../userStore.js'
import { toPublicBankAccount } from '../types.js'

const router = Router()
const MAX_ACCOUNTS_PER_USER = 5

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as AuthedRequest, res, next).catch(next)
  }
}

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera unos minutos.' },
})

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const accounts = await listBankAccounts(req.auth!.sub)
  res.json({ accounts: accounts.map(toPublicBankAccount) })
}))

router.post('/', requireAuth, writeLimiter, asyncRoute(async (req, res) => {
  const { bankName, holderName, accountNumber, isDefault } = req.body ?? {}

  if (typeof bankName !== 'string' || bankName.trim().length < 2) {
    return res.status(400).json({ error: 'Ingresa el nombre del banco.' })
  }
  if (typeof holderName !== 'string' || holderName.trim().length < 2) {
    return res.status(400).json({ error: 'Ingresa el nombre del titular.' })
  }
  if (typeof accountNumber !== 'string' || !/^\d{10,20}$/.test(accountNumber.trim())) {
    return res.status(400).json({ error: 'Ingresa un número de cuenta o CLABE válido (10 a 20 dígitos).' })
  }

  const existingCount = await countBankAccounts(req.auth!.sub)
  if (existingCount >= MAX_ACCOUNTS_PER_USER) {
    return res.status(400).json({ error: `Solo puedes registrar hasta ${MAX_ACCOUNTS_PER_USER} cuentas bancarias.` })
  }

  const account = await addBankAccount({
    userId: req.auth!.sub,
    bankName: bankName.trim(),
    holderName: holderName.trim(),
    accountNumber: accountNumber.trim(),
    isDefault: Boolean(isDefault) || existingCount === 0,
  })

  await logActivity(
    req.auth!.sub,
    'bank_account_added',
    `Se agregó una cuenta bancaria terminada en ${account.accountLast4}.`,
    req.ip,
  )

  const user = await findUserById(req.auth!.sub)
  if (user?.notifySecurity) {
    try {
      await sendSecurityAlertEmail(user.email, {
        name: user.name,
        eventTitle: 'Se agregó una cuenta bancaria',
        eventDescription: `Se registró una cuenta terminada en ${account.accountLast4} para recibir depósitos. Si no fuiste tú, elimínala de inmediato desde Ajustes y cambia tu contraseña.`,
        timestamp: new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
        ipAddress: req.ip,
      })
    } catch (err) {
      console.error('[bankAccounts] No se pudo enviar la alerta de seguridad:', err)
    }
  }

  res.status(201).json({ account: toPublicBankAccount(account) })
}))

router.delete('/:id', requireAuth, writeLimiter, asyncRoute(async (req, res) => {
  const removed = await removeBankAccount(req.auth!.sub, req.params.id)
  if (!removed) {
    return res.status(404).json({ error: 'Cuenta bancaria no encontrada.' })
  }

  await logActivity(req.auth!.sub, 'bank_account_removed', 'Se eliminó una cuenta bancaria.', req.ip)
  res.json({ message: 'Cuenta bancaria eliminada.' })
}))

export default router
