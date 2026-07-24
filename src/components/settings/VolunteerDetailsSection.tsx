import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ApiError, updateRoleDetails } from '../../lib/api'
import PlatformsSection from './PlatformsSection'
import CountrySelect from '../common/CountrySelect'
import { COUNTRIES } from '../../data/countries'

/** "Ciudad, País" -> { city: "Ciudad", country: "País" } (si el país existe en la lista). */
function splitLocation(location: string | null): { city: string; country: string } {
  if (!location) return { city: '', country: '' }
  const parts = location.split(',').map((p) => p.trim())
  const maybeCountry = parts[parts.length - 1]
  if (parts.length > 1 && COUNTRIES.includes(maybeCountry)) {
    return { city: parts.slice(0, -1).join(', '), country: maybeCountry }
  }
  return { city: location, country: '' }
}

export default function VolunteerDetailsSection() {
  const { user, refreshUser } = useAuth()
  const initialLocation = splitLocation(user?.location ?? null)

  const [profession, setProfession] = useState(user?.profession ?? '')
  const [city, setCity] = useState(initialLocation.city)
  const [country, setCountry] = useState(initialLocation.country)
  const [interests, setInterests] = useState(user?.interests ?? '')
  const [availability, setAvailability] = useState(user?.availability ?? '')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSaving(true)
    try {
      const location = city.trim() && country ? `${city.trim()}, ${country}` : city.trim() || null
      await updateRoleDetails({
        profession: profession.trim() || null,
        location,
        interests: interests.trim() || null,
        availability: availability.trim() || null,
      })
      await refreshUser()
      setMessage('Información actualizada.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar tu información.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-base font-semibold text-white">Sobre ti</h2>
        <p className="mt-1 text-sm text-slate-400">
          Esto ayuda a las organizaciones a encontrarte para oportunidades de voluntariado que se
          ajusten a tu perfil y disponibilidad.
        </p>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </motion.div>
        )}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          >
            <Check size={16} className="shrink-0" />
            {message}
          </motion.div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profession" className="mb-1.5 block text-sm font-medium text-slate-300">
              A qué te dedicas
            </label>
            <input
              id="profession"
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="Ej. Estudiante de medicina, Docente..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Ubicación</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ciudad"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
              />
              <CountrySelect id="country" value={country} onChange={setCountry} />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="interests" className="mb-1.5 block text-sm font-medium text-slate-300">
            Qué te gusta hacer
          </label>
          <textarea
            id="interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Cuéntanos qué tipo de causas o actividades te interesan"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="availability" className="mb-1.5 block text-sm font-medium text-slate-300">
            Tu disponibilidad
          </label>
          <input
            id="availability"
            type="text"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="Ej. 10 horas/semana, fines de semana..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      <PlatformsSection />
    </div>
  )
}
