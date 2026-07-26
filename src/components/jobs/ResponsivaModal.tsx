import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Building2, CreditCard, FileSignature, ShieldCheck, X } from 'lucide-react'
import {
  ApiError,
  getFreelancerDestinationAccount,
  hireFreelancer,
  type HiringAgreement,
  type PayoutDestination,
} from '../../lib/api'
import PaymentCheckoutModal from './PaymentCheckoutModal'

interface ResponsivaModalProps {
  freelancerId: string
  freelancerName: string
  postingId?: string
  postingTitle?: string
  onClose: () => void
  onSuccess: () => void
}

/**
 * Ventana emergente obligatoria antes de confirmar la contratación de un
 * freelancer. El reclutador debe leer y aceptar explícitamente (checkbox +
 * botón) una responsiva en la que se compromete a pagar en tiempo y forma.
 * Muestra el destino bancario del freelancer y permite continuar al Checkout de Pago.
 */
export default function ResponsivaModal({
  freelancerId,
  freelancerName,
  postingId,
  postingTitle,
  onClose,
  onSuccess,
}: ResponsivaModalProps) {
  const [agreedAmount, setAgreedAmount] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [destination, setDestination] = useState<PayoutDestination | null>(null)
  const [loadingDest, setLoadingDest] = useState(true)
  const [destError, setDestError] = useState<string | null>(null)

  // Estado para flujo de checkout
  const [activeAgreement, setActiveAgreement] = useState<HiringAgreement | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoadingDest(true)
    getFreelancerDestinationAccount(freelancerId)
      .then((res) => {
        if (isMounted) setDestination(res.destination)
      })
      .catch(() => {
        setDestError('No se pudo cargar la cuenta destino del freelancer')
      })
      .finally(() => {
        if (isMounted) setLoadingDest(false)
      })
    return () => {
      isMounted = false
    }
  }, [freelancerId])

  const amount = Number(agreedAmount)
  const agreementText = `El reclutador se compromete a pagar $${amount.toFixed(2)} MXN a ${freelancerName} en tiempo y forma por los servicios ${
    postingTitle ? `de la oferta "${postingTitle}"` : 'acordados'
  }, conforme a los términos pactados directamente con el freelancer.`

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Ingresa un monto acordado válido.')
      return
    }
    if (!accepted) {
      setError('Debes aceptar la responsiva de pago para continuar.')
      return
    }

    setSubmitting(true)
    try {
      const res = await hireFreelancer({ freelancerId, postingId, agreedAmount: amount, agreementText })
      setActiveAgreement(res.agreement)
      setShowCheckout(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la contratación.')
    } finally {
      setSubmitting(false)
    }
  }

  if (showCheckout && activeAgreement) {
    return (
      <PaymentCheckoutModal
        agreementId={activeAgreement.id}
        freelancerName={freelancerName}
        agreedAmount={activeAgreement.agreedAmount}
        postingTitle={postingTitle}
        destinationAccount={destination}
        onClose={onClose}
        onSuccess={() => {
          setShowCheckout(false)
          onSuccess()
        }}
      />
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Responsiva de pago"
      >
        <motion.div
          className="candidate-scroll relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-2xl sm:p-8"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 text-amber-400">
            <FileSignature size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Responsiva de pago requerida</span>
          </div>

          <h2 className="mt-3 text-xl font-bold text-white">Contratar a {freelancerName}</h2>
          <p className="mt-1 text-sm text-slate-400">
            Antes de confirmar, debes comprometerte a pagar en tiempo y forma por los servicios
            solicitados.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              <label htmlFor="agreedAmount" className="mb-1.5 block text-sm font-medium text-slate-300">
                Monto acordado (total, en MXN $)
              </label>
              <input
                id="agreedAmount"
                type="number"
                min={0}
                step="0.01"
                required
                value={agreedAmount}
                onChange={(e) => setAgreedAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
              />
            </div>

            {/* Visualización de la cuenta destino bancaria del freelancer */}
            <div className="rounded-xl border border-violet-500/30 bg-violet-950/40 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-violet-300">
                <Building2 size={15} />
                <span>Cuenta bancaria de destino (Depósito directo)</span>
              </div>
              {destError && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{destError}</span>
                </div>
              )}
              {loadingDest ? (
                <p className="mt-1 text-slate-400">Cargando cuenta bancaria registrada...</p>
              ) : !destError && destination ? (
                <p className="mt-1 break-words text-slate-200">
                  <span className="font-bold text-white">{destination.bankName}</span> — Titular:{' '}
                  {destination.holderName} (CLABE ****{destination.accountLast4})
                </p>
              ) : !destError ? (
                <p className="mt-1 text-amber-300">
                  El freelancer aún no ha vinculado una cuenta bancaria. Los fondos se mantendrán en custodia hasta que configure su cuenta en Ajustes.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
                <ShieldCheck size={13} />
                Responsiva
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{agreementText}</p>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-accent-500 focus:ring-accent-500"
              />
              He leído y acepto comprometerme a pagar en tiempo y forma los servicios solicitados
              a este freelancer.
            </label>

            <button
              type="submit"
              disabled={submitting || !accepted}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CreditCard size={15} />
              {submitting ? 'Firmando responsiva...' : 'Aceptar responsiva e Ir al Pago'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
