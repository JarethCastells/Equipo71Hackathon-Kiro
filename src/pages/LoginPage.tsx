import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn, AlertCircle, Mail, ShieldCheck } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import { useAuth } from '../context/AuthContext'
import { ApiError, resendVerification, verifyLoginCode } from '../lib/api'

export default function LoginPage() {
  const { login, loginWithToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  // Segundo paso: cuando la cuenta tiene 2FA activado, el backend responde
  // con un pendingToken en vez de una sesión. Hasta que el código TOTP sea
  // correcto no se emite el JWT real.
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [verifyingCode, setVerifyingCode] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNeedsVerification(false)
    setSubmitting(true)
    try {
      const res = await login({ email, password })
      if (res.requiresTwoFactor && res.pendingToken) {
        setPendingToken(res.pendingToken)
      } else {
        navigate(from, { replace: true })
      }
    } catch (err) {
      if (err instanceof ApiError && err.emailNotVerified) {
        setNeedsVerification(true)
        setError(err.message)
      } else {
        setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault()
    if (!pendingToken) return
    setCodeError(null)
    setVerifyingCode(true)
    try {
      const res = await verifyLoginCode({ pendingToken, code })
      loginWithToken(res.token, res.user)
      navigate(from, { replace: true })
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : 'No se pudo verificar el código.')
    } finally {
      setVerifyingCode(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setResendMessage(null)
    try {
      const res = await resendVerification(email)
      setResendMessage(res.message)
    } catch {
      setResendMessage('No se pudo reenviar el correo. Intenta de nuevo en unos minutos.')
    } finally {
      setResending(false)
    }
  }

  if (pendingToken) {
    return (
      <AuthLayout
        title="Verificación en dos pasos"
        subtitle="Ingresa el código de 6 dígitos de tu app de autenticación."
      >
        <form onSubmit={handleVerifyCode} className="space-y-4">
          {codeError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            >
              <AlertCircle size={16} className="shrink-0" />
              {codeError}
            </motion.div>
          )}

          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-violet-500">
              <ShieldCheck size={26} className="text-white" />
            </div>
          </div>

          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-300">
              Código de verificación
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg font-semibold tracking-[0.3em] text-white placeholder:text-slate-500 outline-none transition-colors focus:border-accent-500/60 focus:bg-white/[0.07]"
            />
          </div>

          <button
            type="submit"
            disabled={verifyingCode || code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifyingCode ? 'Verificando...' : 'Verificar y entrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setPendingToken(null)}
          className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-300"
        >
          Volver a iniciar sesión
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Bienvenido/a de nuevo"
      subtitle="Inicia sesión para revisar tus matches y seguir tus proyectos."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
            {needsVerification && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail size={13} />
                {resending ? 'Reenviando...' : 'Reenviar correo de verificación'}
              </button>
            )}
            {resendMessage && <p className="mt-2 text-xs text-rose-200/80">{resendMessage}</p>}
          </motion.div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 outline-none transition-colors focus:border-accent-500/60 focus:bg-white/[0.07] sm:text-sm"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              Contraseña
            </label>
            <a href="#" className="text-xs font-medium text-accent-400 hover:text-accent-300">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-base text-white placeholder:text-slate-500 outline-none transition-colors focus:border-accent-500/60 focus:bg-white/[0.07] sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn size={16} />
          {submitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        ¿Aún no tienes cuenta?{' '}
        <Link to="/signup" className="font-semibold text-accent-400 hover:text-accent-300">
          Crea una gratis
        </Link>
      </p>
    </AuthLayout>
  )
}
