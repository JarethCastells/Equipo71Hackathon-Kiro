import { motion } from 'framer-motion'
import { ShieldCheck, Gauge, Wallet, ArrowRight } from 'lucide-react'

const BENEFITS = [
  {
    icon: Wallet,
    title: 'Control total del presupuesto',
    text: 'Define un rango de inversión y la IA solo te muestra talento dentro de ese límite.',
  },
  {
    icon: Gauge,
    title: 'Decisiones en minutos',
    text: 'Compara candidatos lado a lado con métricas de compatibilidad claras y objetivas.',
  },
  {
    icon: ShieldCheck,
    title: 'Perfiles verificados',
    text: 'Identidad, habilidades y reseñas validadas antes de que lleguen a tu lista.',
  },
]

export default function ForCompanies() {
  return (
    <section id="para-empresas" className="relative bg-ink-950 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-violet-400">
              Para reclutadores y empresas
            </span>
            <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
              Contrata más rápido, sin comprometer la calidad
            </h2>
            <p className="mt-4 text-slate-400">
              Ya seas una startup buscando tu primer freelancer o una organización gestionando
              programas de voluntariado, TalentFlow AI adapta cada búsqueda a tu presupuesto y
              tus tiempos.
            </p>

            <div className="mt-8 space-y-5">
              {BENEFITS.map((b) => (
                <div key={b.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                    <b.icon size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{b.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{b.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="#candidatos"
              className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-105"
            >
              Empezar a buscar talento
              <ArrowRight size={16} />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-ink-800 to-ink-900 p-8">
              <p className="text-sm text-slate-400">Presupuesto asignado este mes</p>
              <p className="mt-1 text-4xl font-bold text-white">$4,280</p>
              <div className="mt-6 space-y-4">
                {[
                  { label: 'Freelancers activos', value: '68%', color: 'bg-accent-500' },
                  { label: 'Voluntarios en proyectos', value: '22%', color: 'bg-emerald-400' },
                  { label: 'Presupuesto disponible', value: '10%', color: 'bg-violet-400' },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{row.label}</span>
                      <span>{row.value}</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${row.color}`}
                        style={{ width: row.value }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
