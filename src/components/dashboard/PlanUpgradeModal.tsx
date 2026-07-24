import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Cpu,
  FileCheck2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
  X,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ApiError, listBankAccounts, updateUserPlan, upgradePlanCheckout, type BankAccount, type UserPlan } from '../../lib/api'

interface PlanUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

interface PlanDefinition {
  id: UserPlan
  name: string
  price: string
  priceNumber: number
  period: string
  popular?: boolean
  badge?: string
  color: string
  buttonClass: string
  features: { icon: typeof Sparkles; text: string; highlight?: boolean }[]
}

const PLANS: PlanDefinition[] = [
  {
    id: 'libre',
    name: 'Plan Libre',
    price: '$0',
    priceNumber: 0,
    period: 'Gratis para siempre',
    color: 'border-white/10 bg-white/5',
    buttonClass: 'border border-white/20 bg-white/5 text-white hover:bg-white/10',
    features: [
      { icon: Zap, text: 'Acceso estándar a Gemini API (consultas básicas)' },
      { icon: Check, text: 'Evaluación y scoring básico de postulaciones' },
      { icon: Check, text: 'Postulaciones y respuestas manuales' },
      { icon: Check, text: 'Publicación de hasta 3 ofertas activas' },
    ],
  },
  {
    id: 'plus',
    name: 'Plan Plus',
    price: '$299',
    priceNumber: 299,
    period: 'MXN / mes',
    popular: true,
    badge: 'Popular',
    color: 'border-accent-500/50 bg-accent-500/10 ring-1 ring-accent-500/30',
    buttonClass:
      'bg-gradient-to-r from-accent-500 to-violet-500 text-white shadow-lg shadow-accent-500/25 hover:scale-[1.02]',
    features: [
      {
        icon: FileCheck2,
        text: 'Gemini CV Optimizer: Modificación, redacción y estructura automática de tu CV con IA',
        highlight: true,
      },
      {
        icon: Bot,
        text: 'Postulación Asistida por IA: Redacción inteligente de propuestas y postulación en 1 clic',
        highlight: true,
      },
      {
        icon: Sparkles,
        text: 'Match Autónomo & Recomendación: La IA recomienda tu perfil prioritariamente a reclutadores',
        highlight: true,
      },
      { icon: Cpu, text: 'Asistente Gemini 24/7 para preguntas ilimitadas sobre ofertas y compatibilidad' },
      { icon: Check, text: 'Publicación de hasta 15 vacantes destacadas con IA ranking' },
    ],
  },
  {
    id: 'pro',
    name: 'Plan Pro',
    price: '$599',
    priceNumber: 599,
    period: 'MXN / mes',
    badge: 'Autónomo Elite',
    color: 'border-violet-500/50 bg-violet-950/40 ring-1 ring-violet-500/30',
    buttonClass:
      'bg-gradient-to-r from-violet-500 via-accent-500 to-pink-500 text-white shadow-lg shadow-violet-500/25 hover:scale-[1.02]',
    features: [
      {
        icon: Calendar,
        text: 'Agendamiento Autónomo de Juntas: La IA coordina entrevistas y envía invitaciones por correo SMTP',
        highlight: true,
      },
      {
        icon: Mail,
        text: 'Postulaciones y Match 100% Autónomos: La IA postula tu perfil automáticamente a ofertas afines en segundo plano',
        highlight: true,
      },
      {
        icon: Sparkles,
        text: 'Publicación Ilimitada & Vacantes Destacadas con sello de máxima prioridad',
        highlight: true,
      },
      { icon: Cpu, text: 'Acceso prioritario a Gemini 1.5 Pro & 2.0 Pro API con máxima velocidad de procesamiento' },
      { icon: ShieldCheck, text: 'Soporte VIP prioritario y asesoría directa' },
    ],
  },
]

function isValidLuhnCardNumber(cardNumber: string): boolean {
  const clean = cardNumber.replace(/\D/g, '')
  if (clean.length < 13 || clean.length > 19) return false
  let sum = 0
  let shouldDouble = false
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10)
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

