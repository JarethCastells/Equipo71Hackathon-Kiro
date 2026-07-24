import { Sparkles } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-ink-950 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-violet-500">
            <Sparkles size={15} className="text-white" />
          </span>
          <span className="font-semibold">TalentFlow AI</span>
        </div>
        <p className="text-sm text-slate-500">
          © {new Date().getFullYear()} TalentFlow AI. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}
