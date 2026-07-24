import { MessageSquare } from 'lucide-react'
import { motion } from 'framer-motion'

interface MessagesEmptyStateProps {
  /** Si `true` muestra "sin conversaciones"; si `false` muestra "selecciona una". */
  noConversations?: boolean
}

/**
 * Estado vacío de la bandeja de mensajes.
 *
 * - `noConversations=true` → El usuario aún no tiene ningún chat.
 * - `noConversations=false` (default) → Hay conversaciones pero ninguna seleccionada.
 */
export default function MessagesEmptyState({ noConversations = false }: MessagesEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
        <MessageSquare size={28} className="text-slate-500" />
      </span>

      {noConversations ? (
        <>
          <p className="text-base font-semibold text-white">Sin conversaciones aún</p>
          <p className="max-w-xs text-sm text-slate-400">
            Inicia un chat con otro usuario desde el tablero de ofertas o usando el botón de nuevo mensaje.
          </p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-white">Selecciona una conversación</p>
          <p className="max-w-xs text-sm text-slate-400">
            Elige un chat de la lista para ver los mensajes.
          </p>
        </>
      )}
    </motion.div>
  )
}
