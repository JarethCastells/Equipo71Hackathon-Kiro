import { motion } from 'framer-motion'
import type { Message } from '../../lib/api'

interface MessageBubbleProps {
  message: Message
  /** Si `true` la burbuja se alinea a la derecha (mensaje propio). */
  isOwn: boolean
  /** Nombre del emisor para mostrar en mensajes de otros. */
  senderName?: string
  /** Si `true` el mensaje está en estado optimista (aún no confirmado). */
  isOptimistic?: boolean
}

/**
 * Burbuja de mensaje individual.
 *
 * - Mensajes propios: fondo accent, alineados a la derecha.
 * - Mensajes de otros: fondo gris, alineados a la izquierda.
 * - Estado optimista: opacidad reducida y cursor de espera.
 */
export default function MessageBubble({
  message,
  isOwn,
  senderName,
  isOptimistic = false,
}: MessageBubbleProps) {
  const time = new Date(message.createdAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: isOptimistic ? 0.6 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Nombre del emisor (solo para mensajes ajenos) */}
        {!isOwn && senderName && (
          <span className="text-[11px] font-medium text-slate-400 px-1">{senderName}</span>
        )}

        {/* Cuerpo del mensaje */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isOwn
              ? 'rounded-br-sm bg-accent-500 text-white'
              : 'rounded-bl-sm bg-white/[0.07] text-slate-100 border border-white/10'
          } ${isOptimistic ? 'cursor-wait' : ''}`}
        >
          {message.body}
        </div>

        {/* Hora */}
        <span className="text-[10px] text-slate-500 px-1">{time}</span>
      </div>
    </motion.div>
  )
}
