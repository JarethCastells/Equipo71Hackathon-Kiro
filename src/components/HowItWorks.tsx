import { motion } from 'framer-motion'
import { Target, Sliders, Users2, MessageSquareText } from 'lucide-react'

const STEPS = [
  {
    icon: Target,
    title: 'Describe tu proyecto',
    text: 'Cuéntanos qué necesitas: rol, habilidades clave y presupuesto disponible.',
  },
  {
    icon: Sliders,
    title: 'La IA ajusta las coincidencias',
    text: 'Nuestro motor analiza miles de perfiles y prioriza a quienes mejor se adaptan a tu presupuesto.',
  },
  {
    icon: Users2,
    title: 'Revisa candidatos al instante',
    text: 'La lista se actualiza en vivo. Filtra, compara y descarta con un clic.',
  },
  {
    icon: MessageSquareText,
    title: 'Conecta y decide',
    text: 'Preselecciona, chatea y cierra el acuerdo directamente en la plataforma.',
  },
]

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="relative bg-ink-900 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Cómo funciona</h2>
          <p className="mt-4 text-slate-400">
            De la publicación al acuerdo final, en minutos y sin fricción.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-violet-500">
                <step.icon size={20} className="text-white" />
              </div>
              <span className="mt-4 block text-xs font-semibold text-accent-400">
                Paso {i + 1}
              </span>
              <h3 className="mt-1 text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
