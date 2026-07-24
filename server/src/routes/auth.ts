import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticator } from 'otplib'
import { requireAuth, signPending2FAToken, signToken, verifyPending2FAToken, type AuthedRequest } from '../auth.js'
import { sendVerificationEmail } from '../mailer.js'
import { logActivity } from '../activityStore.js'
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByVerificationTokenHash,
  markEmailVerified,
  setVerificationToken,
} from '../userStore.js'
import { toPublicUser, type AccountRole } from '../types.js'

const router = Router()
const VALID_ROLES: AccountRole[] = ['freelancer', 'voluntario', 'reclutador']
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function generateVerificationToken(): { token: string; hash: string; expires: Date } {
  const token = randomBytes(32).toString('hex')
  return {
    token,
    hash: hashToken(token),
    expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  }
}

async function dispatchVerificationEmail(user: { id: string; name: string; email: string; role: AccountRole }, token: string) {
  const verifyUrl = `${CLIENT_URL}/verify?token=${token}`
  return sendVerificationEmail(user.email, { name: user.name, role: user.role, verifyUrl })
}

// Express 4 no reenvía automáticamente los rechazos de promesas de handlers
// async al middleware de errores; sin este wrapper, un fallo (p. ej. la BD
// caída) se convierte en una excepción no controlada que tumba el proceso.
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next)
  }
}

// --- Rate limiting anti-abuso/DDoS ---
// Estos límites son por IP. Sin esto, cualquiera podría automatizar miles de
// registros, intentos de login o reenvíos de correo por segundo, saturando
// la base de datos, el proveedor SMTP (y su reputación de envío) y la CPU
// del servidor (bcrypt es intencionalmente costoso).
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de registro desde esta red. Intenta de nuevo más tarde.' },
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.' },
})

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Ya reenviamos el correo varias veces. Espera unos minutos antes de intentar otra vez.' },
})

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de verificación. Espera unos minutos e intenta de nuevo.' },
})

