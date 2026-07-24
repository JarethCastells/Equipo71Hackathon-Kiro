import { motion } from 'framer-motion'
import type { ConversationSummary } from '../../lib/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

interface ConversationListItemProps {
  conversation: ConversationSummary
  selected: boolean
  onSelect: (id: string) => void
}

/** Formatea una fecha ISO como hora corta si es hoy, o como fecha si es anterior. */
function formatTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

/**
 * Fila de conversación en la bandeja.
 *
 * Muestra: avatar, nombre, preview del último mensaje, hora y badge de no leídos.
 */
export default function ConversationListItem({
  conversation,
  selected,
  onSelect,
}: ConversationListItemProps) {
  const { otherParticipant, lastMessage, unreadCount, lastMessageAt } = conversation

  const avatarSrc = otherParticipant.avatarUrl
    ? `${API_URL}${otherParticipant.avatarUrl}`
    : null

  const initials = (otherParticipant.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const preview = lastMessage?.body ?? 'Sin mensajes aún'

  return (
    <motion.button
      layout
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
        selected
          ? 'bg-accent-500/10 border border-accent-500/30'
          : 'border border-transparent hover:bg-white/[0.04]'
      }`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={otherParticipant.name}
            className="h-10 w-10 rounded-full border border-white/10 object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-xs font-bold text-white">
            {initials}
          </span>
        )}
        {/* Badge de no leídos sobreimpuesto en el avatar */}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>

      {/* Cuerpo */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`truncate text-sm font-semibold ${
              selected ? 'text-white' : 'text-slate-100'
            }`}
          >
            {otherParticipant.name}
          </p>
          <span className="shrink-0 text-[11px] text-slate-500">
            {formatTime(lastMessageAt)}
          </span>
        </div>
        <p
          className={`mt-0.5 truncate text-xs ${
            unreadCount > 0 ? 'font-medium text-slate-300' : 'text-slate-500'
          }`}
        >
          {preview}
        </p>
      </div>
    </motion.button>
  )
}
