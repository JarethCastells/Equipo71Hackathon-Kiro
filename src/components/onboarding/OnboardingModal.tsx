import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowRight, Briefcase, Heart, MapPin, Sparkles, Wallet } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ApiError, updateRoleDetails } from '../../lib/api'
import type { RateType } from '../../lib/api'
import CountrySelect from '../common/CountrySelect'

/**
 * Modal de bienvenida que se muestra una sola vez (hasta completar el
 * onboarding) tras el primer login. El contenido cambia según el rol:
 * - freelancer: a qué se dedica, de dónde es, qué le gusta hacer, tarifa.
 * - voluntario: a qué se dedica, de dónde es, qué le gusta hacer, disponibilidad.
 * - reclutador: de dónde es y a qué se dedica su organización (más breve).
 */
export default function OnboardingModal() {
  const { user, refreshUser } = useAuth()

  const [profession, setProfession] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [interests, setInterests] = useState('')
  const [rateType, setRateType] = useState<RateType>('hourly')
  const [rateAmount, setRateAmount] = useState('')
  const [availability, setAvailability] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dismissed, _setDismissed] = useState(false)

  const show = Boolean(user) && !user!.onboardingCompleted && !dismissed
  const role = user?.role

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!profession.trim() || !city.trim() || !country) {
      setError('Cuéntanos al menos a qué te dedicas, tu ciudad y tu país.')
      return
    }
    setSaving(true)
    try {
      await updateRoleDetails({
        profession: profession.trim(),
        location: `${city.trim()}, ${country}`,
        interests: interests.trim() || null,
        rateType: role === 'freelancer' ? rateType : null,
        rateAmount: role === 'freelancer' && rateAmount ? Number(rateAmount) : null,
        availability: role === 'voluntario' ? availability.trim() || null : null,
        onboardingCompleted: true,
      })
      await refreshUser()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar tu información.')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    setSaving(true)
    try {
      // "Completar más tarde": no se pierden los ajustes, solo se marca
      // como completado para no volver a mostrar el modal cada login.
      await updateRoleDetails({ onboardingCompleted: true })
      await refreshUser()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo saltar el onboarding. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Completa tu perfil"
        >
          <motion.div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-2xl sm:p-8"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-2 text-accent-400">
              <Sparkles size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Un último paso para personalizar tu experiencia
              </span>
            </div>

            <h2 className="mt-3 text-xl font-bold text-white sm:text-2xl">
              {role === 'reclutador' ? '¡Bienvenido/a! Cuéntanos de tu organización' : '¡Bienvenido/a! Cuéntanos sobre ti'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {role === 'freelancer' &&
                'Con esto la IA te mostrará ofertas más relevantes y ayudará a los reclutadores a encontrarte.'}
              {role === 'voluntario' &&
                'Así podemos conectarte con oportunidades de voluntariado que se ajusten a ti y a tu disponibilidad.'}
              {role === 'reclutador' &&
                'Esto nos ayuda a mostrarte candidatos más relevantes para tus proyectos.'}
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
                <label htmlFor="profession" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-300">
                  <Briefcase size={13} />
                  {role === 'reclutador' ? '¿A qué se dedica tu organización?' : '¿A qué te dedicas?'}
                </label>
                <input
                  id="profession"
                  type="text"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder={role === 'reclutador' ? 'Ej. Agencia de marketing digital' : 'Ej. Diseñador UX, Chef, Desarrollador...'}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60 sm:text-sm"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-300">
                  <MapPin size={13} />
                  ¿De dónde eres?
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ciudad"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60 sm:text-sm"
                  />
                  <CountrySelect id="country" value={country} onChange={setCountry} />
                </div>
              </div>

              <div>
                <label htmlFor="interests" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-300">
                  <Heart size={13} />
                  {role === 'reclutador' ? '¿Qué tipo de proyectos suelen publicar?' : '¿Qué te gusta hacer?'}
                </label>
                <textarea
                  id="interests"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value.slice(0, 300))}
                  rows={2}
                  placeholder="Cuéntanos un poco más..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60 sm:text-sm"
                />
              </div>

              {role === 'freelancer' && (
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-300">
                    <Wallet size={13} />
                    Tu costo
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={rateType}
                      onChange={(e) => setRateType(e.target.value as RateType)}
                      className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-accent-500/60"
                    >
                      <option value="hourly" className="bg-ink-900">Por hora</option>
                      <option value="project" className="bg-ink-900">Por proyecto</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={rateAmount}
                      onChange={(e) => setRateAmount(e.target.value)}
                      placeholder="Monto en $"
                      className="w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60 sm:text-sm"
                    />
                  </div>
                </div>
              )}

              {role === 'voluntario' && (
                <div>
                  <label htmlFor="availability" className="mb-1.5 block text-sm font-medium text-slate-300">
                    Tu disponibilidad
                  </label>
                  <input
                    id="availability"
                    type="text"
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    placeholder="Ej. 10 horas/semana, fines de semana..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60 sm:text-sm"
                  />
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar y continuar'}
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={saving}
                  className="rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-slate-400 transition-colors hover:text-white disabled:opacity-60"
                >
                  Completar más tarde
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
