import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Briefcase,
  KeyRound,
  Landmark,
  LogIn,
  Mail,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserRoundCheck,
  UserRoundPen,
  type LucideIcon,
} from 'lucide-react'
import { listActivity } from '../../lib/api'
import type { ActivityEntry, ActivityEventType } from '../../lib/api'

const EVENT_ICON: Record<ActivityEventType, LucideIcon> = {
  account_created: UserRoundCheck,
  email_verified: Mail,
  password_changed: KeyRound,
  email_change_requested: Mail,
  email_changed: Mail,
  profile_updated: UserRoundPen,
  avatar_updated: UserRoundPen,
  '2fa_enabled': ShieldCheck,
  '2fa_disabled': ShieldOff,
  bank_account_added: Landmark,
  bank_account_removed: Trash2,
  login: LogIn,
  login_failed_2fa: ShieldOff,
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'justo ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export default function ActivitySection() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listActivity()
      .then((res) => {
        if (!cancelled) setEntries(res.entries)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la actividad reciente.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-semibold text-white">Actividad reciente</h2>
      <p className="mt-1 text-sm text-slate-400">
        Historial de eventos importantes en tu cuenta: qué pasó y cuándo.
      </p>

      <div className="mt-5 space-y-1">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-accent-400" />
            <span className="ml-3 text-sm text-slate-400">Cargando actividad...</span>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-10 text-center">
            <Briefcase size={24} className="text-slate-500" />
            <p className="mt-2 text-sm text-slate-400">Todavía no hay actividad registrada.</p>
          </div>
        )}

        {entries.map((entry) => {
          const Icon = EVENT_ICON[entry.eventType] ?? UserRoundCheck
          return (
            <div key={entry.id} className="flex items-start gap-3 border-b border-white/5 py-3 last:border-0">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5">
                <Icon size={14} className="text-accent-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200 break-words">{entry.description}</p>
                <p className="mt-0.5 text-xs text-slate-500 break-words">
                  {timeAgo(entry.createdAt)}
                  {entry.ipAddress ? ` · IP ${entry.ipAddress}` : ''}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
