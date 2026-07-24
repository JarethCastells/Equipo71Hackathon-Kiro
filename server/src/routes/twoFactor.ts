import bcrypt from 'bcryptjs'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { logActivity } from '../activityStore.js'
import { sendSecurityAlertEmail } from '../mailer.js'
import { findUserById, setTotpSecret } from '../userStore.js'

const router = Router()
const ISSUER = 'TalentFlow AI'

// Permitir tolerancia de tiempo de +/- 60s (window = 2) para compensar desfasamientos
// de reloj entre el servidor y la app authenticator del usuario.
authenticator.options = { window: 2 }


type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as AuthedRequest, res, next).catch(next)
  }
}

async function notifySecurityEvent(
  user: { name: string; email: string; notifySecurity: boolean },
  eventTitle: string,
  eventDescription: string,
  ip: string | undefined,
) {
  if (!user.notifySecurity) return
  try {
    await sendSecurityAlertEmail(user.email, {
      name: user.name,
      eventTitle,
      eventDescription,
      timestamp: new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
      ipAddress: ip,
    })
  } catch (err) {
    console.error('[2fa] No se pudo enviar la alerta de seguridad:', err)
  }
}

// Paso 1: genera un secreto TOTP nuevo (aún no activado) y lo devuelve como
// QR para escanear con Google Authenticator/Authy, más el secreto en texto
// por si el usuario prefiere capturarlo manualmente.
router.post('/setup', requireAuth, asyncRoute(async (req, res) => {
  const user = await findUserById(req.auth!.sub)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' })

  if (user.totpEnabled) {
    return res.status(400).json({ error: 'La verificación en dos pasos ya está activada.' })
  }

  const secret = authenticator.generateSecret()
  const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret)
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl)

  // El secreto se guarda ya, pero totp_enabled sigue en 0 hasta que el
  // usuario confirme con un código válido en /enable (evita que se active
  // "a medias" si el usuario nunca completa el escaneo del QR).
  await setTotpSecret(user.id, secret, false)

  res.json({ secret, qrDataUrl })
}))

// Paso 2: el usuario ingresa el código de 6 dígitos generado por su app
// para confirmar que configuró el secreto correctamente antes de activarlo.
router.post('/enable', requireAuth, asyncRoute(async (req, res) => {
  const { code } = req.body ?? {}
  if (typeof code !== 'string') {
    return res.status(400).json({ error: 'Ingresa el código de tu app de autenticación.' })
  }

  const user = await findUserById(req.auth!.sub)
  if (!user || !user.totpSecret) {
    return res.status(400).json({ error: 'Primero genera un código QR desde /setup.' })
  }

  const isValid = authenticator.check(code.replace(/\s/g, ''), user.totpSecret)
  if (!isValid) {
    return res.status(400).json({ error: 'El código no es correcto. Intenta de nuevo.' })
  }

  await setTotpSecret(user.id, user.totpSecret, true)
  await logActivity(user.id, '2fa_enabled', 'Verificación en dos pasos activada.', req.ip)
  await notifySecurityEvent(user, 'Activaste la verificación en dos pasos', 'A partir de ahora se te pedirá un código adicional al iniciar sesión.', req.ip)

  res.json({ message: 'Verificación en dos pasos activada correctamente.' })
}))

// Desactivar 2FA: exige la contraseña actual para evitar que alguien con
// una sesión abierta (pero sin la contraseña) pueda apagar esta protección.
router.post('/disable', requireAuth, asyncRoute(async (req, res) => {
  const { currentPassword } = req.body ?? {}
  if (typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Confirma tu contraseña actual para desactivar 2FA.' })
  }

  const user = await findUserById(req.auth!.sub)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' })

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta.' })
  }

  await setTotpSecret(user.id, null, false)
  await logActivity(user.id, '2fa_disabled', 'Verificación en dos pasos desactivada.', req.ip)
  await notifySecurityEvent(user, 'Desactivaste la verificación en dos pasos', 'Tu cuenta ya no requiere un código adicional al iniciar sesión. Si no fuiste tú, cambia tu contraseña de inmediato.', req.ip)

  res.json({ message: 'Verificación en dos pasos desactivada.' })
}))

export default router
