import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Briefcase, Check, HeartHandshake, ShieldAlert, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ApiError, updateNotificationPrefs } from '../../lib/api'
import type { AccountRole } from '../../lib/api'

interface ToggleRowProps {
  icon: LucideIcon
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

function ToggleRow({ icon: Icon, title, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20 hover:bg-white/[0.05] transition-all">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500/20 to-violet-500/20 border border-accent-500/30 text-accent-400">
          <Icon size={18} />
        </span>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-xl">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
            checked
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-700 bg-slate-800/60 text-slate-400'
          }`}
        >
          {checked ? 'Activado' : 'Desactivado'}
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-all duration-300 border disabled:opacity-50 ${
            checked
              ? 'bg-gradient-to-r from-accent-500 to-violet-500 border-accent-400/40 shadow-lg shadow-accent-500/30'
              : 'bg-slate-900 border-white/15'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          >
            {checked && <Check size={10} className="text-accent-600 font-bold" />}
          </span>
        </button>
      </div>
    </div>
  )
}

// Copys por rol: cada rol recibe (o dispara) tipos de aviso distintos, así
// que ni el ícono ni el texto deben ser genéricos para los tres.
const MATCH_COPY: Record<'freelancer' | 'voluntario', { icon: LucideIcon; title: string; description: string }> = {
  freelancer: {
    icon: Briefcase,
    title: 'Nuevas ofertas compatibles',
    description: 'Recibe un correo cuando una oferta de proyecto se ajuste a tu perfil y presupuesto.',
  },
  voluntario: {
    icon: HeartHandshake,
    title: 'Nuevas oportunidades de voluntariado',
    description: 'Recibe un correo cuando haya una vacante de voluntariado que se ajuste a tu perfil.',
  },
}

const SECURITY_DESCRIPTION: Record<AccountRole, string> = {
  freelancer: 'Avisos cuando cambies tu contraseña o correo, activa/desactives 2FA, o agregues una cuenta bancaria.',
  voluntario: 'Avisos cuando cambies tu contraseña o correo, o activa/desactives la verificación en dos pasos.',
  reclutador: 'Avisos cuando cambies tu contraseña o correo, activa/desactives 2FA, o firmes una responsiva de contratación.',
}

export default function NotificationsSection() {
  const { user, refreshUser } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleChange = async (field: 'notifyNewMatches' | 'notifySecurity', value: boolean) => {
    setError(null)
    setMessage(null)
    setSaving(true)
    try {
      await updateNotificationPrefs({ [field]: value })
      await refreshUser()
      setMessage('Preferencias actualizadas.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron actualizar tus preferencias.')
    } finally {
      setSaving(false)
    }
  }

  const role = user?.role
  // Los reclutadores no reciben correos de "nuevo match" (ese aviso es para
  // quien busca proyecto/voluntariado, no para quien lo publica), así que
  // este toggle no aplica y se oculta en vez de mostrar algo sin efecto.
  const matchCopy = role === 'freelancer' || role === 'voluntario' ? MATCH_COPY[role] : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white">Notificaciones por correo</h2>
        <p className="mt-1 text-sm text-slate-400">
          Elige qué avisos quieres recibir en tu correo, además de verlos en la campana de la app.
        </p>
      </div>

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
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          <Check size={16} className="shrink-0" />
          {message}
        </motion.div>
      )}

      <div className="space-y-4">
        {matchCopy && (
          <ToggleRow
            icon={matchCopy.icon}
            title={matchCopy.title}
            description={matchCopy.description}
            checked={user?.notifyNewMatches ?? true}
            disabled={saving}
            onChange={(v) => handleChange('notifyNewMatches', v)}
          />
        )}
        <ToggleRow
          icon={ShieldAlert}
          title="Alertas de seguridad"
          description={role ? SECURITY_DESCRIPTION[role] : SECURITY_DESCRIPTION.freelancer}
          checked={user?.notifySecurity ?? true}
          disabled={saving}
          onChange={(v) => handleChange('notifySecurity', v)}
        />
      </div>
    </div>
  )
}

