import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, MapPin, Star, Clock, X, MessageCircle, CheckCircle2 } from 'lucide-react'
import type { Candidate } from '../types'

interface ProfileModalProps {
  candidate: Candidate | null
  onClose: () => void
  onShortlist: (id: string) => void
}

export default function ProfileModal({ candidate, onClose, onShortlist }: ProfileModalProps) {
  return (
    <AnimatePresence>
      {candidate && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Perfil de ${candidate.name}`}
        >
          <motion.div
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-ink-900 p-5 shadow-2xl sm:p-8"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
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

            <div className="flex items-center gap-4 pr-8">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${candidate.color} text-lg font-bold text-white`}
                aria-hidden
              >
                {candidate.initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-xl font-bold text-white">{candidate.name}</h2>
                  {candidate.verified && (
                    <BadgeCheck size={16} className="shrink-0 text-accent-400" />
                  )}
                </div>
                <p className="truncate text-slate-400">{candidate.role}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
              <span className="flex items-center gap-1">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                {candidate.rating} · {candidate.reviews} reseñas
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {candidate.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} /> {candidate.availability}
              </span>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-slate-300">{candidate.bio}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {candidate.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-300"
                >
                  {skill}
                </span>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-white/5 p-4">
              <div>
                <p className="text-xs text-slate-400">Compatibilidad con tu presupuesto</p>
                <p className="text-2xl font-bold text-emerald-400">{candidate.matchScore}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Tarifa</p>
                <p className="text-lg font-bold text-white">
                  {candidate.hourlyRate === 0 ? 'Voluntariado' : `$${candidate.hourlyRate}/h`}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  alert('Inicia sesión para enviar mensajes')
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <MessageCircle size={16} />
                Enviar mensaje
              </button>
              <button
                type="button"
                onClick={() => {
                  onShortlist(candidate.id)
                  onClose()
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                <CheckCircle2 size={16} />
                Preseleccionar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
