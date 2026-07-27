import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Send, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, sendAssistantMessage, type AssistantChatMessage } from '../../lib/api'

interface DisplayMessage extends AssistantChatMessage {
  id: string
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const WELCOME_MESSAGE =
  '¡Hola! Soy el Asistente IA de TalentFlow AI. Puedo ayudarte con dudas sobre ofertas, postulaciones, tu CV o el proceso de contratación. ¿En qué te ayudo?'

/**
 * Chat flotante con el Asistente IA, disponible en todo el dashboard.
 *
 * - Texto: envía mensajes a POST /api/assistant/message (Gemini con fallback
 *   heurístico si no hay GEMINI_API_KEY configurada en el servidor).
 * - El historial de la conversación vive solo en memoria del componente: no
 *   se persiste en base de datos ni sobrevive a un refresco de página.
 */
export default function AIAssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([
    { id: createId(), role: 'assistant', content: WELCOME_MESSAGE },
  ])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al último mensaje.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isSending) return

    setError(null)
    const userMsg: DisplayMessage = { id: createId(), role: 'user', content: text }
    const history = messages.map(({ role, content }) => ({ role, content }))

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsSending(true)

    try {
      const { reply } = await sendAssistantMessage({ message: text, history })
      const assistantMsg: DisplayMessage = { id: createId(), role: 'assistant', content: reply }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo contactar al asistente. Intenta de nuevo.'
      setError(msg)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      {/* Botón flotante — solo visible cuando el chat está cerrado */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente IA"
          style={{ bottom: 'max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))' }}
          className="fixed right-4 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-white shadow-2xl shadow-accent-500/30 transition-transform hover:scale-105 sm:right-5"
        >
          <Bot size={24} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="false"
            aria-label="Asistente IA de TalentFlow AI"
            style={{ bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}
            className="fixed inset-x-3 top-3 z-[90] flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-2xl sm:inset-x-auto sm:top-auto sm:bottom-5 sm:right-5 sm:h-[min(680px,80vh)] sm:w-[380px] md:w-[400px] lg:h-[min(760px,85vh)] lg:w-[420px]"
          >
            {/* Encabezado */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-accent-500/10 to-violet-500/10 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500">
                  <Sparkles size={16} className="text-white" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Asistente IA</p>
                  <p className="text-[11px] text-slate-400">TalentFlow AI · Gemini</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar asistente IA"
                title="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="candidate-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'rounded-br-sm bg-accent-500 text-white'
                        : 'rounded-bl-sm border border-white/10 bg-white/[0.05] text-slate-100'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.05] px-4 py-2.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:0.15s]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:0.3s]" />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="px-4 pb-1 text-[11px] text-rose-400">{error}</p>
            )}

            {/* Composer */}
            <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-white/10 p-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu mensaje..."
                disabled={isSending}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent-500 disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={isSending || input.trim().length === 0}
                aria-label="Enviar mensaje"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-white disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
