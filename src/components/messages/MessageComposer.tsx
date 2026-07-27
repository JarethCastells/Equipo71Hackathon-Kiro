import { useCallback, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useSocket } from '../../hooks/useSocket'

const MAX_LENGTH = 2000

interface MessageComposerProps {
  conversationId: string
  onSend: (body: string) => void
  disabled?: boolean
}

/**
 * Área de composición de mensajes.
 *
 * - Enter envía; Shift+Enter añade salto de línea.
 * - Emite evento `typing` por socket mientras el usuario escribe.
 * - Bloquea el envío de mensajes vacíos o que exceden `MAX_LENGTH`.
 */
export default function MessageComposer({
  conversationId,
  onSend,
  disabled = false,
}: MessageComposerProps) {
  const [body, setBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { socket } = useSocket()

  // Throttle del evento typing: no enviamos más de uno por segundo
  const lastTypingEmit = useRef(0)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      if (value.length > MAX_LENGTH) return
      setBody(value)

      // Emitir evento typing con throttle de 1 s
      const now = Date.now()
      if (socket && now - lastTypingEmit.current > 1000) {
        socket.emit('typing', { conversationId })
        lastTypingEmit.current = now
      }

      // Ajustar altura del textarea automáticamente
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
      }
    },
    [socket, conversationId],
  )

  const handleSubmit = useCallback(() => {
    const trimmed = body.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setBody('')
    // Restablecer la altura del textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [body, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const canSend = body.trim().length > 0 && !disabled

  return (
    <div className="flex items-end gap-2 border-t border-white/10 bg-ink-900/80 px-4 py-3">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Escribe un mensaje…"
        rows={1}
        className={`min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-accent-500/50 focus:ring-0 ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        }`}
        style={{ minHeight: '44px', maxHeight: '160px' }}
      />

      {/* Contador de caracteres cuando se acerca al límite */}
      {body.length > MAX_LENGTH * 0.8 && (
        <span
          className={`shrink-0 text-[11px] ${
            body.length >= MAX_LENGTH ? 'text-red-400' : 'text-slate-500'
          }`}
        >
          {body.length}/{MAX_LENGTH}
        </span>
      )}

      {/* Botón de enviar */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSend}
        aria-label="Enviar mensaje"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
          canSend
            ? 'bg-accent-500 text-white hover:bg-accent-600 active:scale-95'
            : 'bg-white/[0.05] text-slate-600 cursor-not-allowed'
        }`}
      >
        <Send size={16} />
      </button>
    </div>
  )
}
