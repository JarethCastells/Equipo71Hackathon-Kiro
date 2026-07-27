import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import { useAuth } from '../context/AuthContext'
import { ApiError, resendVerification, verifyEmail } from '../lib/api'

type Status = 'verifying' | 'success' | 'error'

/**
 * Página destino del enlace de verificación enviado por correo. Es el único
 * camino para activar una cuenta nueva: sin pasar por aquí (con un token
 * válido emitido por el backend), no es posible obtener una sesión.
 */
export default function VerifyPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState<Status>('verifying')
  const [errorMessage, setErrorMessage] = useState('')
  const [expired, setExpired] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    if (!token) {
      setStatus('error')
      setErrorMessage('Falta el token de verificación en el enlace.')
      return
    }

    verifyEmail(token)
      .then((res) => {
        loginWithToken(res.token, res.user)
        setStatus('success')
        setTimeout(() => navigate('/dashboard', { replace: true }), 1200)
      })
      .catch((err) => {
        setStatus('error')
        if (err instanceof ApiError) {
          setErrorMessage(err.message)
          setExpired(Boolean(err.expired))
        } else {
          setErrorMessage('No se pudo verificar tu correo. Intenta de nuevo.')
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleResend = async () => {
    if (!resendEmail) return
    setResending(true)
    setResendMessage(null)
    try {
      const res = await resendVerification(resendEmail)
      setResendMessage(res.message)
    } catch {
      setResendMessage('No se pudo reenviar el correo. Intenta de nuevo en unos minutos.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      title={
        status === 'verifying'
          ? 'Verificando tu correo...'
          : status === 'success'
            ? '¡Correo verificado!'
            : 'No pudimos verificar tu correo'
      }
      subtitle={
        status === 'verifying'
          ? 'Esto toma solo un segundo.'
          : status === 'success'
            ? 'Tu cuenta está activa. Redirigiendo a tu dashboard...'
            : 'El enlace puede haber expirado o ya haberse usado.'
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-6 text-center ${
          status === 'error'
            ? 'border-rose-500/20 bg-rose-500/5'
            : 'border-emerald-500/20 bg-emerald-500/5'
        }`}
      >
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            status === 'error' ? 'bg-rose-500/15' : 'bg-gradient-to-br from-accent-500 to-violet-500'
          }`}
        >
          {status === 'verifying' && <Loader2 size={24} className="animate-spin text-white" />}
          {status === 'success' && <CheckCircle2 size={24} className="text-white" />}
          {status === 'error' && <XCircle size={24} className="text-rose-400" />}
        </div>

        {status === 'error' && (
          <>
            <p className="mt-4 text-sm text-slate-300">{errorMessage}</p>
            {expired && (
              <div className="mt-4 space-y-2">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-base text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || !resendEmail}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Mail size={15} />
                  {resending ? 'Reenviando...' : 'Reenviar enlace de verificación'}
                </button>
                {resendMessage && <p className="text-xs text-slate-400">{resendMessage}</p>}
              </div>
            )}
          </>
        )}
      </motion.div>

      {status === 'error' && (
        <p className="mt-6 text-center text-sm text-slate-400">
          <Link to="/login" className="font-semibold text-accent-400 hover:text-accent-300">
            Volver a iniciar sesión
          </Link>
        </p>
      )}
    </AuthLayout>
  )
}
