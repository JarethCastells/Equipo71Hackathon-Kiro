import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, MapPin, Star, Check, X, Eye, Clock } from 'lucide-react'
import type { Candidate } from '../types'

interface CandidateCardProps {
  candidate: Candidate
  onShortlist: (id: string) => void
  onDismiss: (id: string) => void
  onView: (candidate: Candidate) => void
}

// forwardRef es necesario porque AnimatePresence (mode="popLayout") en
// CandidateFeed adjunta una ref directamente a este componente para medir
// su layout durante la animación de salida. Sin forwardRef, React no puede
// entregar esa ref y lanza el warning "Function components cannot be given
// refs".
const CandidateCard = forwardRef<HTMLElement, CandidateCardProps>(function CandidateCard(
  { candidate, onShortlist, onDismiss, onView },
  ref,
) {
  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, scale: 0.95, transition: { duration: 0.25 } }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-accent-500/40 hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${candidate.color} text-sm font-bold text-white`}
            aria-hidden
          >
            {candidate.initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold text-white">{candidate.name}</h3>
              {candidate.verified && (
                <BadgeCheck
                  size={15}
                  className="shrink-0 text-accent-400"
                  aria-label="Perfil verificado"
                />
              )}
            </div>
            <p className="truncate text-sm text-slate-400">{candidate.role}</p>
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
          {candidate.matchScore}% match
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {candidate.skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300"
          >
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Star size={13} className="fill-amber-400 text-amber-400" />
          {candidate.rating} ({candidate.reviews})
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={13} />
          {candidate.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={13} />
          {candidate.availability}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
        <span className="text-lg font-bold text-white">
          {candidate.hourlyRate === 0 ? (
            <span className="text-emerald-400">Voluntariado</span>
          ) : (
            <>
              ${candidate.hourlyRate}
              <span className="text-xs font-normal text-slate-400">/hora</span>
            </>
          )}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDismiss(candidate.id)}
            aria-label={`Descartar a ${candidate.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-400 transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <X size={16} />
          </button>
          <button
            type="button"
            onClick={() => onView(candidate)}
            aria-label={`Ver perfil de ${candidate.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-400 transition-colors hover:border-accent-500/50 hover:bg-accent-500/10 hover:text-accent-400"
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={() => onShortlist(candidate.id)}
            aria-label={`Preseleccionar a ${candidate.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-white transition-transform hover:scale-110"
          >
            <Check size={16} />
          </button>
        </div>
      </div>
    </motion.article>
  )
})

export default CandidateCard
