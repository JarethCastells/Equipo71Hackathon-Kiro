import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Bot,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Wand2,
  Save,
  Copy,
  Check,
  RefreshCw,
  UserCheck,
  Lock,
  Send,
  Download,
  ShieldCheck,
  ChevronDown,
  Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  ApiError,
  applyToJobPosting,
  listJobPostings,
  optimizeCvWithAI,
  saveGeneratedCv,
  type JobPosting,
  type OptimizedCvResult,
} from '../lib/api'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import PlanUpgradeModal from '../components/dashboard/PlanUpgradeModal'
import CvViewerModal from '../components/common/CvViewerModal'

const PROMPT_PRESETS = [
  {
    label: '🎯 Enfocar en Habilidades Senior & Resultados',
    prompt: 'Optimiza mi CV para un nivel Senior resaltando liderazgo técnico, arquitectura de software y entrega de resultados.',
  },
  {
    label: '💼 Estilo Ejecutivo, Conciso y Directo',
    prompt: 'Reestructura mi resumen y experiencia con un tono ejecutivo, directo y enfocado en toma de decisiones estratégicas.',
  },
  {
    label: '🌟 Destacar Voluntariado e Impacto Social',
    prompt: 'Resalta mi participación en proyectos sociales, trabajo colaborativo, empatía y compromiso comunitario.',
  },
  {
    label: '⚡ Resaltar Desarrollo Web (React, TS, Node)',
    prompt: 'Enfoca mis habilidades en el desarrollo de software moderno con React, TypeScript, Node.js y buenas prácticas.',
  },
  {
    label: '📈 Cuantificar Logros & Métricas Clave',
    prompt: 'Reescribe mi experiencia usando verbos de acción y agregando estimaciones de porcentaje e impacto positivo.',
  },
]