router.post('/signup', signupLimiter, asyncRoute(async (req, res) => {
  const { name, email, password, role } = req.body ?? {}

  if (typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Ingresa un nombre válido.' })
  }
  if (typeof email !== 'string' || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' })
  }
  const finalRole: AccountRole = VALID_ROLES.includes(role) ? role : 'freelancer'

  if (await findUserByEmail(email)) {
    return res.status(409).json({ error: 'Ya existe una cuenta registrada con ese correo.' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const { token, hash, expires } = generateVerificationToken()
  const user = await createUser({
    name,
    email,
    passwordHash,
    role: finalRole,
    verificationTokenHash: hash,
    verificationTokenExpires: expires,
  })
  await logActivity(user.id, 'account_created', 'Cuenta creada. Pendiente de verificación de correo.', req.ip)

  // El envío de correo no debe tumbar el registro si falla, pero SÍ se le
  // avisa al cliente para que pueda ofrecer un reintento (sin el correo,
  // la cuenta queda creada pero inutilizable hasta reenviar la verificación).
  let emailSent = true
  let emailPreviewUrl: string | undefined
  try {
    const result = await dispatchVerificationEmail(user, token)
    emailPreviewUrl = result.previewUrl
  } catch (err) {
    emailSent = false
    console.error('[auth] No se pudo enviar el correo de verificación:', err)
  }

  // Importante: NO se emite JWT aquí. La cuenta existe pero está inactiva
  // hasta que el usuario haga clic en el enlace de verificación del correo.
  res.status(201).json({
    message: 'Cuenta creada. Revisa tu correo para verificarla y acceder al dashboard.',
    emailSent,
    emailPreviewUrl,
  })
}))

router.post('/verify', verifyLimiter, asyncRoute(async (req, res) => {
  const { token } = req.body ?? {}

  if (typeof token !== 'string' || token.length < 10) {
    return res.status(400).json({ error: 'Enlace de verificación inválido.' })
  }

  const user = await findUserByVerificationTokenHash(hashToken(token))
  if (!user) {
    return res.status(400).json({ error: 'Este enlace de verificación no es válido o ya fue usado.' })
  }

  if (user.emailVerified) {
    const jwt = signToken({ sub: user.id, email: user.email })
    return res.json({ token: jwt, user: toPublicUser(user), alreadyVerified: true })
  }

  if (!user.verificationTokenExpires || new Date(user.verificationTokenExpires) < new Date()) {
    return res.status(400).json({ error: 'Este enlace de verificación expiró. Solicita uno nuevo.', expired: true })
  }

  await markEmailVerified(user.id)
  await logActivity(user.id, 'email_verified', 'Correo verificado y cuenta activada.', req.ip)
  const jwt = signToken({ sub: user.id, email: user.email })
  res.json({ token: jwt, user: { ...toPublicUser(user), emailVerified: true } })
}))

router.post('/resend-verification', resendLimiter, asyncRoute(async (req, res) => {
  const { email } = req.body ?? {}

  if (typeof email !== 'string' || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' })
  }

  const user = await findUserByEmail(email)

  // Respuesta genérica sin importar si el correo existe o ya está
  // verificado: evita que alguien use este endpoint para enumerar cuentas
  // registradas probando direcciones al azar.
  const genericResponse = {
    message: 'Si existe una cuenta pendiente de verificar con ese correo, te enviamos un nuevo enlace.',
  }

  if (!user || user.emailVerified) {
    return res.json(genericResponse)
  }

  const { token, hash, expires } = generateVerificationToken()
  await setVerificationToken(user.id, hash, expires)

  let emailPreviewUrl: string | undefined
  try {
    const result = await dispatchVerificationEmail(user, token)
    emailPreviewUrl = result.previewUrl
  } catch (err) {
    console.error('[auth] No se pudo reenviar el correo de verificación:', err)
  }

  res.json({ ...genericResponse, emailPreviewUrl })
}))

router.post('/login', loginLimiter, asyncRoute(async (req, res) => {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' })
  }

  const user = await findUserByEmail(email)
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas.' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales inválidas.' })
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      error: 'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
      emailNotVerified: true,
    })
  }

  // Con 2FA activado, correo+contraseña correctos NO son suficientes para
  // obtener una sesión: se emite un token de corta duración que solo
  // autoriza enviar el código TOTP al segundo endpoint.
  if (user.totpEnabled) {
    const pendingToken = signPending2FAToken(user.id)
    return res.json({ requiresTwoFactor: true, pendingToken })
  }

  const token = signToken({ sub: user.id, email: user.email })
  res.json({ token, user: toPublicUser(user) })
}))

router.post('/verify-login', loginLimiter, asyncRoute(async (req, res) => {
  const { pendingToken, code } = req.body ?? {}

  if (typeof pendingToken !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ error: 'Faltan datos para verificar el código.' })
  }

  const userId = verifyPending2FAToken(pendingToken)
  if (!userId) {
    return res.status(401).json({ error: 'La sesión de verificación expiró. Inicia sesión de nuevo.' })
  }

  const user = await findUserById(userId)
  if (!user || !user.totpEnabled || !user.totpSecret) {
    return res.status(400).json({ error: 'Esta cuenta no tiene la verificación en dos pasos activada.' })
  }

  authenticator.options = { window: 2 }
  const isValidCode = authenticator.check(code.replace(/\s/g, ''), user.totpSecret)
  if (!isValidCode) {

    await logActivity(user.id, 'login_failed_2fa', 'Código de verificación en dos pasos incorrecto al iniciar sesión.', req.ip)
    return res.status(401).json({ error: 'El código de verificación es incorrecto.' })
  }

  await logActivity(user.id, 'login', 'Inicio de sesión con verificación en dos pasos.', req.ip)
  const token = signToken({ sub: user.id, email: user.email })
  res.json({ token, user: toPublicUser(user) })
}))

router.get('/me', requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const user = await findUserById(req.auth!.sub)
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' })
  }
  res.json({ user: toPublicUser(user) })
}))

export default router
