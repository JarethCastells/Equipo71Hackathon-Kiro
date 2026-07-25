import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Briefcase,
  Clock,
  FileSignature,
  HeartHandshake,
  Landmark,
  Link2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Wallet,
} from 'lucide-react'

import DashboardLayout from '../components/dashboard/DashboardLayout'
import OnboardingModal from '../components/onboarding/OnboardingModal'
import { useAuth } from '../context/AuthContext'
import {
  listBankAccounts,
  listJobPostings,
  listMyApplications,
  listMyHiringAgreements,
  listMyPayments,
  listPlatforms,
} from '../lib/api'
import type {
  HiringAgreementWithDetails,
  JobApplicationWithPosting,
  JobPosting,
  PaymentRecord,
  UserPlatform,
} from '../lib/api'


function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  delay,
}: {
  label: string
  value: string | number
  icon: typeof Briefcase
  accent: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon size={16} className={accent} />
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </motion.div>
  )
}

const APP_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-white/10 text-slate-400' },
  accepted: { label: 'Aceptado', className: 'bg-emerald-500/15 text-emerald-400' },
  rejected: { label: 'Rechazado', className: 'bg-rose-500/15 text-rose-400' },
}

// --- Vista de RECLUTADOR: sus propias ofertas publicadas + contrataciones firmadas ---
function RecruiterDashboard() {
  const { user } = useAuth()
  const [postings, setPostings] = useState<JobPosting[]>([])
  const [agreements, setAgreements] = useState<HiringAgreementWithDetails[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listJobPostings(), listMyHiringAgreements(), listMyPayments()])
      .then(([postingsRes, agreementsRes, paymentsRes]) => {
        if (cancelled) return
        setPostings(postingsRes.postings.filter((p) => p.createdBy === user?.id))
        setAgreements(agreementsRes.agreements)
        setPayments(paymentsRes.payments)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los datos del dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.id])

  const totalCommitted = agreements.reduce((sum, a) => sum + a.agreedAmount, 0)
  const totalPaid = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="mx-auto max-w-6xl">
      <Header
        greeting={`Hola, ${user?.name?.split(' ')[0] ?? ''} 👋`}
        subtitle="Este es el resumen de tus ofertas, contrataciones y pagos realizados."
        badge="Pasarela de pagos real activa"
      />

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setLoading(true)
              Promise.all([listJobPostings(), listMyHiringAgreements(), listMyPayments()])
                .then(([postingsRes, agreementsRes, paymentsRes]) => {
                  setPostings(postingsRes.postings.filter((p) => p.createdBy === user?.id))
                  setAgreements(agreementsRes.agreements)
                  setPayments(paymentsRes.payments)
                })
                .catch(() => setError('No se pudieron cargar los datos del dashboard.'))
                .finally(() => setLoading(false))
            }}
            className="flex items-center gap-1 rounded-full border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
          >
            <RefreshCw size={12} />
            Reintentar
          </button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ofertas publicadas" value={postings.length} icon={Briefcase} accent="text-accent-400" delay={0} />
        <StatCard label="Freelancers contratados" value={agreements.length} icon={UserRoundCheck} accent="text-emerald-400" delay={0.06} />
        <StatCard label="Pagado vía Pasarela" value={`$${totalPaid.toFixed(2)}`} icon={Wallet} accent="text-emerald-400" delay={0.12} />
        <StatCard label="Total en responsivas" value={`$${totalCommitted.toFixed(2)}`} icon={FileSignature} accent="text-amber-400" delay={0.18} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionCard title="Tus ofertas publicadas" emptyText="Aún no has publicado ninguna oferta." loading={loading} isEmpty={postings.length === 0}>
            {postings.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-white/5 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{p.title}</p>
                  <p className="text-xs text-slate-400">
                    Busca {p.roleTarget === 'freelancer' ? 'freelancer' : 'voluntario/a'}
                    {p.budgetPerHour > 0 ? ` · $${p.budgetPerHour.toFixed(2)}/hora` : ''}
                  </p>
                </div>
              </div>
            ))}
          </SectionCard>
          <Link
            to="/dashboard/ofertas"
            className="mt-3 flex items-center justify-center gap-2 rounded-full border border-dashed border-white/15 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-accent-500/40 hover:text-white"
          >
            <Briefcase size={14} />
            Ir a Ofertas
          </Link>
        </div>

        <div className="lg:col-span-7">
          <SectionCard
            title="Contrataciones y Pagos Procesados"
            emptyText="Aún no has contratado a ningún freelancer."
            loading={loading}
            isEmpty={agreements.length === 0}
          >
            {agreements.slice(0, 6).map((a) => {
              const payment = payments.find((p) => p.agreementId === a.id)
              return (
                <div key={a.id} className="flex items-start gap-3 border-b border-white/5 py-3 last:border-0">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5">
                    <FileSignature size={14} className="text-accent-400" />
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-200">
                        Contrataste a <strong className="text-white">{a.freelancerName}</strong>
                        {a.postingTitle ? ` para "${a.postingTitle}"` : ''}
                      </p>
                      {payment ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                          {payment.status === 'succeeded' ? 'Pagado' : 'Pendiente'} ({(payment.provider || 'stripe').toUpperCase()})
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                          Responsiva firmada
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      ${a.agreedAmount.toFixed(2)} MXN · {new Date(a.acceptedAt).toLocaleDateString('es-MX')}
                      {payment?.destinationBankName && (
                        <span className="ml-2 font-medium text-emerald-400">
                          → Depósito a {payment.destinationBankName} (****{payment.destinationAccountLast4})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}


// --- Vista de FREELANCER: sus postulaciones + estado de su perfil profesional ---
function FreelancerDashboard() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<JobApplicationWithPosting[]>([])
  const [platforms, setPlatforms] = useState<UserPlatform[]>([])
  const [bankCount, setBankCount] = useState(0)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listMyApplications(), listPlatforms(), listBankAccounts(), listMyPayments()])
      .then(([appsRes, platformsRes, bankRes, paymentsRes]) => {
        if (cancelled) return
        setApplications(appsRes.applications)
        setPlatforms(platformsRes.platforms)
        setBankCount(bankRes.accounts.length)
        setPayments(paymentsRes.payments)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los datos del dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const acceptedCount = applications.filter((a) => a.status === 'accepted').length
  const totalReceived = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="mx-auto max-w-6xl">
      <Header
        greeting={`Hola, ${user?.name?.split(' ')[0] ?? ''} 👋`}
        subtitle="Este es el resumen de tus postulaciones y tu perfil profesional."
        badge="IA buscando ofertas que se ajusten a tu perfil"
      />

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setLoading(true)
              Promise.all([listMyApplications(), listPlatforms(), listBankAccounts(), listMyPayments()])
                .then(([appsRes, platformsRes, bankRes, paymentsRes]) => {
                  setApplications(appsRes.applications)
                  setPlatforms(platformsRes.platforms)
                  setBankCount(bankRes.accounts.length)
                  setPayments(paymentsRes.payments)
                })
                .catch(() => setError('No se pudieron cargar los datos del dashboard.'))
                .finally(() => setLoading(false))
            }}
            className="flex items-center gap-1 rounded-full border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
          >
            <RefreshCw size={12} />
            Reintentar
          </button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Postulaciones enviadas" value={applications.length} icon={Briefcase} accent="text-accent-400" delay={0} />
        <StatCard label="Aceptadas" value={acceptedCount} icon={UserRoundCheck} accent="text-emerald-400" delay={0.06} />
        <StatCard
          label="Tu tarifa"
          value={user?.rateAmount ? `$${user.rateAmount}${user.rateType === 'hourly' ? '/h' : '/proy.'}` : 'Sin definir'}
          icon={Wallet}
          accent="text-amber-400"
          delay={0.12}
        />
        <StatCard label="Plataformas conectadas" value={platforms.length} icon={Link2} accent="text-violet-400" delay={0.18} />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total recibido" value={`$${totalReceived.toFixed(2)}`} icon={Wallet} accent="text-emerald-400" delay={0.24} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SectionCard
            title="Tus postulaciones"
            emptyText="Aún no te has postulado a ninguna oferta."
            loading={loading}
            isEmpty={applications.length === 0}
          >
            {applications.slice(0, 6).map((a) => {
              const status = APP_STATUS_LABEL[a.status]
              return (
                <div key={a.id} className="flex items-center justify-between border-b border-white/5 py-3 last:border-0">
                  <p className="text-sm text-slate-200">{a.postingTitle}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              )
            })}
          </SectionCard>
          <Link
            to="/dashboard/ofertas"
            className="mt-3 flex items-center justify-center gap-2 rounded-full border border-dashed border-white/15 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-accent-500/40 hover:text-white"
          >
            <Briefcase size={14} />
            Buscar ofertas
          </Link>
        </div>

        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-accent-500/10 to-violet-500/10 p-5">
            <p className="text-sm font-medium text-white">Completa tu perfil</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${user?.cvUrl ? 'bg-emerald-400' : 'bg-white/20'}`} />
                {user?.cvUrl ? 'CV subido' : 'Sube tu CV'}
              </li>
              <li className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${platforms.length > 0 ? 'bg-emerald-400' : 'bg-white/20'}`} />
                {platforms.length > 0 ? `${platforms.length} plataforma(s) conectada(s)` : 'Conecta una plataforma/portafolio'}
              </li>
              <li className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${bankCount > 0 ? 'bg-emerald-400' : 'bg-white/20'}`} />
                {bankCount > 0 ? 'Cuenta bancaria registrada' : 'Registra una cuenta bancaria'}
              </li>
            </ul>
            <Link
              to="/dashboard/configuracion"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink-950 transition-transform hover:scale-105"
            >
              Ir a Ajustes
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-medium text-white">Tu perfil profesional</p>
            <div className="mt-3 space-y-2 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <Briefcase size={13} className="text-accent-400" />
                {user?.profession || 'Sin definir'}
              </p>
              <p className="flex items-center gap-2">
                <Landmark size={13} className="text-accent-400" />
                {user?.location || 'Sin definir'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Vista de VOLUNTARIO: oportunidades disponibles + sus postulaciones ---
function VolunteerDashboard() {
  const { user } = useAuth()
  const [postings, setPostings] = useState<JobPosting[]>([])
  const [applications, setApplications] = useState<JobApplicationWithPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listJobPostings(), listMyApplications()])
      .then(([postingsRes, appsRes]) => {
        if (cancelled) return
        setPostings(postingsRes.postings.filter((p) => p.roleTarget === 'voluntario'))
        setApplications(appsRes.applications)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los datos del dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const appliedIds = useMemo(() => new Set(applications.map((a) => a.postingId)), [applications])
  const openOpportunities = postings.filter((p) => !appliedIds.has(p.id))
  const acceptedCount = applications.filter((a) => a.status === 'accepted').length

  return (
    <div className="mx-auto max-w-6xl">
      <Header
        greeting={`Hola, ${user?.name?.split(' ')[0] ?? ''} 👋`}
        subtitle="Estas son las oportunidades de voluntariado disponibles para ti."
        badge="Gana experiencia profesional postulándote"
      />

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setLoading(true)
              Promise.all([listJobPostings(), listMyApplications()])
                .then(([postingsRes, appsRes]) => {
                  setPostings(postingsRes.postings.filter((p) => p.roleTarget === 'voluntario'))
                  setApplications(appsRes.applications)
                })
                .catch(() => setError('No se pudieron cargar los datos del dashboard.'))
                .finally(() => setLoading(false))
            }}
            className="flex items-center gap-1 rounded-full border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
          >
            <RefreshCw size={12} />
            Reintentar
          </button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Oportunidades disponibles" value={openOpportunities.length} icon={HeartHandshake} accent="text-accent-400" delay={0} />
        <StatCard label="Postulaciones enviadas" value={applications.length} icon={Briefcase} accent="text-violet-400" delay={0.06} />
        <StatCard label="Aceptadas" value={acceptedCount} icon={UserRoundCheck} accent="text-emerald-400" delay={0.12} />
        <StatCard label="Tu disponibilidad" value={user?.availability || 'Sin definir'} icon={Clock} accent="text-amber-400" delay={0.18} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SectionCard
            title="Oportunidades para ti"
            emptyText="No hay oportunidades de voluntariado disponibles por ahora."
            loading={loading}
            isEmpty={openOpportunities.length === 0}
          >
            {openOpportunities.slice(0, 6).map((p) => (
              <div key={p.id} className="border-b border-white/5 py-3 last:border-0">
                <p className="text-sm font-medium text-white">{p.title}</p>
                {p.perks && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                    <HeartHandshake size={12} />
                    {p.perks}
                  </p>
                )}
              </div>
            ))}
          </SectionCard>
          <Link
            to="/dashboard/ofertas"
            className="mt-3 flex items-center justify-center gap-2 rounded-full border border-dashed border-white/15 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-accent-500/40 hover:text-white"
          >
            <HeartHandshake size={14} />
            Ver todas las oportunidades
          </Link>
        </div>

        <div className="lg:col-span-5">
          <SectionCard
            title="Tus postulaciones"
            emptyText="Aún no te has postulado a ninguna oportunidad."
            loading={loading}
            isEmpty={applications.length === 0}
          >
            {applications.slice(0, 6).map((a) => {
              const status = APP_STATUS_LABEL[a.status]
              return (
                <div key={a.id} className="flex items-center justify-between border-b border-white/5 py-3 last:border-0">
                  <p className="text-sm text-slate-200">{a.postingTitle}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              )
            })}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function Header({ greeting, subtitle, badge }: { greeting: string; subtitle: string; badge: string }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">{greeting}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-accent-400">
        <Sparkles size={13} />
        {badge}
      </span>
    </div>
  )
}

function SectionCard({
  title,
  emptyText,
  loading,
  isEmpty,
  children,
}: {
  title: string
  emptyText: string
  loading: boolean
  isEmpty: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm font-medium text-white">{title}</p>
      <div className="mt-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-accent-400" />
            <span className="ml-3 text-sm text-slate-400">Cargando...</span>
          </div>
        )}
        {!loading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShieldCheck size={20} className="text-slate-500" />
            <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
          </div>
        )}
        {!loading && !isEmpty && children}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <DashboardLayout>
      <OnboardingModal />
      {user?.role === 'reclutador' && <RecruiterDashboard />}
      {user?.role === 'freelancer' && <FreelancerDashboard />}
      {user?.role === 'voluntario' && <VolunteerDashboard />}
    </DashboardLayout>
  )
}
