import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Menu, X, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Candidatos', href: '#candidatos' },
  { label: 'Para empresas', href: '#para-empresas' },
  { label: 'Precios', href: '#precios' },
]

export default function Navbar() {
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-ink-950/80 backdrop-blur-md border-b border-white/5' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-violet-500">
            <Sparkles size={18} className="text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight">TalentFlow AI</span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink-950 transition-transform hover:scale-105"
            >
              <LayoutDashboard size={15} />
              Mi dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink-950 transition-transform hover:scale-105"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-white/5 bg-ink-950/95 px-4 pb-6 pt-2 md:hidden"
        >
          <div className="flex flex-col gap-4">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-slate-300 hover:text-white"
              >
                {link.label}
              </a>
            ))}
            {user ? (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2 text-center text-sm font-semibold text-ink-950"
              >
                <LayoutDashboard size={15} />
                Mi dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-slate-300 hover:text-white"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-full bg-white px-5 py-2 text-center text-sm font-semibold text-ink-950"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </motion.div>
      )}
    </header>
  )
}
