import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Briefcase,
  Check,
  Clock,
  FileText,
  Gift,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import ResponsivaModal from '../components/jobs/ResponsivaModal'
import CvViewerModal from '../components/common/CvViewerModal'
import PlanUpgradeModal from '../components/dashboard/PlanUpgradeModal'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function formatPostingDate(createdAt: string, updatedAt?: string | null): string {
  const targetDate = updatedAt ? new Date(updatedAt) : new Date(createdAt)
  const formatted = targetDate.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return updatedAt ? `Editado el ${formatted}` : `Publicado el ${formatted}`
}


function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function ApplicantAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={`${API_URL}${avatarUrl}`}
        alt={`Foto de perfil de ${name}`}
        className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover"
      />
    )
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-xs font-bold text-white">
      {getInitials(name)}
    </span>
  )
}
import {
  ApiError,
  applyToJobPosting,
  createJobPosting,
  deleteJobPosting,
  listJobPostings,
  listMyApplications,
  listRankedApplicants,
  askAI,
  updateApplicationStatus,
  updateJobPosting,
} from '../lib/api'
import type { AccountRole, JobApplicationWithPosting, JobPosting, RankedApplicant, RankingResponse } from '../lib/api'


const ROLE_LABEL: Record<AccountRole, string> = {
  freelancer: 'Freelancers',
  voluntario: 'Voluntarios',
  reclutador: 'Reclutadores',
}

function CreatePostingForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budgetPerHour, setBudgetPerHour] = useState('')
  const [roleTarget, setRoleTarget] = useState<AccountRole>('freelancer')
  const [skills, setSkills] = useState('')
  const [perks, setPerks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (roleTarget === 'freelancer') {
      const num = Number(budgetPerHour)
      if (isNaN(num) || num <= 0) {
        setError('El sueldo/presupuesto no puede ser $0 para un freelancer. Debe ser mayor a $0.')
        return
      }
      if (budgetPerHour.trim().length > 4 || num > 9999) {
        setError('El sueldo está limitado a un máximo de 4 caracteres (máximo $9,999/hora).')
        return
      }
    }

    setSaving(true)
    try {
      await createJobPosting({
        title: title.trim(),
        description: description.trim(),
        budgetPerHour: roleTarget === 'voluntario' ? 0 : Number(budgetPerHour || 0),
        roleTarget,
        skills: skills.trim() || undefined,
        perks: perks.trim() || undefined,
      })
      setTitle('')
      setDescription('')
      setBudgetPerHour('')
      setSkills('')
      setPerks('')
      setOpen(false)
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar la oferta.')
    } finally {
      setSaving(false)
    }
  }


  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-4 text-sm font-medium text-slate-300 transition-colors hover:border-accent-500/40 hover:text-white"
      >
        <Plus size={16} />
        Publicar nueva oferta
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Publicar oferta</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

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

      <div className="mt-4 space-y-3">
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título de la oferta"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
        />
        <textarea
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe el proyecto o la vacante"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            value={roleTarget}
            onChange={(e) => setRoleTarget(e.target.value as AccountRole)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent-500/60"
          >
            <option value="freelancer" className="bg-ink-900">Busco freelancer</option>
            <option value="voluntario" className="bg-ink-900">Busco voluntario/a</option>
          </select>
          {roleTarget !== 'voluntario' && (
            <input
              type="text"
              maxLength={4}
              value={budgetPerHour}
              onChange={(e) => setBudgetPerHour(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="Presupuesto $/hora (máx 4 dígitos)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
            />
          )}

        </div>

        <input
          type="text"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Habilidades relevantes (opcional)"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
        />

        {roleTarget === 'voluntario' && (
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-300">
              <Gift size={13} />
              Incentivos (para hacer atractiva la vacante)
            </label>
            <input
              type="text"
              value={perks}
              onChange={(e) => setPerks(e.target.value)}
              placeholder="Ej. Comida incluida, pasajes, hospedaje..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-5 flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Publicando...' : 'Publicar oferta'}
      </button>
    </form>
  )
}

function ApplicantsPanel({
  posting,
  onClose,
  onSelectCvUser,
}: {
  posting: JobPosting
  onClose: () => void
  onSelectCvUser: (user: any) => void
}) {
  const [ranking, setRanking] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [hiringTarget, setHiringTarget] = useState<RankedApplicant | null>(null)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await listRankedApplicants(posting.id)
      setRanking(res)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posting.id])

  const handleDecision = async (applicationId: string, status: 'accepted' | 'rejected') => {
    await updateApplicationStatus(applicationId, status)
    await load()
  }

  const handleAskAI = async () => {
    if (!aiQuestion.trim() || aiLoading) return
    setAiLoading(true)
    setAiAnswer(null)
    try {
      const res = await askAI(posting.id, aiQuestion.trim())
      setAiAnswer(res.answer)
    } catch {
      setAiAnswer('No se pudo obtener respuesta. Intenta de nuevo.')
    } finally {
      setAiLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score > 80) return 'bg-emerald-400/15 text-emerald-400'
    if (score >= 50) return 'bg-amber-400/15 text-amber-400'
    return 'bg-rose-400/15 text-rose-400'
  }

  const getScoreDot = (score: number) => {
    if (score > 80) return 'bg-emerald-400'
    if (score >= 50) return 'bg-amber-400'
    return 'bg-rose-400'
  }

  // Encontrar el nombre del recomendado
  const recommendedApp = ranking?.recommendation
    ? ranking.applicants.find((a) => a.applicantId === ranking.recommendation!.applicantId)
    : null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-md overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Postulantes e IA Match"
      >
        <motion.div
          className="relative w-full max-w-3xl rounded-3xl border border-white/15 bg-ink-900 p-6 shadow-2xl sm:p-8 candidate-scroll max-h-[90vh] overflow-y-auto"
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 text-accent-400">
                <Sparkles size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Scoring & Ranking IA</span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-white">Postulantes: {posting.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Loading con skeleton shimmer */}
          {loading && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-accent-500/20 bg-accent-500/5 px-4 py-3">
                <Sparkles size={16} className="animate-pulse text-accent-400" />
                <p className="text-sm text-accent-300">La IA está analizando los perfiles...</p>
              </div>

              {/* Skeleton de tarjetas de candidatos */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 overflow-hidden relative">
                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-32 rounded-full bg-white/10" />
                        <div className="h-4 w-16 rounded-full bg-white/10" />
                      </div>
                      <div className="h-3 w-48 rounded-full bg-white/5" />
                      <div className="flex gap-1.5">
                        <div className="h-5 w-20 rounded-full bg-white/5" />
                        <div className="h-5 w-24 rounded-full bg-white/5" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && ranking && (
            <div className="mt-6 space-y-4">
              {/* Resumen ejecutivo */}
              {ranking.summary && (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <Sparkles size={14} className="shrink-0 text-accent-400" />
                  <p className="text-sm text-slate-300">{ranking.summary}</p>
                </div>
              )}

              {/* Lista de postulantes */}
              {ranking.applicants.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-slate-500">
                  Aún no hay postulaciones para esta oferta.
                </p>
              )}

              {ranking.applicants.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-300">Candidatos ({ranking.applicants.length})</p>
                  {ranking.applicants.map((app) => (
                    <div key={app.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ApplicantAvatar name={app.applicantName} avatarUrl={app.applicantAvatarUrl} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">{app.applicantName}</p>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${getScoreColor(app.matchScore)}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${getScoreDot(app.matchScore)}`} />
                                {app.matchScore}%
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              {ROLE_LABEL[app.applicantRole]}
                              {app.message ? ` · "${app.message}"` : ''}
                            </p>
                            {app.matchReason && (
                              <p className="mt-0.5 text-[11px] text-slate-500">{app.matchReason}</p>
                            )}
                            {app.strengthTags.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {app.strengthTags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <span
                              className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                app.status === 'accepted'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : app.status === 'rejected'
                                    ? 'bg-rose-500/15 text-rose-400'
                                    : 'bg-white/10 text-slate-400'
                              }`}
                            >
                              {app.status === 'accepted' ? 'Aceptado' : app.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                onSelectCvUser({
                                  name: app.applicantName,
                                  email: app.applicantEmail,
                                  role: app.applicantRole,
                                  avatarUrl: app.applicantAvatarUrl,
                                  cvUrl: `================================================\nCURRÍCULUM DE CANDIDATO: ${app.applicantName.toUpperCase()}\nEmail: ${app.applicantEmail} | Rol: ${app.applicantRole.toUpperCase()}\n================================================\n\nMENSAJE DE POSTULACIÓN:\n"${app.message || 'Sin mensaje adicional.'}"\n\nANÁLISIS DE COMPATIBILIDAD IA (${app.matchScore}%):\n${app.matchReason || 'Candidato analizado mediante Gemini IA.'}\n\nCOMPETENCIAS DESTACADAS:\n${app.strengthTags.map((t) => `- ${t}`).join('\n')}`,
                                })
                              }
                              className="mt-2 flex items-center gap-1.5 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1 text-[11px] font-bold text-accent-300 hover:bg-accent-500/20"
                            >
                              <FileText size={13} />
                              Abrir CV Completo
                            </button>
                          </div>
                        </div>

                        {app.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDecision(app.id, 'rejected')}
                              aria-label="Rechazar"
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
                            >
                              <UserX size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                app.applicantRole === 'freelancer' ? setHiringTarget(app) : handleDecision(app.id, 'accepted')
                              }
                              aria-label="Aceptar"
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-white hover:scale-110"
                            >
                              <UserCheck size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bloque IA recomienda */}
              {recommendedApp && ranking.recommendation && (
                <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    <p className="text-sm font-semibold text-white">Candidato recomendado por la IA</p>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <ApplicantAvatar name={recommendedApp.applicantName} avatarUrl={recommendedApp.applicantAvatarUrl} />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {recommendedApp.applicantName}
                        <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${getScoreColor(recommendedApp.matchScore)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${getScoreDot(recommendedApp.matchScore)}`} />
                          {recommendedApp.matchScore}% match
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{ranking.recommendation.reason}</p>
                    </div>
                  </div>
                  {recommendedApp.strengthTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {recommendedApp.strengthTags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sugerencia para mejorar oferta */}
              {ranking.suggestion && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <span className="mt-0.5 text-sm">💡</span>
                  <p className="text-sm text-amber-200">{ranking.suggestion}</p>
                </div>
              )}

              {/* Mini-chat con IA (al final) */}
              {ranking.applicants.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <span className="text-base">💬</span>
                    Pregúntale a la IA sobre los candidatos
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                      placeholder="Ej: ¿Quién tiene más experiencia en React?"
                      className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
                    />
                    <button
                      type="button"
                      onClick={handleAskAI}
                      disabled={aiLoading || !aiQuestion.trim()}
                      className="shrink-0 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
                    >
                      {aiLoading ? '...' : 'Preguntar'}
                    </button>
                  </div>
                  {aiLoading && (
                    <div className="mt-3 flex items-center gap-2">
                      <Sparkles size={13} className="animate-pulse text-accent-400" />
                      <p className="text-xs text-slate-400">La IA está pensando...</p>
                    </div>
                  )}
                  {aiAnswer && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm text-slate-300 whitespace-pre-wrap"
                    >
                      {aiAnswer}
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          )}

          {hiringTarget && (
            <ResponsivaModal
              freelancerId={hiringTarget.applicantId}
              freelancerName={hiringTarget.applicantName}
              postingId={posting.id}
              postingTitle={posting.title}
              onClose={() => setHiringTarget(null)}
              onSuccess={async () => {
                await handleDecision(hiringTarget.id, 'accepted')
                setHiringTarget(null)
              }}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function EditPostingModal({
  posting,
  onClose,
  onUpdated,
}: {
  posting: JobPosting
  onClose: () => void
  onUpdated: () => void
}) {
  const [title, setTitle] = useState(posting.title)
  const [description, setDescription] = useState(posting.description)
  const [budgetPerHour, setBudgetPerHour] = useState(posting.budgetPerHour > 0 ? String(posting.budgetPerHour) : '')
  const [roleTarget, setRoleTarget] = useState<AccountRole>(posting.roleTarget)
  const [skills, setSkills] = useState(posting.skills ?? '')
  const [perks, setPerks] = useState(posting.perks ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (roleTarget === 'freelancer') {
      const num = Number(budgetPerHour)
      if (isNaN(num) || num <= 0) {
        setError('El sueldo/presupuesto no puede ser $0 para un freelancer. Debe ser mayor a $0.')
        return
      }
      if (budgetPerHour.trim().length > 4 || num > 9999) {
        setError('El sueldo está limitado a un máximo de 4 caracteres (máximo $9,999/hora).')
        return
      }
    }

    setSaving(true)

    try {
      await updateJobPosting(posting.id, {
        title: title.trim(),
        description: description.trim(),
        budgetPerHour: roleTarget === 'voluntario' ? 0 : Number(budgetPerHour || 0),
        roleTarget,
        skills: skills.trim() || undefined,
        perks: perks.trim() || undefined,
      })
      onUpdated()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la oferta.')
    } finally {
      setSaving(false)
    }
  }


  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl sm:p-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white">Editar oferta de proyecto</h2>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Título de la oferta</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Descripción</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Rol buscado</label>
                <select
                  value={roleTarget}
                  onChange={(e) => setRoleTarget(e.target.value as AccountRole)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white outline-none focus:border-accent-500"
                >
                  <option value="freelancer" className="bg-ink-900">Freelancer</option>
                  <option value="voluntario" className="bg-ink-900">Voluntario/a</option>
                </select>
              </div>

              {roleTarget !== 'voluntario' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Presupuesto $/hora (máx 4 dígitos)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={budgetPerHour}
                    onChange={(e) => setBudgetPerHour(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="Ej: 250"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none focus:border-accent-500"
                  />
                </div>
              )}

            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Habilidades requeridas</label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Ej: React, Node.js, Design..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none focus:border-accent-500"
              />
            </div>

            {roleTarget === 'voluntario' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Incentivos / Beneficios</label>
                <input
                  type="text"
                  value={perks}
                  onChange={(e) => setPerks(e.target.value)}
                  placeholder="Ej: Hospedaje, certificado..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none focus:border-accent-500"
                />
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function DeleteConfirmModal({
  postingTitle,
  onClose,
  onConfirm,
}: {
  postingTitle: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = async () => {
    setDeleting(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-sm rounded-3xl border border-rose-500/30 bg-slate-900 p-6 text-center shadow-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
            <Trash2 size={24} />
          </div>
          <h3 className="mt-3 text-base font-bold text-white">¿Eliminar oferta?</h3>
          <p className="mt-1.5 text-xs text-slate-400">
            ¿Estás seguro de que deseas eliminar "<strong className="text-white">{postingTitle}</strong>"? Esta acción no se puede deshacer.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirm}
              className="rounded-full bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-lg hover:bg-rose-500 disabled:opacity-60"
            >
              {deleting ? 'Eliminando...' : 'Sí, Eliminar'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}


export default function JobBoardPage() {
  const { user } = useAuth()
  const [allPostings, setAllPostings] = useState<JobPosting[]>([])
  const [myApplications, setMyApplications] = useState<JobApplicationWithPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingApplicantsFor, setViewingApplicantsFor] = useState<JobPosting | null>(null)
  const [editingPosting, setEditingPosting] = useState<JobPosting | null>(null)
  const [deletingPosting, setDeletingPosting] = useState<JobPosting | null>(null)
  const [applyMessage, setApplyMessage] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | 'position' | 'company' | 'person' | 'services'>('all')
  const [selectedCvUser, setSelectedCvUser] = useState<any | null>(null)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)

  const isRecruiter = user?.role === 'reclutador'

  const load = async () => {
    setLoading(true)
    try {
      const [postingsRes, applicationsRes] = await Promise.all([
        listJobPostings(),
        isRecruiter ? Promise.resolve({ applications: [] }) : listMyApplications(),
      ])
      setAllPostings(postingsRes.postings)
      setMyApplications(applicationsRes.applications)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const postings = useMemo(() => {
    let list = isRecruiter ? allPostings.filter((p) => p.createdBy === user?.id) : allPostings

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.skills && p.skills.toLowerCase().includes(q)) ||
          p.createdBy.toLowerCase().includes(q)
      )
    }
    return list
  }, [allPostings, isRecruiter, user?.id, searchQuery])

  const appliedPostingIds = useMemo(() => new Set(myApplications.map((a) => a.postingId)), [myApplications])

  const handleApply = async (posting: JobPosting) => {
    setFeedback(null)
    try {
      await applyToJobPosting(posting.id, applyMessage[posting.id]?.trim() || undefined)
      setFeedback(`Te postulaste a "${posting.title}".`)
      await load()
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'No se pudo enviar tu postulación.')
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {isRecruiter ? 'Mis ofertas publicadas' : 'Ofertas de proyecto'}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {isRecruiter
                ? 'Administra tus ofertas y revisa quién se postula. No puedes postularte a ofertas: esa opción es solo para freelancers y voluntarios.'
                : 'Postúlate a ofertas que se ajusten a tu perfil. Los voluntarios pueden postularse como personal adicional para ganar experiencia.'}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-accent-400">
            <Sparkles size={13} />
            {postings.length} {isRecruiter ? 'ofertas tuyas' : 'ofertas activas'}
          </span>
        </div>

        {/* Barra de Búsqueda con Filtros por Puesto, Empresa y Persona */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Puesto disponible, Empresa, Persona o habilidades..."
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
            />
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`rounded-xl px-3 py-2 font-semibold transition-all ${
                filterCategory === 'all'
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('position')}
              className={`rounded-xl px-3 py-2 font-semibold transition-all ${
                filterCategory === 'position'
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              💼 Puesto Disponible
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('company')}
              className={`rounded-xl px-3 py-2 font-semibold transition-all ${
                filterCategory === 'company'
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              🏢 Por Empresa
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('services')}
              className={`rounded-xl px-3 py-2 font-semibold transition-all ${
                filterCategory === 'services'
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              🛠️ Por Servicios
            </button>
          </div>
        </div>

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-accent-500/30 bg-accent-500/10 px-4 py-3 text-sm text-accent-300"
          >
            <Check size={16} className="shrink-0" />
            {feedback}
          </motion.div>
        )}

        <div className="mt-6 space-y-4">
          {user?.role === 'reclutador' && <CreatePostingForm onCreated={load} />}

          {viewingApplicantsFor && (
            <ApplicantsPanel
              posting={viewingApplicantsFor}
              onClose={() => setViewingApplicantsFor(null)}
              onSelectCvUser={(u) => setSelectedCvUser(u)}
            />
          )}

          {editingPosting && (
            <EditPostingModal
              posting={editingPosting}
              onClose={() => setEditingPosting(null)}
              onUpdated={load}
            />
          )}

          {deletingPosting && (
            <DeleteConfirmModal
              postingTitle={deletingPosting.title}
              onClose={() => setDeletingPosting(null)}
              onConfirm={async () => {
                await deleteJobPosting(deletingPosting.id)
                await load()
              }}
            />
          )}

          {loading && <p className="text-sm text-slate-500">Cargando ofertas...</p>}

          <AnimatePresence>
            {postings.map((posting) => {
              const isOwner = posting.createdBy === user?.id
              const alreadyApplied = appliedPostingIds.has(posting.id)
              return (
                <motion.div
                  key={posting.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5">
                          <Briefcase size={15} className="text-accent-400" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white">{posting.title}</p>
                          <p className="text-xs text-slate-400">
                            Busca {ROLE_LABEL[posting.roleTarget]}
                            {posting.budgetPerHour > 0 ? ` · $${posting.budgetPerHour.toFixed(2)}/hora` : ''}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{posting.description}</p>
                      {posting.skills && (
                        <p className="mt-2 text-xs text-slate-500">Habilidades: {posting.skills}</p>
                      )}
                      {posting.perks && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <Gift size={12} />
                          {posting.perks}
                        </p>
                      )}
                    </div>

                    <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-400">
                      <Clock size={12} className="text-accent-400" />
                      {formatPostingDate(posting.createdAt, posting.updatedAt)}
                    </span>
                  </div>


                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4">
                    {isOwner ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setViewingApplicantsFor(posting)}
                          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                        >
                          <Users size={14} />
                          Ver postulantes
                          <span className="flex items-center gap-1 rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-semibold text-accent-400">
                            <Sparkles size={10} />
                            IA
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPosting(posting)}
                            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white transition-all"
                          >
                            <Pencil size={13} className="text-accent-400" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPosting(posting)}
                            className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3.5 py-1.5 text-xs font-medium text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/20 transition-all"
                          >
                            <Trash2 size={13} />
                            Eliminar
                          </button>
                        </div>
                      </>
                    ) : isRecruiter ? null : alreadyApplied ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-400">
                        <Check size={14} />
                        Ya te postulaste
                      </span>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={applyMessage[posting.id] ?? ''}
                          onChange={(e) => setApplyMessage((prev) => ({ ...prev, [posting.id]: e.target.value }))}
                          placeholder="Mensaje breve (opcional)"
                          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500/60"
                        />
                        <button
                          type="button"
                          onClick={() => handleApply(posting)}
                          className="shrink-0 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                        >
                          Postularme
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {!loading && postings.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <MapPin size={22} className="text-slate-500" />
              <p className="mt-2 text-slate-300">Todavía no hay ofertas publicadas.</p>
            </div>
          )}
        </div>
      </div>

      {selectedCvUser && (
        <CvViewerModal
          isOpen={Boolean(selectedCvUser)}
          onClose={() => setSelectedCvUser(null)}
          userProfile={selectedCvUser}
          onUpgradeProRequest={() => {
            setSelectedCvUser(null)
            setUpgradeModalOpen(true)
          }}
        />
      )}

      <PlanUpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </DashboardLayout>
  )
}