export default function CvOptimizer() {
  const { user, refreshUser } = useAuth()
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>('custom')
  const [targetJobTitle, setTargetJobTitle] = useState('')
  const [targetJobDescription, setTargetJobDescription] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [currentCvText, setCurrentCvText] = useState('')
  const [profession, setProfession] = useState('')
  
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [optimizedResult, setOptimizedResult] = useState<OptimizedCvResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [viewCvModalOpen, setViewCvModalOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [selectedAtsPlatform, setSelectedAtsPlatform] = useState<'workday' | 'greenhouse' | 'lever' | 'taleo'>('workday')
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false)
  const [jobSearchQuery, setJobSearchQuery] = useState('')

  const filteredJobOptions = useMemo(() => {
    if (!jobSearchQuery.trim()) return jobPostings
    const q = jobSearchQuery.toLowerCase().trim()
    return jobPostings.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.roleTarget.toLowerCase().includes(q) ||
        (j.skills && j.skills.toLowerCase().includes(q))
    )
  }, [jobPostings, jobSearchQuery])

  const selectedJobObject = useMemo(() => {
    return jobPostings.find((j) => j.id === selectedJobId)
  }, [jobPostings, selectedJobId])

  const handleApplyWithCv = async () => {
    if (user?.plan === 'libre') {
      setUpgradeModalOpen(true)
      return
    }

    if (selectedJobId === 'custom' || !selectedJobId) {
      setError('Por favor selecciona una vacante de la lista en el panel izquierdo para postularte con tu CV IA.')
      return
    }

    if (!optimizedResult) return

    setError(null)
    setSaveSuccess(null)
    setIsApplying(true)

    try {
      await applyToJobPosting(selectedJobId, optimizedResult.formattedCvText)
      setSaveSuccess('¡Te has postulado exitosamente a la vacante seleccionada con tu CV IA!')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al enviar la postulación.')
    } finally {
      setIsApplying(false)
    }
  }

  const handleDownloadPdfClick = () => {
    if (user?.plan !== 'pro') {
      setUpgradeModalOpen(true)
    } else {
      setViewCvModalOpen(true)
    }
  }

  useEffect(() => {
    if (user) {
      setProfession(user.profession || '')
      const initialText = user.bio || (user.interests ? `Intereses: ${user.interests}` : '')
      setCurrentCvText(initialText)
    }

    listJobPostings()
      .then((res) => {
        setJobPostings(res.postings || [])
      })
      .catch(() => {})
  }, [user])

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId)
    if (jobId === 'custom') {
      setTargetJobTitle('')
      setTargetJobDescription('')
    } else {
      const found = jobPostings.find((j) => j.id === jobId)
      if (found) {
        setTargetJobTitle(found.title)
        setTargetJobDescription(found.description)
      }
    }
  }

  const handleApplyPreset = (promptText: string) => {
    setCustomPrompt(promptText)
  }

  const handleOptimize = async () => {
    setError(null)
    setSaveSuccess(null)
    setIsOptimizing(true)

    try {
      const res = await optimizeCvWithAI({
        currentCvText,
        targetJobTitle,
        targetJobDescription,
        customPrompt,
      })
      setOptimizedResult(res.optimizedCv)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo optimizar el CV con Gemini IA.')
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleSaveToProfile = async () => {
    if (!optimizedResult) return
    setError(null)
    setSaveSuccess(null)
    setIsSaving(true)

    try {
      const res = await saveGeneratedCv({
        bio: optimizedResult.professionalSummary,
        profession: profession || user?.profession || undefined,
        formattedCvText: optimizedResult.formattedCvText,
      })
      await refreshUser()
      setSaveSuccess(res.message || '¡Tu CV oficial ha sido actualizado automáticamente!')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el CV en el perfil.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyFormattedText = () => {
    if (!optimizedResult) return
    navigator.clipboard.writeText(optimizedResult.formattedCvText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isRecruiter = user?.role === 'reclutador'

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8 pb-16">
        {/* Header Principal */}
        <div className="relative overflow-hidden rounded-3xl border border-accent-500/30 bg-gradient-to-r from-accent-950/60 via-slate-900 to-violet-950/60 p-6 backdrop-blur-xl sm:p-8">
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl" />
          <div className="relative z-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 items-center gap-1.5 rounded-full border border-accent-500/30 bg-accent-500/20 px-3 text-[11px] font-bold uppercase tracking-wider text-accent-300">
                  <Sparkles size={13} className="text-accent-400" />
                  Gemini IA Engine
                </span>
                <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300">
                  Exclusivo Freelancer & Voluntario
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
                Optimizador & Adaptador de CV con IA 🚀
              </h1>
              <p className="mt-1.5 max-w-2xl text-xs text-slate-300 sm:text-sm">
                Adapta tu currículum automáticamente a cualquier oferta de trabajo o rol de tu interés con instrucciones de IA personalizadas y actualiza tu perfil oficial en 1 clic.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur-md">
                <span className="block text-[10px] font-semibold uppercase text-slate-400">Plan Actual</span>
                <span className="text-sm font-bold capitalize text-accent-300">{user?.plan ?? 'libre'}</span>
              </div>
            </div>
          </div>
        </div>

        {isRecruiter ? (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center backdrop-blur-xl">
            <AlertCircle size={40} className="mx-auto text-amber-400" />
            <h3 className="mt-3 text-lg font-bold text-white">Función para Freelancers y Voluntarios</h3>
            <p className="mt-1 text-xs text-slate-300">
              Como reclutador, esta herramienta de adaptación de CV no está activa en tu cuenta. Puedes crear vacantes e interactuar con candidatos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Panel Izquierdo: Configuración & Inputs (5 Cols) */}
            <div className="space-y-6 lg:col-span-5">
              {/* Card 1: Selección de Oferta Objetivo */}
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2 text-white">
                  <Briefcase size={18} className="text-accent-400" />
                  <h2 className="font-bold">1. Vacante u Objetivo de Interés</h2>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="relative">
                    <label className="mb-1.5 block font-medium text-slate-300">
                      Seleccionar de ofertas en la plataforma
                    </label>

                    {/* Botón Trigger del Dropdown */}
                    <button
                      type="button"
                      onClick={() => setIsJobDropdownOpen(!isJobDropdownOpen)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-slate-950 px-3.5 py-3 text-left text-xs text-white transition-all hover:border-accent-500/60 focus:border-accent-500"
                    >
                      <div className="flex items-center gap-2 overflow-hidden truncate">
                        {selectedJobObject ? (
                          <>
                            <span className="font-bold text-accent-300 truncate">📌 {selectedJobObject.title}</span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              selectedJobObject.roleTarget === 'voluntario'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            }`}>
                              {selectedJobObject.roleTarget.toUpperCase()} (${selectedJobObject.budgetPerHour} MXN/h)
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-medium">✏️ Ingresar puesto/descripción personalizada</span>
                        )}
                      </div>
                      <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${isJobDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Menú Desplegable con Barra de Búsqueda Instantánea */}
                    {isJobDropdownOpen && (
                      <div className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-2xl border border-white/20 bg-slate-950 p-3 shadow-2xl space-y-2 backdrop-blur-2xl">
                        {/* Input de Búsqueda al Instante */}
                        <div className="relative">
                          <input
                            type="text"
                            autoFocus
                            value={jobSearchQuery}
                            onChange={(e) => setJobSearchQuery(e.target.value)}
                            placeholder="🔍 Buscar vacante por título, puesto o palabra clave..."
                            className="w-full rounded-xl border border-accent-500/50 bg-slate-900 pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-accent-500"
                          />
                          <Search size={14} className="absolute left-3 top-2.5 text-accent-400" />
                        </div>

                        {/* Lista de Opciones Filtradas al Instante */}
                        <div className="max-h-56 overflow-y-auto space-y-1.5 pt-1 candidate-scroll">
                          {/* Opción Personalizada */}
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectJob('custom')
                              setIsJobDropdownOpen(false)
                              setJobSearchQuery('')
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                              selectedJobId === 'custom'
                                ? 'bg-accent-500/20 text-accent-300 border border-accent-500/30'
                                : 'text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <span>✏️ Ingresar puesto / descripción personalizada</span>
                            {selectedJobId === 'custom' && <Check size={14} className="text-accent-400" />}
                          </button>

                          {/* Listado de Vacantes de la Plataforma */}
                          {filteredJobOptions.length === 0 ? (
                            <p className="p-3 text-center text-xs text-slate-500">
                              No se encontraron vacantes con "{jobSearchQuery}".
                            </p>
                          ) : (
                            filteredJobOptions.map((job) => (
                              <button
                                key={job.id}
                                type="button"
                                onClick={() => {
                                  handleSelectJob(job.id)
                                  setIsJobDropdownOpen(false)
                                  setJobSearchQuery('')
                                }}
                                className={`flex w-full flex-col gap-1 rounded-xl p-3 text-left transition-all ${
                                  selectedJobId === job.id
                                    ? 'bg-accent-500/20 text-white border border-accent-500/40'
                                    : 'bg-white/[0.03] text-slate-300 hover:bg-white/10'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-white text-xs">📌 {job.title}</span>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                    job.roleTarget === 'voluntario'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                  }`}>
                                    {job.roleTarget.toUpperCase()} (${job.budgetPerHour} MXN/h)
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                  {job.description}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block font-medium text-slate-300">Puesto o Rol Objetivo</label>
                    <input
                      type="text"
                      value={targetJobTitle}
                      onChange={(e) => setTargetJobTitle(e.target.value)}
                      placeholder="Ej. Senior Frontend Developer / Coordinador de Proyecto Social"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-medium text-slate-300">Descripción o Requerimientos de la Vacante</label>
                    <textarea
                      rows={3}
                      value={targetJobDescription}
                      onChange={(e) => setTargetJobDescription(e.target.value)}
                      placeholder="Pega aquí los requisitos principales de la vacante para que la IA adapte tus palabras clave..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Prompts de Personalización */}
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2 text-white">
                  <Wand2 size={18} className="text-violet-400" />
                  <h2 className="font-bold">2. Instrucciones & Prompts IA</h2>
                </div>

                <div className="space-y-3 text-xs">
                  <label className="block font-medium text-slate-300">Sugerencias rápidas de prompt:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyPreset(preset.prompt)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-accent-500/50 hover:bg-accent-500/10 hover:text-white"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="mb-1 block font-medium text-slate-300">Tu Prompt Personalizado</label>
                    <textarea
                      rows={3}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Escribe instrucciones adicionales para Gemini (ej: 'Resalta mi liderazgo en equipos ágiles y proyectos React')..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Datos de Perfil Base */}
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2 text-white">
                  <UserCheck size={18} className="text-emerald-400" />
                  <h2 className="font-bold">3. Tu Perfil & CV Base</h2>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="mb-1 block font-medium text-slate-300">Título / Especialidad</label>
                    <input
                      type="text"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="Ej. Desarrollador Fullstack / Voluntario Comunitario"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-medium text-slate-300">Texto o Resumen Actual de tu CV</label>
                    <textarea
                      rows={4}
                      value={currentCvText}
                      onChange={(e) => setCurrentCvText(e.target.value)}
                      placeholder="Ingresa tus datos o experiencia actual..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    <AlertCircle size={15} />
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isOptimizing}
                  onClick={handleOptimize}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent-500 via-violet-500 to-pink-500 py-3.5 text-xs font-extrabold text-white shadow-lg shadow-accent-500/25 transition-all hover:scale-[1.02] disabled:opacity-60"
                >
                  {isOptimizing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Gemini IA Optimizando tu CV...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Generar CV Optimizado con Gemini IA
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Panel Derecho: Resultado & Vista Previa (7 Cols) */}
            <div className="space-y-6 lg:col-span-7">
              {optimizedResult ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Banner de Resultado & Score */}
                  <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 to-slate-900 p-6 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 size={13} />
                          CV Reestructurado con Éxito
                        </span>
                        <h3 className="mt-2 text-xl font-extrabold text-white sm:text-2xl">
                          Compatibilidad IA: {optimizedResult.compatibilityScore}%
                        </h3>
                        <p className="mt-1 text-xs text-slate-300">
                          Tu perfil ha sido alineado estratégicamente para la vacante seleccionada.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyFormattedText}
                          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-white/20"
                        >
                          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          {copied ? 'Copiado' : 'Copiar Texto'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {saveSuccess && (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/20 p-4 text-xs font-bold text-emerald-300 backdrop-blur-md">
                      <CheckCircle2 size={18} />
                      {saveSuccess}
                    </div>
                  )}

                  {/* Panel de Filtros & Verificación ATS */}
                  <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 backdrop-blur-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        <ShieldCheck size={20} className="text-emerald-400" />
                        <h4 className="font-bold text-sm">Filtros de Verificación ATS (Workday, Greenhouse, Lever, Taleo)</h4>
                      </div>
                      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                        {optimizedResult.atsAnalysis?.score ?? 98}% ATS Approved
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">
                      Selecciona la plataforma de reclutamiento de la empresa para auditar la compatibilidad de tu CV:
                    </p>

                    {/* Selector de Plataformas ATS */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedAtsPlatform('workday')}
                        className={`rounded-2xl border p-3 text-left transition-all ${
                          selectedAtsPlatform === 'workday'
                            ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500/30'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span className="block font-bold text-white">🌐 Workday</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">98% Compatibilidad</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedAtsPlatform('greenhouse')}
                        className={`rounded-2xl border p-3 text-left transition-all ${
                          selectedAtsPlatform === 'greenhouse'
                            ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500/30'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span className="block font-bold text-white">🌿 Greenhouse</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">96% Palabras Clave</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedAtsPlatform('lever')}
                        className={`rounded-2xl border p-3 text-left transition-all ${
                          selectedAtsPlatform === 'lever'
                            ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500/30'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span className="block font-bold text-white">⚡ Lever ATS</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">99% Formato Seguro</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedAtsPlatform('taleo')}
                        className={`rounded-2xl border p-3 text-left transition-all ${
                          selectedAtsPlatform === 'taleo'
                            ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500/30'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <span className="block font-bold text-white">💼 Taleo / LinkedIn</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">97% Densidad Texto</span>
                      </button>
                    </div>

                    {/* Verificaciones Pasadas */}
                    <div className="space-y-2 pt-2 text-xs">
                      <span className="font-bold text-slate-300 block">Chequeos de Seguridad ATS Aprobados:</span>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-slate-300">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <span>Estructura plana sin tablas complejas</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-slate-300">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <span>Encabezados estandarizados reconocidos</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-slate-300">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <span>Alta densidad de palabras clave</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-slate-300">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <span>Verbos de acción y resultados cuantificables</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumen Profesional IA */}
                  <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-6 backdrop-blur-xl">
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-400">
                      Resumen Ejecutivo Mejorado:
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-200">
                      {optimizedResult.professionalSummary}
                    </p>

                    <h4 className="mb-2.5 mt-5 text-xs font-bold uppercase tracking-wider text-violet-400">
                      Habilidades Clave Destacadas:
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {optimizedResult.highlightedSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200"
                        >
                          ✨ {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Consejo Strategico IA */}
                  <div className="rounded-3xl border border-accent-500/30 bg-accent-500/10 p-6 backdrop-blur-xl">
                    <div className="flex items-start gap-3">
                      <Bot size={24} className="shrink-0 text-accent-400" />
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-accent-300">
                          Recomendación de Ajuste Gemini IA:
                        </h4>
                        <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                          {optimizedResult.strengthsAdvice}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CV Formateado Completo & Editor Inline */}
                  <div className="rounded-3xl border border-white/10 bg-slate-950 p-6 backdrop-blur-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <FileCheck2 size={16} className="text-accent-400" />
                        Editor & Vista Previa del CV Final:
                      </h4>
                      <span className="text-[10px] text-slate-500">Puedes editar cualquier texto directamente</span>
                    </div>

                    <textarea
                      rows={12}
                      value={optimizedResult.formattedCvText}
                      onChange={(e) =>
                        setOptimizedResult({
                          ...optimizedResult,
                          formattedCvText: e.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-200 outline-none focus:border-accent-500"
                    />

                    {/* Acciones & Botones Monetizados */}
                    <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                      {/* Botón 1: Guardar en Perfil */}
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSaveToProfile}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-xs font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] disabled:opacity-60"
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw size={15} className="animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save size={15} />
                            Guardar en mi Perfil
                          </>
                        )}
                      </button>

                      {/* Botón 2: Postularme con mi CV IA (Plan Plus) */}
                      <button
                        type="button"
                        disabled={isApplying}
                        onClick={handleApplyWithCv}
                        className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-xs font-extrabold text-white shadow-lg transition-all hover:scale-[1.02] ${
                          user?.plan === 'libre'
                            ? 'bg-gradient-to-r from-accent-600 to-violet-600 shadow-accent-500/20'
                            : 'bg-gradient-to-r from-accent-500 via-violet-500 to-pink-500 shadow-accent-500/30'
                        }`}
                      >
                        {user?.plan === 'libre' && <Lock size={13} className="text-amber-400" />}
                        {isApplying ? (
                          <>
                            <RefreshCw size={15} className="animate-spin" />
                            Enviando Postulación...
                          </>
                        ) : (
                          <>
                            <Send size={15} />
                            {user?.plan === 'libre'
                              ? 'Postularme con CV IA (Plan Plus)'
                              : 'Postularme a Vacante con CV IA'}
                          </>
                        )}
                      </button>
                    </div>

                    {/* Botón 3: Descargar en PDF (Plan Pro) */}
                    <button
                      type="button"
                      onClick={handleDownloadPdfClick}
                      className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-xs font-extrabold transition-all ${
                        user?.plan === 'pro'
                          ? 'border border-violet-500/50 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30'
                          : 'border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                      }`}
                    >
                      {user?.plan !== 'pro' && <Lock size={13} className="text-amber-400" />}
                      <Download size={15} />
                      {user?.plan === 'pro'
                        ? 'Descargar CV en PDF'
                        : 'Descargar CV en PDF & Hablar con IA 24/7 (Plan Pro)'}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="flex min-h-[480px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-slate-900/40 p-8 text-center backdrop-blur-xl">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 shadow-inner">
                    <FileCheck2 size={32} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">Genera tu CV Inteligente</h3>
                  <p className="mt-1 max-w-sm text-xs text-slate-400">
                    Selecciona una oferta de trabajo en el panel izquierdo o ingresa un prompt personalizado y haz clic en <strong>Generar CV Optimizado con Gemini IA</strong>.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Upgrade de Plan */}
      <PlanUpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
      />

      {/* Modal de Visualización e Impresión de CV */}
      {viewCvModalOpen && user && (
        <CvViewerModal
          isOpen={viewCvModalOpen}
          onClose={() => setViewCvModalOpen(false)}
          userProfile={{
            name: user.name,
            email: user.email,
            profession: profession || user.profession,
            bio: optimizedResult?.professionalSummary || user.bio,
            cvUrl: optimizedResult?.formattedCvText || user.cvUrl,
            role: user.role,
          }}
          onUpgradeProRequest={() => {
            setViewCvModalOpen(false)
            setUpgradeModalOpen(true)
          }}
        />
      )}
    </DashboardLayout>
  )
}
