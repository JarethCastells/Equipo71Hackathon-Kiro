import { Search, X } from 'lucide-react'

interface ConversationSearchProps {
  value: string
  onChange: (value: string) => void
}

/**
 * Buscador de conversaciones en la bandeja.
 * Filtra localmente por nombre del otro participante.
 */
export default function ConversationSearch({ value, onChange }: ConversationSearchProps) {
  return (
    <div className="relative">
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar conversaciones…"
        aria-label="Buscar conversaciones"
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-8 text-sm text-white placeholder:text-slate-500 focus:border-accent-500/50 focus:outline-none focus:ring-0"
      />
      {value && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
