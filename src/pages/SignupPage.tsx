import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, Eye, EyeOff, Mail, Sparkles, UserPlus } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import { useAuth } from '../context/AuthContext'
import { ApiError, resendVerification } from '../lib/api'
import type { AccountRole } from '../lib/api'

const ROLES: { value: AccountRole; label: string; hint: string }[] = [
  { value: 'freelancer', label: 'Freelancer', hint: 'Ofrezco mis servicios' },
  { value: 'voluntario', label: 'Voluntario/a', hint: 'Quiero ayudar sin costo' },
  { value: 'reclutador', label: 'Reclutador/a', hint: 'Busco talento' },
]

export default function SignupPage() {
  const { signup } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AccountRole>('freelancer')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Una vez creada la cuenta, mostramos la pantalla de "revisa tu correo".
  // No se navega al dashboard: sin hacer clic en el enlace de verificación
  // del correo, la cuenta permanece inactiva (evita registros automatizados).
  const [awaitingVerification, setAwaitingVerification] = useState(false)
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null)
  const [emailSendFailed, setEmailSendFailed] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await signup({ name, email, password, role })
      setEmailPreviewUrl(result.emailPreviewUrl ?? null)
      setEmailSendFailed(!result.emailSent)
      setAwaitingVerification(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setResendMessage(null)
    try {
      const res = await resendVerification(email)
      setResendMessage(res.message)
      if (res.emailPreviewUrl) setEmailPreviewUrl(res.emailPreviewUrl)
    } catch {
      setResendMessage('No se pudo reenviar el correo. Intenta de nuevo en unos minutos.')
    } finally {
      setResending(false)
    }
  }

  if (awaitingVerification) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        subtitle="Confirma tu cuenta para poder iniciar sesión y entrar al dashboard."
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-violet-500">
            <Mail size={24} className="text-white" />
          </div>
          <p className="mt-4 text-sm text-slate-300">
            Te enviamos un enlace de verificación a <strong className="text-white">{email}</strong>.
            Haz clic en el botón del correo para activar tu cuenta y acceder al dashboard.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Sin ese paso no podrás iniciar sesión: es nuestra forma de confirmar que la cuenta te
            pertenece y de proteger la plataforma contra registros automatizados.
          </p>

          {emailSendFailed && (
            <p className="mt-4 text-xs text-rose-300">
              No pudimos enviar el correo automáticamente. Usa el botón de abajo para reintentar.
            </p>
          )}

          {emailPreviewUrl && (
            <a
              href={emailPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition-transform hover:scale-105"
            >
              <Sparkles size={15} />
              Ver correo de verificación (modo prueba)
            </a>
          )}
        </motion.div>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="mt-6 w-full rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? 'Reenviando...' : 'Reenviar correo de verificación'}
        </button>
        {resendMessage && <p className="mt-3 text-center text-xs text-slate-400">{resendMessage}</p>}

        <p className="mt-6 text-center text-sm text-slate-400">
          ¿Ya verificaste tu correo?{' '}
          <Link to="/login" className="font-semibold text-accent-400 hover:text-accent-300">
            Inicia sesión
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Únete en menos de un minuto y empieza a recibir matches con IA."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </motion.div>
        )}

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-300">
            Nombre completo
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ana Torres"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-accent-500/60 focus:bg-white/[0.07]"
          />
        </div>

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
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-accent-500/60 focus:bg-white/[0.07]"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-accent-500/60 focus:bg-white/[0.07]"
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

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-300">Quiero registrarme como</span>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  role === r.value
                    ? 'border-accent-500/50 bg-accent-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                }`}
              >
                <span className="block text-sm font-semibold text-white">{r.label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-400">{r.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserPlus size={16} />
          {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>

        <p className="text-center text-[11px] text-slate-500">
          Al crear tu cuenta aceptas nuestros Términos de servicio y Política de privacidad.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-accent-400 hover:text-accent-300">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
