import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, Users, HeartHandshake, ListFilter } from 'lucide-react'
import { CANDIDATES } from '../data/candidates'
import type { Candidate, ProfileType } from '../types'
import BudgetSlider from './BudgetSlider'
import CandidateCard from './CandidateCard'
import ProfileModal from './ProfileModal'

type FilterType = 'todos' | ProfileType

const FILTERS: { key: FilterType; label: string; icon: typeof Users }[] = [
  { key: 'todos', label: 'Todos', icon: Sparkles },
  { key: 'freelancer', label: 'Freelancers', icon: Users },
  { key: 'voluntario', label: 'Voluntarios', icon: HeartHandshake },
]

export default function CandidateFeed() {
  const [budget, setBudget] = useState(30)
  const [filter, setFilter] = useState<FilterType>('todos')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set())
  const [activeProfile, setActiveProfile] = useState<Candidate | null>(null)

  const visibleCandidates = useMemo(() => {
    return CANDIDATES.filter((c) => {
      if (dismissed.has(c.id)) return false
      if (filter !== 'todos' && c.type !== filter) return false
      // El voluntariado (tarifa 0) siempre entra dentro de cualquier presupuesto.
      if (c.hourlyRate > budget) return false
      return true
    }).sort((a, b) => b.matchScore - a.matchScore)
  }, [budget, filter, dismissed])

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }

  const handleShortlist = (id: string) => {
    setShortlisted((prev) => new Set(prev).add(id))
  }

  return (
    <section id="candidatos" className="relative bg-ink-950 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-accent-400">
            <Sparkles size={13} />
            Lista inteligente, siempre actualizada
          </span>
          <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
            Candidatos que se ajustan a tu presupuesto
          </h2>
          <p className="mt-4 text-slate-400">
            Ajusta el presupuesto y filtra por tipo de perfil. La IA reordena la lista al instante
            según compatibilidad, disponibilidad y tarifa.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Panel de control lateral */}
          <div className="space-y-5 lg:col-span-4">
            <BudgetSlider value={budget} onChange={setBudget} />

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                <ListFilter size={16} className="text-accent-400" />
                Tipo de perfil
              </div>
              <div className="flex flex-col gap-2">
                {FILTERS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                      filter === key
                        ? 'bg-gradient-to-r from-accent-500/20 to-violet-500/20 text-white border border-accent-500/40'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-accent-500/10 to-violet-500/10 p-5">
              <p className="text-sm font-medium text-white">Preseleccionados</p>
              <p className="mt-1 text-3xl font-bold text-gradient bg-[length:200%_auto]">
                {shortlisted.size}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                perfiles listos para contactar
              </p>
            </div>
          </div>

          {/* Lista automática de candidatos */}
          <div className="lg:col-span-8">
            <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
              <span>
                <strong className="text-white">{visibleCandidates.length}</strong> candidatos
                coinciden con tu búsqueda
              </span>
              <span className="hidden items-center gap-1.5 text-emerald-400 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Actualizado en tiempo real
              </span>
            </div>

            <div className="candidate-scroll grid max-h-[720px] grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {visibleCandidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    onDismiss={handleDismiss}
                    onShortlist={handleShortlist}
                    onView={setActiveProfile}
                  />
                ))}
              </AnimatePresence>
            </div>

            {visibleCandidates.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center"
              >
                <p className="text-slate-300">Ningún perfil coincide con este presupuesto todavía.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Intenta aumentar el presupuesto o cambiar el filtro de tipo de perfil.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <ProfileModal
        candidate={activeProfile}
        onClose={() => setActiveProfile(null)}
        onShortlist={handleShortlist}
      />
    </section>
  )
}
