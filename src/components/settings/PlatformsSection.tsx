import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ExternalLink, Github, Globe, Instagram, Link2, Palette, Trash2 } from 'lucide-react'
import { ApiError, addPlatform, listPlatforms, removePlatform } from '../../lib/api'
import type { UserPlatform } from '../../lib/api'

// Sugerencias rápidas, no un catálogo cerrado: cualquier oficio puede
// escribir el nombre de plataforma que le haga sentido (un chef puede
// poner "Sitio web" o "Instagram de fotos de platillos", por ejemplo).
const SUGGESTIONS = ['GitHub', 'Behance', 'Canva', 'Instagram', 'Sitio web', 'LinkedIn', 'Dribbble', 'YouTube']

const ICONS: Record<string, typeof Github> = {
  github: Github,
  behance: Palette,
  canva: Palette,
  instagram: Instagram,
  'sitio web': Globe,
  website: Globe,
}

function iconFor(name: string) {
  return ICONS[name.trim().toLowerCase()] ?? Link2
}

export default function PlatformsSection() {
  const [platforms, setPlatforms] = useState<UserPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [platformName, setPlatformName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await listPlatforms()
      setPlatforms(res.platforms)
    } catch {
      setError('No se pudieron cargar tus plataformas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await addPlatform(platformName.trim(), url.trim())
      setPlatformName('')
      setUrl('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar la plataforma.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await removePlatform(id)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la plataforma.')
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-base font-semibold text-white">Plataformas y portafolio</h2>
      <p className="mt-1 text-sm text-slate-400">
        Conecta lo que mejor represente tu trabajo: GitHub si programas, Behance o Canva si
        diseñas, tu sitio web y fotos si cocinas... lo que le haga sentido a tu oficio.
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

      <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          required
          list="platform-suggestions"
          value={platformName}
          onChange={(e) => setPlatformName(e.target.value)}
          placeholder="Nombre (ej. GitHub, Sitio web)"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60 sm:w-48"
        />
        <datalist id="platform-suggestions">
          {SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
        />
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 rounded-xl bg-gradient-to-r from-accent-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Agregando...' : 'Conectar'}
        </button>
      </form>

      <div className="mt-5 space-y-2">
        {loading && <p className="text-sm text-slate-500">Cargando plataformas...</p>}

        <AnimatePresence>
          {platforms.map((platform) => {
            const Icon = iconFor(platform.platformName)
            return (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5">
                    <Icon size={15} className="text-accent-400" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{platform.platformName}</p>
                    <a
                      href={platform.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-accent-400"
                    >
                      {platform.url.replace(/^https?:\/\//, '').slice(0, 40)}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(platform.id)}
                  aria-label="Eliminar plataforma"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {!loading && platforms.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-slate-500">
            Aún no has conectado ninguna plataforma.
          </p>
        )}
      </div>
    </div>
  )
}
