import { COUNTRIES } from '../../data/countries'

interface CountrySelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Selector desplegable con la lista completa de países en español. Se usa
 * en el onboarding y en Ajustes cada vez que se necesita capturar el país
 * de un usuario (freelancer, voluntario o reclutador), en vez de dejarlo
 * como texto libre.
 */
export default function CountrySelect({ id, value, onChange, className }: CountrySelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent-500/60'
      }
    >
      <option value="" className="bg-ink-900 text-slate-500">
        Selecciona un país
      </option>
      {COUNTRIES.map((country) => (
        <option key={country} value={country} className="bg-ink-900">
          {country}
        </option>
      ))}
    </select>
  )
}
