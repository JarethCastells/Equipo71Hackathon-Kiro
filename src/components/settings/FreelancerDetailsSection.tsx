import { useRef, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Check, FileText, Upload } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ApiError, updateRoleDetails, uploadCv } from '../../lib/api'
import type { RateType } from '../../lib/api'
import PlatformsSection from './PlatformsSection'
import CountrySelect from '../common/CountrySelect'
import { COUNTRIES } from '../../data/countries'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

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

export default function FreelancerDetailsSection() {
  const { user, refreshUser } = useAuth()
  const cvInputRef = useRef<HTMLInputElement>(null)
  const initialLocation = splitLocation(user?.location ?? null)

  const [profession, setProfession] = useState(user?.profession ?? '')
  const [city, setCity] = useState(initialLocation.city)
  const [country, setCountry] = useState(initialLocation.country)
  const [interests, setInterests] = useState(user?.interests ?? '')
  const [rateType, setRateType] = useState<RateType>(user?.rateType ?? 'hourly')
  const [rateAmount, setRateAmount] = useState(user?.rateAmount?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingCv, setUploadingCv] = useState(false)

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
        rateType,
        rateAmount: rateAmount ? Number(rateAmount) : null,
      })
      await refreshUser()
      setMessage('Información profesional actualizada.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar tu información.')
    } finally {
      setSaving(false)
    }
  }

  const handleCvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploadingCv(true)
    try {
      await uploadCv(file)
      await refreshUser()
      setMessage('CV actualizado correctamente.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el CV.')
    } finally {
      setUploadingCv(false)
      if (cvInputRef.current) cvInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-base font-semibold text-white">Información profesional</h2>
        <p className="mt-1 text-sm text-slate-400">
          Esto ayuda a la IA a mostrarte ofertas relevantes y a los reclutadores a encontrarte.
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
              Profesión / oficio
            </label>
            <input
              id="profession"
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="Ej. Diseñador UX, Chef, Desarrollador..."
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
            placeholder="Cuéntanos sobre tu estilo de trabajo, especialidades, etc."
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
          />
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Tu costo</label>
          <div className="flex gap-2">
            <select
              value={rateType}
              onChange={(e) => setRateType(e.target.value as RateType)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-accent-500/60"
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
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-base font-semibold text-white">Currículum (CV)</h2>
        <p className="mt-1 text-sm text-slate-400">Sube tu CV en PDF o Word, máx. 5MB.</p>

        <div className="mt-4 flex items-center gap-3">
          {user?.cvUrl && (
            <a
              href={`${API_URL}${user.cvUrl}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              <FileText size={14} />
              Ver CV actual
            </a>
          )}
          <button
            type="button"
            onClick={() => cvInputRef.current?.click()}
            disabled={uploadingCv}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-60"
          >
            <Upload size={14} />
            {uploadingCv ? 'Subiendo...' : user?.cvUrl ? 'Reemplazar CV' : 'Subir CV'}
          </button>
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleCvChange}
          />
        </div>
      </div>

      <PlatformsSection />
    </div>
  )
}
