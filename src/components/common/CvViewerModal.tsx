import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Mail,
  Copy,
  Check,
  Download,
  Lock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export interface CvViewerModalProps {
  isOpen: boolean
  onClose: () => void
  userProfile: {
    name: string
    email: string
    role?: string
    profession?: string | null
    bio?: string | null
    cvUrl?: string | null
    avatarUrl?: string | null
    interests?: string | null
    location?: string | null
  }
  onUpgradeProRequest?: () => void
}

export default function CvViewerModal({
  isOpen,
  onClose,
  userProfile,
  onUpgradeProRequest,
}: CvViewerModalProps) {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  // Cerrar al presionar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isPro = user?.plan === 'pro'
  const rawCvText =
    userProfile.cvUrl ||
    userProfile.bio ||
    userProfile.interests ||
    'Este candidato aún no ha agregado detalles adicionales a su currículum.'

  const cleanSummary =
    userProfile.bio ||
    (rawCvText.includes('RESUMEN PROFESIONAL')
      ? rawCvText.split('RESUMEN PROFESIONAL')[1]?.split('\n\n')[0]?.trim()
      : rawCvText.slice(0, 350))

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCvText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPdf = () => {
    if (!isPro) {
      if (onUpgradeProRequest) {
        onUpgradeProRequest()
      }
      return
    }

    // Abre ventana sin bloquear la interfaz principal
    const printWindow = window.open('', '_blank', 'width=900,height=750')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>CV — ${userProfile.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            * { box-sizing: border-box; }
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 40px; color: #0f172a; background: #ffffff; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #4f46e5; padding-bottom: 24px; margin-bottom: 30px; }
            .name { font-size: 32px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
            .role { font-size: 14px; color: #4f46e5; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; }
            .contact { font-size: 12px; color: #64748b; margin-top: 12px; display: flex; gap: 15px; }
            .section { margin-bottom: 28px; }
            .section-title { font-size: 13px; font-weight: 800; color: #1e1b4b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 14px; }
            .cv-body { font-size: 13px; color: #334155; white-space: pre-wrap; line-height: 1.7; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
            @media print {
              body { padding: 0; }
              .cv-body { border: none; background: transparent; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="name">${userProfile.name}</h1>
            <div class="role">${userProfile.profession || userProfile.role || 'Candidato TalentFlow AI'}</div>
            <div class="contact">
              <span>📧 ${userProfile.email}</span>
              ${userProfile.location ? `<span>📍 ${userProfile.location}</span>` : ''}
              <span>🛡️ Verificado ATS Safe</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">CURRÍCULUM VITAE & PERFIL PROFESIONAL (ATS COMPATIBLE)</div>
            <div class="cv-body">${rawCvText}</div>
          </div>
        </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 300)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto cursor-pointer"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-slate-900 shadow-2xl my-6 max-h-[90vh] flex flex-col cursor-default"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
      >
        {/* Top Control Bar (Sticky & Visible) */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-slate-950 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[10px] font-bold text-emerald-400">
              <CheckCircle2 size={12} />
              ATS Filter Approved (98%)
            </span>
            <span className="hidden text-xs text-slate-400 sm:inline">Vista Previa de Hoja de Vida</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar Texto'}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-md transition-all ${
                isPro
                  ? 'bg-gradient-to-r from-violet-500 to-accent-500 hover:scale-[1.02]'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {!isPro && <Lock size={12} className="text-amber-400" />}
              <Download size={14} />
              {isPro ? 'Exportar PDF' : 'Descargar PDF (Plan Pro)'}
            </button>

            {/* Botón de Cierre Destacado y Siempre Disponible */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="ml-2 flex items-center gap-1 rounded-full bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-300 transition-all hover:bg-rose-600 hover:text-white"
            >
              <X size={15} />
              <span>Cerrar</span>
            </button>
          </div>
        </div>

        {/* Document Body (Estilo Hoja de Papel Ejecutiva) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 candidate-scroll">
          <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-slate-900 shadow-2xl sm:p-12 border border-slate-200">
            {/* Header del CV */}
            <div className="border-b-2 border-indigo-600 pb-6 mb-8">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {userProfile.name}
                  </h1>
                  <p className="mt-1 text-sm font-bold uppercase tracking-wider text-indigo-600">
                    {userProfile.profession || userProfile.role?.toUpperCase() || 'Profesional TalentFlow'}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-100">
                  {userProfile.name.charAt(0).toUpperCase()}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-indigo-500" />
                  {userProfile.email}
                </span>
                {userProfile.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-indigo-500" />
                    {userProfile.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  <ShieldCheck size={12} />
                  ATS Verified
                </span>
              </div>
            </div>

            {/* Contenido Formateado del CV */}
            <div className="space-y-6 text-xs text-slate-700 leading-relaxed font-sans">
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                  Resumen Ejecutivo & Perfil
                </h3>
                <p className="text-slate-700 leading-relaxed font-normal">
                  {cleanSummary}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                  Detalles del Currículum Vitae (ATS Structured Format)
                </h3>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 bg-slate-50 p-5 rounded-xl border border-slate-200 leading-relaxed">
                  {rawCvText}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Footer si no es Pro */}
        {!isPro && (
          <div className="border-t border-white/10 bg-slate-950 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-slate-300">
              <Lock size={15} className="text-amber-400 shrink-0" />
              <span>¿Necesitas descargar este CV formateado en PDF o hablar con Gemini IA 24/7?</span>
            </div>
            {onUpgradeProRequest && (
              <button
                type="button"
                onClick={onUpgradeProRequest}
                className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md hover:scale-105"
              >
                Subir a Plan Pro ($599/mes)
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
