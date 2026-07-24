import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Lock, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react'

/**
 * Mockup de navegador animado que reemplaza a un video de stock genérico.
 * Cuenta una micro-historia en loop:
 *   1) Alguien busca empleo en un buscador genérico.
 *   2) Escribe/entra a TalentFlow AI.
 *   3) La IA muestra decenas de coincidencias apareciendo en cascada.
 *   4) Se resalta un match y se confirma la conexión.
 * Se implementa 100% con React + Framer Motion: sin dependencias de video,
 * sin licencias de stock, totalmente responsive y ligero.
 */

type Scene = 0 | 1 | 2 | 3

const SCENE_DURATIONS: Record<Scene, number> = {
  0: 2600,
  1: 2200,
  2: 3200,
  3: 2400,
}

const RESULT_ROWS = [
  { title: 'Diseñador/a UX/UI', budget: '$25-30/h', match: 96 },
  { title: 'Desarrollador Full-Stack', budget: '$30-40/h', match: 93 },
  { title: 'Voluntario/a de soporte', budget: 'Voluntariado', match: 90 },
  { title: 'Especialista en Marketing', budget: '$18-22/h', match: 87 },
]

export default function BrowserStory() {
  const [scene, setScene] = useState<Scene>(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setScene((prev) => ((prev + 1) % 4) as Scene)
    }, SCENE_DURATIONS[scene])
    return () => clearTimeout(timer)
  }, [scene])

  return (
    <div className="relative w-full max-w-xl mx-auto lg:max-w-none">
      {/* Marco tipo ventana de navegador */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1017] shadow-2xl shadow-black/50">
        {/* Barra superior del navegador */}
        <div className="flex items-center gap-3 border-b border-white/5 bg-[#12151d] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-md bg-white/5 px-3 py-1.5">
            <Lock size={11} className="text-slate-500" />
            <motion.span
              key={scene < 2 ? 'buscador-generico' : 'talentflow'}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="truncate text-[11px] text-slate-400"
            >
              {scene < 2 ? 'buscadordeempleos.com/resultados' : 'talentflow.ai/candidatos'}
            </motion.span>
          </div>
        </div>

        {/* Viewport de la página */}
        <div className="relative h-[340px] bg-gradient-to-b from-[#0a0d14] to-[#0d1017] p-5 sm:h-[380px] sm:p-6">
          <AnimatePresence mode="wait">
            {scene === 0 && (
              <motion.div
                key="s0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full flex-col"
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Buscador de empleo genérico
                </p>
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                  <Search size={14} className="text-slate-500" />
                  <span className="text-sm text-slate-300">
                    diseñador ux freelance presupuesto limitado
                  </span>
                  <motion.span
                    className="h-4 w-[1px] bg-slate-400"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                </div>
                <div className="mt-5 space-y-2.5 opacity-70">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <div className="h-2.5 w-2/3 rounded bg-white/10" />
                      <div className="mt-2 h-2 w-1/3 rounded bg-white/5" />
                    </div>
                  ))}
                </div>
                <p className="mt-auto text-center text-[11px] text-slate-500">
                  Cientos de resultados genéricos, sin filtro de presupuesto real...
                </p>
              </motion.div>
            )}

            {scene === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full flex-col items-center justify-center text-center"
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 160 }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-violet-500 shadow-lg shadow-accent-500/30"
                >
                  <Sparkles size={24} className="text-white" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mt-4 text-lg font-semibold text-white"
                >
                  Encontraron TalentFlow AI
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-1 max-w-[240px] text-xs text-slate-400"
                >
                  Redirigiendo a coincidencias filtradas por presupuesto real...
                </motion.p>
                <motion.div
                  className="mt-5 h-1 w-40 overflow-hidden rounded-full bg-white/10"
                >
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent-500 to-violet-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.6, ease: 'easeInOut' }}
                  />
                </motion.div>
              </motion.div>
            )}

            {scene === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full flex-col"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wide text-accent-400">
                    Coincidencias en vivo
                  </p>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    IA analizando presupuesto
                  </span>
                </div>
                <div className="mt-3 flex-1 space-y-2 overflow-hidden">
                  {RESULT_ROWS.map((row, i) => (
                    <motion.div
                      key={row.title}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.22, ease: 'easeOut' }}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5"
                    >
                      <div>
                        <p className="text-xs font-medium text-white">{row.title}</p>
                        <p className="text-[10px] text-slate-400">{row.budget}</p>
                      </div>
                      <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        {row.match}%
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {scene === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full flex-col items-center justify-center text-center"
              >
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  <CheckCircle2 size={44} className="text-emerald-400" />
                </motion.div>
                <p className="mt-4 text-lg font-semibold text-white">Match confirmado</p>
                <p className="mt-1 max-w-[260px] text-xs text-slate-400">
                  Conexión directa dentro de tu presupuesto, lista para chatear en segundos.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-4 py-2 text-xs font-medium text-slate-200">
                  Ver perfil completo
                  <ArrowRight size={13} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Indicadores de progreso de la escena */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === scene ? 'w-6 bg-accent-400' : 'w-2.5 bg-white/15'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
