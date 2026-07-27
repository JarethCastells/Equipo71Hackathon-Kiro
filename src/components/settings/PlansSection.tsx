import { useState } from 'react'
import {
  AlertCircle,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Cpu,
  FileCheck2,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ApiError, updateUserPlan, upgradePlanCheckout, type UserPlan } from '../../lib/api'
import { PaymentCheckoutModal } from '../dashboard/PlanUpgradeModal'

interface PlanCardProps {
  id: UserPlan
  name: string
  price: string
  period: string
  badge?: string
  color: string
  buttonClass: string
  isCurrent: boolean
  submitting: boolean
  onSelect: (plan: UserPlan) => void
  features: { icon: typeof Sparkles; text: string; highlight?: boolean }[]
}

function PlanCard({
  id,
  name,
  price,
  period,
  badge,
  color,
  buttonClass,
  isCurrent,
  submitting,
  onSelect,
  features,
}: PlanCardProps) {
  return (
    <div className={`relative flex flex-col justify-between rounded-3xl border p-6 backdrop-blur-sm ${color}`}>
      {badge && (
        <div className="absolute -top-3.5 right-4 max-w-[calc(100%-2rem)] truncate rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
          {badge}
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-white">{name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-white">{price}</span>
          <span className="text-xs text-slate-400">{period}</span>
        </div>

        <div className="mt-5 space-y-2.5 border-t border-white/10 pt-4">
          {features.map((feat, idx) => {
            const Icon = feat.icon
            return (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    feat.highlight ? 'bg-accent-500/20 text-accent-400' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  <Icon size={12} />
                </span>
                <span className={feat.highlight ? 'font-medium text-slate-200' : 'text-slate-400'}>
                  {feat.text}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-6 pt-2">
        <button
          type="button"
          disabled={isCurrent || submitting}
          onClick={() => onSelect(id)}
          className={`w-full rounded-full py-2.5 text-xs font-bold transition-all disabled:opacity-60 ${buttonClass}`}
        >
          {isCurrent
            ? 'Tu Plan Actual'
            : submitting
            ? 'Actualizando...'
            : id === 'libre'
            ? 'Cambiar a Plan Libre'
            : `Elegir ${name}`}
        </button>
      </div>
    </div>
  )
}

export default function PlansSection() {
  const { user, refreshUser } = useAuth()
  const [submittingPlan, setSubmittingPlan] = useState<UserPlan | null>(null)
  const [checkoutPlan, setCheckoutPlan] = useState<{ id: UserPlan; name: string; price: string; priceNumber: number; period: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const currentPlan = user?.plan ?? 'libre'

  const handleApplyPlan = async (
    plan: UserPlan,
    cardData?: { cardNumber: string; expiry: string; cvv: string; holderName: string },
  ) => {
    setError(null)
    setSuccess(null)
    setSubmittingPlan(plan)

    try {
      if (cardData && plan !== 'libre') {
        await upgradePlanCheckout({ plan, ...cardData })
      } else {
        await updateUserPlan(plan)
      }
      await refreshUser()
      setSuccess(`¡Tu cuenta ahora tiene activo el Plan ${plan.toUpperCase()}!`)
      setCheckoutPlan(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar de plan.')
    } finally {
      setSubmittingPlan(null)
    }
  }

  const handleSelectPlan = (plan: UserPlan) => {
    if (plan === currentPlan) return
    if (plan === 'libre') {
      void handleApplyPlan('libre')
    } else if (plan === 'plus') {
      setCheckoutPlan({ id: 'plus', name: 'Plan Plus', price: '$1', priceNumber: 1, period: 'MXN / mes' })
    } else if (plan === 'pro') {
      setCheckoutPlan({ id: 'pro', name: 'Plan Pro', price: '$1', priceNumber: 1, period: 'MXN / mes' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Tu suscripción Gemini AI</h2>
            <p className="mt-1 text-xs text-slate-400">
              Usa los paquetes para activar la modificación automática de CV, agendamiento autónomo de juntas por correo SMTP y postulaciones en segundo plano.
            </p>
          </div>
          <span className="shrink-0 self-start rounded-full border border-accent-500/30 bg-accent-500/10 px-4 py-1.5 text-xs font-bold uppercase text-accent-400 sm:self-center">
            Plan Actual: {currentPlan}
          </span>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <PlanCard
            id="libre"
            name="Plan Libre"
            price="$0"
            period="Gratis para siempre"
            color="border-white/10 bg-white/5"
            buttonClass="border border-white/20 bg-white/5 text-white hover:bg-white/10"
            isCurrent={currentPlan === 'libre'}
            submitting={submittingPlan === 'libre'}
            onSelect={handleSelectPlan}
            features={[
              { icon: Zap, text: 'Acceso estándar a Gemini API' },
              { icon: Check, text: 'Evaluación y scoring de postulaciones' },
              { icon: Check, text: 'Postulaciones y respuestas manuales' },
              { icon: Check, text: 'Hasta 3 ofertas activas' },
            ]}
          />

          <PlanCard
            id="plus"
            name="Plan Plus"
            price="$299"
            period="MXN / mes"
            badge="Popular"
            color="border-accent-500/40 bg-accent-500/10 ring-1 ring-accent-500/30"
            buttonClass="bg-gradient-to-r from-accent-500 to-violet-500 text-white shadow-lg shadow-accent-500/25 hover:scale-[1.02]"
            isCurrent={currentPlan === 'plus'}
            submitting={submittingPlan === 'plus'}
            onSelect={handleSelectPlan}
            features={[
              {
                icon: FileCheck2,
                text: 'Gemini CV Optimizer: Modificación y mejora automática de CV con IA',
                highlight: true,
              },
              {
                icon: Bot,
                text: 'Postulación Asistida: Redacción inteligente de propuestas y postulación directa',
                highlight: true,
              },
              {
                icon: Sparkles,
                text: 'Match Autónomo: Recomendación activa de tu perfil a reclutadores',
                highlight: true,
              },
              { icon: Cpu, text: 'Asistente Gemini 24/7 para consultas ilimitadas de ofertas' },
              { icon: Check, text: 'Hasta 15 vacantes destacadas' },
            ]}
          />

          <PlanCard
            id="pro"
            name="Plan Pro"
            price="$599"
            period="MXN / mes"
            badge="Autónomo Elite"
            color="border-violet-500/40 bg-violet-950/40 ring-1 ring-violet-500/30"
            buttonClass="bg-gradient-to-r from-violet-500 via-accent-500 to-pink-500 text-white shadow-lg shadow-violet-500/25 hover:scale-[1.02]"
            isCurrent={currentPlan === 'pro'}
            submitting={submittingPlan === 'pro'}
            onSelect={handleSelectPlan}
            features={[
              {
                icon: Calendar,
                text: 'Agendamiento Autónomo de Juntas: Coordenadas y correos de confirmación vía SMTP',
                highlight: true,
              },
              {
                icon: Mail,
                text: 'Postulaciones y Match 100% Autónomos: La IA postula tu perfil automáticamente',
                highlight: true,
              },
              {
                icon: Sparkles,
                text: 'Publicación Ilimitada & Vacantes Destacadas con sello de alta prioridad',
                highlight: true,
              },
              { icon: Cpu, text: 'Gemini 1.5 Pro & 2.0 Pro API de máxima velocidad' },
              { icon: ShieldCheck, text: 'Soporte VIP prioritario' },
            ]}
          />
        </div>

        {checkoutPlan && (
          <PaymentCheckoutModal
            plan={checkoutPlan}
            onClose={() => setCheckoutPlan(null)}
            onSuccess={handleApplyPlan}
          />
        )}
      </div>
    </div>
  )
}
