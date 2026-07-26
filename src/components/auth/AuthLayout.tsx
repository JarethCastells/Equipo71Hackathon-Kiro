import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ShieldCheck, Zap, Users } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: Zap, text: 'Matches con IA en segundos, ajustados a tu presupuesto' },
  { icon: ShieldCheck, text: 'Perfiles verificados de freelancers y voluntarios' },
  { icon: Users, text: '+12,400 talentos activos en la plataforma' },
]

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

/**
 * Layout compartido por Login/Signup: panel de marca a la izquierda (oculto
 * en móvil) + formulario a la derecha. Mantiene la identidad visual del resto
 * del sitio (fondo oscuro, acentos accent/violet, tipografía Inter).
 */
export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-ink-950">
      {/* Panel de marca */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-12 lg:flex">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />

        <Link to="/" className="relative z-10 flex items-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-violet-500">
            <Sparkles size={18} className="text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight">TalentFlow AI</span>
        </Link>

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="max-w-md text-3xl font-bold leading-tight text-white">
            Conecta con el talento correcto, sin salirte de tu presupuesto.
          </h2>
          <div className="mt-10 space-y-5">
            {HIGHLIGHTS.map((item) => (
              <div key={item.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <item.icon size={15} className="text-accent-400" />
                </span>
                <p className="text-sm text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} TalentFlow AI. Todos los derechos reservados.
        </p>
      </div>

      {/* Panel de formulario */}
      <div className="flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to="/" className="mb-8 flex items-center gap-2 text-white lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-violet-500">
              <Sparkles size={15} className="text-white" />
            </span>
            <span className="text-base font-bold tracking-tight">TalentFlow AI</span>
          </Link>

          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-400">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </div>
  )
}
