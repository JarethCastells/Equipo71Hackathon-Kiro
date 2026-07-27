import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Check, Copy, Eye, EyeOff, Mail, ShieldCheck, ShieldOff, Sparkles } from 'lucide-react'

import { useAuth } from '../../context/AuthContext'

import {
  ApiError,
  changePassword,
  disable2FA,
  enable2FA,
  requestEmailChange,
  setup2FA,
} from '../../lib/api'

function FeedbackBanner({ error, message }: { error: string | null; message: string | null }) {
  if (!error && !message) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
        error ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      }`}
    >
      {error ? <AlertCircle size={16} className="shrink-0" /> : <Check size={16} className="shrink-0" />}
      {error ?? message}
    </motion.div>
  )
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSaving(true)
    try {
      const res = await changePassword({ currentPassword, newPassword })
      setMessage(res.message)
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-semibold text-white">Cambiar contraseña</h2>
      <p className="mt-1 text-sm text-slate-400">Te enviaremos una alerta por correo cada vez que la cambies.</p>

      <FeedbackBanner error={error} message={message} />

      <div className="mt-4 space-y-3">
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Contraseña actual"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
        />
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña (mínimo 8 caracteres)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-5 w-full rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {saving ? 'Actualizando...' : 'Actualizar contraseña'}
      </button>
    </form>
  )
}

function EmailChangeSection() {
  const { user } = useAuth()
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setEmailPreviewUrl(null)
    setSaving(true)
    try {
      const res = await requestEmailChange({ newEmail, currentPassword })
      setMessage(res.message)
      setEmailPreviewUrl(res.emailPreviewUrl ?? null)
      setNewEmail('')
      setCurrentPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo solicitar el cambio de correo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-semibold text-white">Cambiar correo electrónico</h2>
      <p className="mt-1 text-sm text-slate-400">
        Correo actual: <span className="text-white">{user?.email}</span>
        {user?.pendingEmail && (
          <span className="ml-2 text-amber-400">(cambio pendiente a {user.pendingEmail})</span>
        )}
      </p>

      <FeedbackBanner error={error} message={message} />
      {emailPreviewUrl && (
        <a
          href={emailPreviewUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
        >
          <Sparkles size={13} />
          Ver correo de confirmación (modo prueba)
        </a>
      )}

      <div className="mt-4 space-y-3">
        <input
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Nuevo correo electrónico"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
        />
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Confirma tu contraseña actual"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <Mail size={15} />
        {saving ? 'Enviando...' : 'Enviar enlace de confirmación'}
      </button>
    </form>
  )
}

function TwoFactorSection() {
  const { user, refreshUser } = useAuth()
  const [step, setStep] = useState<'idle' | 'setup'>('idle')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const startSetup = async () => {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const res = await setup2FA()
      setQrDataUrl(res.qrDataUrl)
      setSecret(res.secret)
      setStep('setup')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar la configuración.')
    } finally {
      setBusy(false)
    }
  }

  const handleCopySecret = () => {
    if (!secret) return
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const confirmEnable = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await enable2FA(code)
      setMessage(res.message)
      setStep('idle')
      setCode('')
      await refreshUser()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo activar la verificación en dos pasos.')
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const res = await disable2FA(disablePassword)
      setMessage(res.message)
      setDisablePassword('')
      await refreshUser()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo desactivar la verificación en dos pasos.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Verificación en dos pasos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Añade una capa extra de seguridad con una app como Google Authenticator.
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold sm:self-center ${
            user?.totpEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-slate-400'
          }`}
        >
          {user?.totpEnabled ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
          {user?.totpEnabled ? 'Activada' : 'Desactivada'}
        </span>
      </div>

      <FeedbackBanner error={error} message={message} />

      {!user?.totpEnabled && step === 'idle' && (
        <button
          type="button"
          onClick={startSetup}
          disabled={busy}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:opacity-60 sm:w-auto"
        >
          {busy ? 'Generando...' : 'Activar verificación en dos pasos'}
        </button>
      )}

      {!user?.totpEnabled && step === 'setup' && qrDataUrl && (
        <form onSubmit={confirmEnable} className="mt-5 space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-950/70 border border-white/10 p-6 text-center">
            <img src={qrDataUrl} alt="Código QR para configurar 2FA" className="h-44 w-44 rounded-xl bg-white p-2 shadow-2xl" />
            <p className="max-w-md text-xs text-slate-300">
              1. Escanea este código QR con <strong>Google Authenticator</strong>, <strong>Authy</strong> o <strong>Microsoft Authenticator</strong>.
              <br />
              2. Si no puedes escanearlo, ingresa la clave de configuración manualmente:
            </p>
            {secret && (
              <div className="mt-1 flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
                <code className="w-full max-w-xs break-all rounded-xl bg-black/50 border border-white/10 px-4 py-2 font-mono text-sm tracking-widest text-accent-300 font-bold text-center sm:w-auto sm:text-left">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition-all active:scale-95"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-center text-xs font-semibold text-slate-300">
              Paso 3: Ingresa el código de 6 dígitos que aparece en tu app
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000 000"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xl font-bold tracking-[0.4em] text-white placeholder:text-slate-600 outline-none focus:border-accent-500/60"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="flex-1 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Verificando...' : 'Confirmar y activar 2FA'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('idle')
                setError(null)
                setCode('')
              }}
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}


      {user?.totpEnabled && (
        <form onSubmit={handleDisable} className="mt-5 space-y-3">
          <input
            type="password"
            required
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            placeholder="Confirma tu contraseña para desactivar"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-rose-500/60"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full border border-rose-500/30 bg-rose-500/10 px-6 py-2.5 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-60 sm:w-auto"
          >
            {busy ? 'Desactivando...' : 'Desactivar verificación en dos pasos'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function SecuritySection() {
  return (
    <div className="space-y-6">
      <PasswordSection />
      <EmailChangeSection />
      <TwoFactorSection />
    </div>
  )
}
