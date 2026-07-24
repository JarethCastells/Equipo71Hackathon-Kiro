import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import {
  ApiError,
  processPaymentCheckout,
  type PaymentProvider,
  type PaymentRecord,
  type PayoutDestination,
} from '../../lib/api'

interface PaymentCheckoutModalProps {
  agreementId: string
  freelancerName: string
  agreedAmount: number
  postingTitle?: string
  destinationAccount: PayoutDestination | null
  onClose: () => void
  onSuccess: (payment: PaymentRecord) => void
}

export default function PaymentCheckoutModal({
  agreementId,
  freelancerName,
  agreedAmount,
  postingTitle,
  destinationAccount,
  onClose,
  onSuccess,
}: PaymentCheckoutModalProps) {
  const [provider, setProvider] = useState<PaymentProvider>('stripe')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'spei' | 'escrow'>('card')
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242')
  const [cardExpiry, setCardExpiry] = useState('12/28')
  const [cardCvc, setCardCvc] = useState('123')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<PaymentRecord | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await processPaymentCheckout({
        agreementId,
        provider,
        paymentMethod,
      })
      setSuccessData(res.payment)
      setTimeout(() => {
        onSuccess(res.payment)
      }, 1800)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al procesar el pago.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Checkout de Pago Real"
      >
        <motion.div
          className="relative w-full max-w-xl rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl sm:p-8"
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
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

          {successData ? (
            <div className="py-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-8 ring-emerald-500/10"
              >
                <CheckCircle2 size={44} />
              </motion.div>
              <h3 className="mt-5 text-2xl font-bold text-white">¡Pago Procesado Exitosamente!</h3>
              <p className="mt-2 text-sm text-slate-300">
                Se cobraron <span className="font-semibold text-emerald-400">${agreedAmount.toFixed(2)} MXN</span>{' '}
                para {freelancerName}.
              </p>
              {destinationAccount ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300">
                  <Building2 size={14} />
                  Destino: {destinationAccount.bankName} (CLABE ****{destinationAccount.accountLast4})
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-400">
                  El pago quedó respaldado en custodia hasta que el freelancer registre su cuenta bancaria.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-violet-400">
                <Sparkles size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Pasarela de Pago Segura</span>
              </div>

              <h2 className="mt-2 text-2xl font-bold text-white">Completar Pago de Contratación</h2>
              <p className="mt-1 text-sm text-slate-400">
                {postingTitle ? `Proyecto: "${postingTitle}"` : `Servicios de ${freelancerName}`}
              </p>

              {/* Tarjeta con resumen del depósito al freelancer */}
              <div className="mt-5 rounded-2xl border border-violet-500/30 bg-violet-950/30 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">Monto total a pagar</p>
                    <p className="text-2xl font-extrabold text-white">${agreedAmount.toFixed(2)} <span className="text-sm font-semibold text-violet-400">MXN</span></p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Beneficiario</p>
                    <p className="text-sm font-bold text-white">{freelancerName}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Building2 size={14} />
                    {destinationAccount
                      ? `Depósito directo a: ${destinationAccount.bankName} (****${destinationAccount.accountLast4})`
                      : 'Sin cuenta registrada aún (se guardará en custodia de plataforma)'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                  </div>
                )}

                {/* Selección de Proveedor */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Proveedor de Pago (Pasarela)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'stripe', name: 'Stripe', tag: 'Global' },
                      { id: 'mercadopago', name: 'MercadoPago', tag: 'LATAM' },
                      { id: 'conekta', name: 'Conekta / SPEI', tag: 'México' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProvider(p.id as PaymentProvider)}
                        className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
                          provider === p.id
                            ? 'border-violet-500 bg-violet-500/20 text-white shadow-lg shadow-violet-500/10'
                            : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <span className="text-sm font-bold">{p.name}</span>
                        <span className="mt-0.5 text-[10px] text-slate-400">{p.tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Métodos de Pago */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all ${
                        paymentMethod === 'card'
                          ? 'border-accent-500 bg-accent-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <CreditCard size={15} />
                      Tarjeta Débito / Crédito
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('spei')}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all ${
                        paymentMethod === 'spei'
                          ? 'border-accent-500 bg-accent-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <QrCode size={15} />
                      Transferencia SPEI / CLABE
                    </button>
                  </div>
                </div>

                {paymentMethod === 'card' ? (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Número de Tarjeta</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-violet-500"
                        />
                        <CreditCard size={16} className="absolute right-3 top-3 text-slate-400" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Vencimiento</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/AA"
                          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">CVC / CVV</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          placeholder="123"
                          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                    <p className="font-semibold uppercase tracking-wider">Transferencia SPEI Directa</p>
                    <p className="mt-1 text-slate-300">
                      Al confirmar, la pasarela generará la CLABE interbancaria de pago para transferir exactamente{' '}
                      <strong>${agreedAmount.toFixed(2)} MXN</strong>.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Lock size={12} className="text-emerald-400" />
                    Cifrado SSL de 256 bits
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={12} className="text-violet-400" />
                    Protección de Fondos
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-accent-500 to-violet-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-accent-500/20 transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {submitting ? 'Procesando pago con pasarela...' : `Pagar $${agreedAmount.toFixed(2)} MXN`}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
