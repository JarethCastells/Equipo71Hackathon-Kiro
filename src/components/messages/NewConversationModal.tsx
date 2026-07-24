import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { createConversation, searchContacts } from '../../lib/api'
import type { Conversation, PublicUser } from '../../lib/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

interface NewConversationModalProps {
  onClose: () => void
  /** Llamado con la conversación creada/recuperada para que el padre la seleccione */
  onConversationReady: (conversation: Conversation) => void
}

/**
 * Modal para iniciar una nueva conversación directa.
 *
 * Permite buscar usuarios por nombre/email usando `searchContacts` e
 * iniciar (o reabrir, si ya existe) un DM idempotente vía `createConversation`.
 *
 * Requisitos: 1.1, 1.2, 1.3, 1.4
 */
export default function NewConversationModal({
  onClose,
  onConversationReady,
}: NewConversationModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PublicUser[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [startingFor, setStartingFor] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Foco automático al montar
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Búsqueda debounced
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearchError(null)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const found = await searchContacts(trimmed)
        setResults(found)
      } catch {
        setSearchError('No se pudo completar la búsqueda. Intenta de nuevo.')
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelectUser = async (user: PublicUser) => {
    if (startingFor) return // ya hay una petición en vuelo
    setStartingFor(user.id)
    setStartError(null)
    try {
      const conversation = await createConversation(user.id)
      onConversationReady(conversation)
      onClose()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No se pudo iniciar la conversación.'
      setStartError(message)
    } finally {
      setStartingFor(null)
    }
  }

  return (
    /* Overlay */
    <motion.div
      key="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Nueva conversación"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-accent-400" />
            <h2 className="text-sm font-semibold text-white">Nueva conversación</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Buscador */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            {searching ? (
              <Loader2 size={15} className="shrink-0 animate-spin text-accent-400" />
            ) : (
              <Search size={15} className="shrink-0 text-slate-500" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-500 transition-colors hover:text-slate-300"
                aria-label="Limpiar búsqueda"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Error al iniciar conversación */}
        <AnimatePresence>
          {startError && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-5 mb-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {startError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Resultados */}
        <div className="max-h-72 overflow-y-auto px-5 pb-5">
          {/* Sin búsqueda activa */}
          {!query.trim() && (
            <p className="py-6 text-center text-xs text-slate-500">
              Escribe un nombre o correo para buscar contactos.
            </p>
          )}

          {/* Error de búsqueda */}
          {searchError && (
            <p className="py-4 text-center text-xs text-rose-400">{searchError}</p>
          )}

          {/* Sin resultados */}
          {!searching && !searchError && query.trim() && results.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">
              No se encontraron usuarios con ese criterio.
            </p>
          )}

          {/* Lista de resultados */}
          <AnimatePresence initial={false}>
            {results.map((user) => (
              <UserResultRow
                key={user.id}
                user={user}
                loading={startingFor === user.id}
                disabled={startingFor !== null}
                onSelect={handleSelectUser}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Sub-componente ───────────────────────────────────────────────────────────

interface UserResultRowProps {
  user: PublicUser
  loading: boolean
  disabled: boolean
  onSelect: (user: PublicUser) => void
}

function UserResultRow({ user, loading, disabled, onSelect }: UserResultRowProps) {
  const avatarSrc = user.avatarUrl ? `${API_URL}${user.avatarUrl}` : null
  const initials = (user.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const roleLabel: Record<string, string> = {
    freelancer: 'Freelancer',
    voluntario: 'Voluntario',
    reclutador: 'Reclutador',
  }

  return (
    <motion.button
      layout
      type="button"
      onClick={() => onSelect(user)}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-60"
    >
      {/* Avatar */}
      <div className="shrink-0">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={user.name}
            className="h-9 w-9 rounded-full border border-white/10 object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-xs font-bold text-white">
            {initials}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-xs text-slate-500">{roleLabel[user.role] ?? user.role}</p>
      </div>

      {/* Spinner o ícono de acción */}
      <div className="shrink-0">
        {loading ? (
          <Loader2 size={15} className="animate-spin text-accent-400" />
        ) : (
          <UserPlus size={15} className="text-slate-600 transition-colors group-hover:text-accent-400" />
        )}
      </div>
    </motion.button>
  )
}
