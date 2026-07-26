import { motion } from 'framer-motion'
import { ArrowRight, Users } from 'lucide-react'
import PeopleWall from './PeopleWall'
import BrowserStory from './BrowserStory'

const STATS = [
  { value: '12,400+', label: 'Talentos verificados' },
  { value: '3,800+', label: 'Proyectos completados' },
  { value: '96%', label: 'Match exitoso con IA' },
]

export default function Hero() {
  return (
    <section id="top" className="relative flex min-h-screen w-full items-center overflow-hidden">
      <PeopleWall />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-28 sm:px-6 lg:px-8 lg:pt-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <motion.div
            className="lg:col-span-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-accent-400 backdrop-blur-sm">
              <Users size={13} />
              +8,200 personas buscando oportunidades ahora mismo
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Dejaron de buscar en{' '}
              <span className="text-slate-500 line-through">portales genéricos</span>{' '}
              y encontraron su match con{' '}
              <span className="text-gradient bg-[length:200%_auto] animate-gradient-pan">
                inteligencia artificial
              </span>
              .
            </h1>

            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Miles de freelancers y voluntarios navegan TalentFlow AI en este instante. Nuestra
              IA cruza su perfil con tu presupuesto y te muestra solo a quienes realmente
              califican, en segundos.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="#candidatos"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-105"
              >
                Encontrar talento ahora
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                Ver cómo funciona
              </a>
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-3 border-t border-white/10 pt-6 sm:mt-14 sm:gap-6 sm:pt-8">
              {STATS.map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <dd className="text-lg font-bold text-white sm:text-2xl lg:text-3xl">{stat.value}</dd>
                  <dt className="mt-1 text-[11px] text-slate-400 sm:text-xs lg:text-sm">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </motion.div>

          {/* Mockup animado: la narrativa de "buscador genérico -> TalentFlow AI -> match" */}
          <motion.div
            className="relative lg:col-span-6"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
          >
            <BrowserStory />
          </motion.div>
        </div>
      </div>

      {/* Indicador de scroll */}
      <motion.div
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-slate-400"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="flex h-9 w-6 items-start justify-center rounded-full border border-white/20 p-1">
          <span className="h-1.5 w-1 rounded-full bg-white/60" />
        </div>
      </motion.div>
    </section>
  )
}