// Modal Emergente de Resultado de Pago / Verificación de Tarjeta
export function PaymentResultModal({
  status,
  title,
  message,
  onClose,
}: {
  status: 'success' | 'fake_card' | 'declined' | 'error'
  title: string
  message: string
  onClose: () => void
}) {
  const isSuccess = status === 'success'
  const isFake = status === 'fake_card'

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <motion.div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-slate-900 p-6 text-center shadow-2xl sm:p-8"
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 20 }}
      >
        <div
          className={`absolute -left-20 -top-20 h-44 w-44 rounded-full blur-3xl opacity-30 ${
            isSuccess
              ? 'bg-emerald-500'
              : isFake
              ? 'bg-amber-500'
              : 'bg-rose-500'
          }`}
        />

        <div className="relative z-10 flex flex-col items-center">
          <div
            className={`mb-4 flex h-20 w-20 items-center justify-center rounded-full border shadow-xl ${
              isSuccess
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400 ring-8 ring-emerald-500/10'
                : isFake
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-400 ring-8 ring-amber-500/10'
                : 'border-rose-500/50 bg-rose-500/20 text-rose-400 ring-8 ring-rose-500/10'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 size={42} />
            ) : isFake ? (
              <AlertTriangle size={42} />
            ) : (
              <XCircle size={42} />
            )}
          </div>

          <span
            className={`mb-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : isFake
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}
          >
            {isSuccess ? 'Verificación & Pago Aprobado' : isFake ? 'Tarjeta Falsa / Inválida' : 'Pago Rechazado'}
          </span>

          <h3 className="text-xl font-extrabold text-white sm:text-2xl">{title}</h3>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-slate-300">
            {message}
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`mt-6 w-full rounded-full py-3 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] ${
              isSuccess
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/25'
                : isFake
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/25'
                : 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/25'
            }`}
          >
            {isSuccess ? '¡Excelente, Continuar!' : 'Intentar Nuevamente'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// Modal de Pasarela de Pago con Tarjeta para Planes Plus / Pro
export function PaymentCheckoutModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: { id: UserPlan; name: string; price: string; priceNumber?: number }
  onClose: () => void
  onSuccess: (planId: UserPlan, cardData?: { cardNumber: string; expiry: string; cvv: string; holderName: string }) => Promise<void>
}) {
  const [cardNumber, setCardNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [savedAccounts, setSavedAccounts] = useState<BankAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'new'>('new')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultModal, setResultModal] = useState<{
    status: 'success' | 'fake_card' | 'declined' | 'error'
    title: string
    message: string
  } | null>(null)

  useEffect(() => {
    listBankAccounts()
      .then((res) => {
        setSavedAccounts(res.accounts)
        const def = res.accounts.find((a) => a.isDefault) || res.accounts[0]
        if (def) {
          setSelectedAccountId(def.id)
        }
      })
      .catch(() => {})
  }, [])

  const handleCardNumberChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16)
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw
    setCardNumber(formatted)
  }

  const handleExpiryChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 4)
    if (raw.length >= 3) {
      setExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`)
    } else {
      setExpiry(raw)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (selectedAccountId === 'new') {
      const rawCard = cardNumber.replace(/\s/g, '')
      if (rawCard.length < 15) {
        setError('Ingresa un número de tarjeta válido (16 dígitos).')
        return
      }
      if (!isValidLuhnCardNumber(rawCard)) {
        setResultModal({
          status: 'fake_card',
          title: 'Tarjeta Falsa / Inválida',
          message:
            'El número de tarjeta ingresado no cumple con el algoritmo bancario (Luhn) o es un número ficticio. Por favor usa un número de tarjeta válido o la tarjeta de pruebas de Stripe (4242 4242 4242 4242).',
        })
        return
      }
      if (!holderName.trim()) {
        setError('Ingresa el nombre del titular de la tarjeta.')
        return
      }
      if (expiry.length < 5) {
        setError('Ingresa la fecha de expiración (MM/AA).')
        return
      }
      if (cvv.length < 3) {
        setError('Ingresa el código de seguridad CVC/CVV (3 o 4 dígitos).')
        return
      }
    }

    setProcessing(true)
    try {
      await onSuccess(plan.id, { cardNumber, expiry, cvv, holderName })
      setResultModal({
        status: 'success',
        title: '¡Cobro de $10.00 MXN Aprobado!',
        message: `El cobro de $10.00 MXN fue autorizado exitosamente por Stripe y tu banco. Tu cuenta ahora tiene activo el ${plan.name}.`,
      })
    } catch (err: any) {
      const errMsg = err instanceof ApiError ? err.message : String(err?.message || err)
      if (errMsg.includes('TARJETA_FALSA') || errMsg.includes('Luhn')) {
        setResultModal({
          status: 'fake_card',
          title: 'Tarjeta Falsa / Inválida',
          message:
            'El servidor o Stripe detectaron que la tarjeta no es un número de tarjeta bancaria válido.',
        })
      } else if (errMsg.includes('PAGO_RECHAZADO') || errMsg.includes('declined')) {
        setResultModal({
          status: 'declined',
          title: 'Pago Rechazado por el Banco',
          message:
            'La transacción de $10.00 MXN fue rechazada por el banco emisor o la pasarela de pagos (fondos insuficientes o restricciones).',
        })
      } else {
        setResultModal({
          status: 'error',
          title: 'Transacción Rechazada',
          message: errMsg,
        })
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <motion.div
        className="relative w-full max-w-md rounded-3xl border border-white/20 bg-slate-900 p-6 shadow-2xl sm:p-8"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 text-accent-400">
          <CreditCard size={20} />
          <h3 className="text-lg font-bold text-white">Pago de Suscripción</h3>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Estás por adquirir el <strong className="text-white">{plan.name}</strong> por{' '}
          <strong className="text-emerald-400">{plan.price} MXN/mes</strong>.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {savedAccounts.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Método de Pago</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs text-white outline-none focus:border-accent-500"
              >
                {savedAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-ink-900">
                    {acc.bankName} (•••• {acc.accountLast4}) {acc.isDefault ? '· Predeterminada' : ''}
                  </option>
                ))}
                <option value="new" className="bg-ink-900">
                  + Ingresar nueva tarjeta de crédito / débito
                </option>
              </select>
            </div>
          )}

          {selectedAccountId === 'new' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Número de Tarjeta</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    placeholder="4242 4242 4242 4242"
                    className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-xs text-white font-mono placeholder:text-slate-500 outline-none focus:border-accent-500"
                  />
                  <CreditCard size={15} className="absolute left-3 top-3 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Nombre del Titular</label>
                <input
                  type="text"
                  required
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Como aparece en la tarjeta"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Expiración (MM/AA)</label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={expiry}
                    onChange={(e) => handleExpiryChange(e.target.value)}
                    placeholder="12/28"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white text-center placeholder:text-slate-500 outline-none focus:border-accent-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">CVC / CVV</label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                    placeholder="123"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white text-center tracking-widest placeholder:text-slate-500 outline-none focus:border-accent-500"
                  />
                </div>
              </div>
            </>
          )}

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-slate-400 flex items-center gap-2">
            <Lock size={14} className="text-emerald-400 shrink-0" />
            <span>Pago seguro cifrado con SSL 256-bit y procesamiento automático mensual.</span>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 py-3 text-xs font-bold text-slate-950 shadow-lg hover:scale-[1.02] disabled:opacity-60 transition-transform"
          >
            {processing ? 'Procesando pago seguro...' : `Pagar $10.00 MXN y Activar ${plan.name}`}
          </button>
        </form>

        {resultModal && (
          <PaymentResultModal
            status={resultModal.status}
            title={resultModal.title}
            message={resultModal.message}
            onClose={() => {
              const isSucc = resultModal.status === 'success'
              setResultModal(null)
              if (isSucc) {
                onClose()
              }
            }}
          />
        )}
      </motion.div>
    </div>
  )
}

export default function PlanUpgradeModal({ isOpen, onClose }: PlanUpgradeModalProps) {
  const { user, refreshUser } = useAuth()
  const [submitting, setSubmitting] = useState<UserPlan | null>(null)
  const [checkoutPlan, setCheckoutPlan] = useState<PlanDefinition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successPlan, setSuccessPlan] = useState<UserPlan | null>(null)

  if (!isOpen) return null

  const currentPlan = user?.plan ?? 'libre'

  // Procesar cambio de plan directo o confirmar tras checkout
  const handleApplyPlan = async (
    planId: UserPlan,
    cardData?: { cardNumber: string; expiry: string; cvv: string; holderName: string },
  ) => {
    setError(null)
    setSubmitting(planId)

    try {
      if (cardData && planId !== 'libre') {
        await upgradePlanCheckout({ plan: planId, ...cardData })
      } else {
        await updateUserPlan(planId)
      }
      await refreshUser()
      setSuccessPlan(planId)
      setCheckoutPlan(null)
      setTimeout(() => {
        setSuccessPlan(null)
        onClose()
      }, 1800)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el plan.')
    } finally {
      setSubmitting(null)
    }
  }

  const handlePlanButtonClick = (plan: PlanDefinition) => {
    if (plan.id === currentPlan) return

    // Si selecciona cambiar a Plan Libre ($0), el cambio es gratis e instantáneo
    if (plan.id === 'libre') {
      void handleApplyPlan('libre')
    } else {
      // Para planes de pago (Plus o Pro), abrir modal de Checkout con Tarjeta
      setCheckoutPlan(plan)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-md overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Planes y Paquetes Gemini AI"
      >
        <motion.div
          className="relative w-full max-w-5xl rounded-3xl border border-white/15 bg-ink-900 p-6 shadow-2xl sm:p-8 my-8 candidate-scroll max-h-[90vh] overflow-y-auto"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>

          {/* Encabezado */}
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-4 py-1.5 text-xs font-semibold text-accent-400">
              <Sparkles size={14} />
              Paquetes & Licencias Gemini AI
            </span>
            <h2 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">
              Potencia tu perfil y tus vacantes con Inteligencia Artificial
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Para aprovechar el motor de <strong className="text-white">Gemini AI</strong>, elige el plan que se adapte a tus necesidades de postulación o contratación.
            </p>
          </div>

          {error && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {successPlan && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-400"
            >
              <CheckCircle2 size={18} />
              ¡Plan actualizado con éxito a {successPlan.toUpperCase()}!
            </motion.div>
          )}

          {/* Grid de los 3 Planes */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3 items-stretch">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id
              const isSubmittingThis = submitting === plan.id

              let buttonLabel = `Seleccionar ${plan.name}`
              if (isCurrent) {
                buttonLabel = 'Tu Plan Actual'
              } else if (isSubmittingThis) {
                buttonLabel = 'Actualizando...'
              } else if (plan.id === 'libre') {
                buttonLabel = 'Cambiar a Plan Libre (Gratis)'
              } else if (plan.id === 'plus') {
                buttonLabel = currentPlan === 'pro' ? 'Cambiar a Plan Plus ($299/mes)' : 'Obtener Plan Plus ($299/mes)'
              } else if (plan.id === 'pro') {
                buttonLabel = 'Obtener Plan Pro ($599/mes)'
              }

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-3xl border p-6 backdrop-blur-sm transition-all hover:border-white/20 ${plan.color}`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                      <span className="text-xs text-slate-400">{plan.period}</span>
                    </div>

                    <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
                      {plan.features.map((feat, idx) => {
                        const Icon = feat.icon
                        return (
                          <div key={idx} className="flex items-start gap-2.5 text-xs">
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

                  <div className="mt-8 pt-4">
                    <button
                      type="button"
                      disabled={isCurrent || submitting !== null}
                      onClick={() => handlePlanButtonClick(plan)}
                      className={`w-full rounded-full py-3 text-xs font-bold transition-all disabled:opacity-60 ${
                        isCurrent
                          ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                          : plan.buttonClass
                      }`}
                    >
                      {buttonLabel}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Modal flotante de checkout si seleccionó un plan de pago (Plus o Pro) */}
          {checkoutPlan && (
            <PaymentCheckoutModal
              plan={checkoutPlan}
              onClose={() => setCheckoutPlan(null)}
              onSuccess={handleApplyPlan}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
