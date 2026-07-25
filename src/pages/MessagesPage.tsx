import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Bell,
  Bot,
  Brain,
  Briefcase,
  CheckCircle2,
  HeartHandshake,
  Lightbulb,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react'

import DashboardLayout from '../components/dashboard/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import {
  analyzeChatWithAI,
  getMessagesThread,
  listConversations,
  sendChatMessage,
  updateMessageNotificationSettings,
  type AIAnalysisResponse,
  type ChatMessage,
  type ConversationSummary,
} from '../lib/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function MessagesPage() {
  const { user, refreshUser } = useAuth()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeTab, setActiveTab] = useState<'freelancers' | 'voluntarios' | 'todos'>('freelancers')
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessageText, setNewMessageText] = useState('')
  const [loadingConv, setLoadingConv] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  // Asistente IA Gemini
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResponse | null>(null)
  const [analyzingAI, setAnalyzingAI] = useState(false)

  // Drawer de preferencias de notificación
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [notifyEmail, setNotifyEmail] = useState(user?.notifyMessagesEmail ?? true)
  const [notifyPhone, setNotifyPhone] = useState(user?.notifyMessagesPhone ?? false)
  const [phone, setPhone] = useState(user?.phoneNumber ?? '')
  const [savingNotif, setSavingNotif] = useState(false)
  const [notifSuccess, setNotifSuccess] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadConversations(cancelled)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedPartnerId) return
    let cancelled = false
    loadMessages(selectedPartnerId, cancelled)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartnerId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async (cancelled = false) => {
    setLoadingConv(true)
    setError(null)
    try {
      const res = await listConversations()
      if (cancelled) return
      setConversations(res.conversations)
      if (res.conversations.length > 0 && !selectedPartnerId) {
        setSelectedPartnerId(res.conversations[0].partnerId)
      }
    } catch {
      if (!cancelled) setError('No se pudieron cargar las conversaciones.')
    } finally {
      if (!cancelled) setLoadingConv(false)
    }
  }

  const loadMessages = async (partnerId: string, cancelled = false) => {
    setLoadingMsgs(true)
    setAiAnalysis(null)
    setError(null)
    try {
      const res = await getMessagesThread(partnerId)
      if (cancelled) return
      setMessages(res.messages)
    } catch {
      if (!cancelled) setError('No se pudo cargar el historial de mensajes.')
    } finally {
      if (!cancelled) setLoadingMsgs(false)
    }
  }

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedPartnerId || !newMessageText.trim()) return

    const textToSend = newMessageText.trim()
    setNewMessageText('')
    setSending(true)
    setSendError(null)

    try {
      const res = await sendChatMessage({ receiverId: selectedPartnerId, message: textToSend })
      setMessages((prev) => [...prev, res.message])
      loadConversations()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.')
      // Re-store the text so user doesn't lose it
      setNewMessageText(textToSend)
    } finally {
      setSending(false)
    }
  }

  const handleAnalyzeAI = async () => {
    if (!selectedPartnerId) return
    setAnalyzingAI(true)

    const currentPartner = conversations.find((c) => c.partnerId === selectedPartnerId)
    const historyPayload = messages.map((m) => ({
      senderName: m.senderId === user?.id ? user.name : currentPartner?.partnerName ?? 'Contacto',
      message: m.message,
    }))

    try {
      const res = await analyzeChatWithAI({
        partnerId: selectedPartnerId,
        conversation: historyPayload,
      })
      setAiAnalysis(res)
    } catch {
      setError('No se pudo analizar la conversación con IA.')
    } finally {
      setAnalyzingAI(false)
    }
  }

  const handleSaveNotifSettings = async (e: FormEvent) => {
    e.preventDefault()
    setSavingNotif(true)
    setNotifSuccess(false)
    try {
      await updateMessageNotificationSettings({
        notifyMessagesEmail: notifyEmail,
        notifyMessagesPhone: notifyPhone,
        phoneNumber: phone.trim(),
      })
      await refreshUser()
      setNotifSuccess(true)
      setTimeout(() => {
        setNotifSuccess(false)
        setNotifModalOpen(false)
      }, 1400)
    } catch {
      setError('No se pudieron guardar las preferencias de notificación.')
    } finally {
      setSavingNotif(false)
    }
  }

  // Filtrado de conversaciones según rol de usuario y pestaña activa
  const isRecruiter = user?.role === 'reclutador'

  const filteredConversations = conversations.filter((c) => {
    if (!isRecruiter) return true
    if (activeTab === 'freelancers') return c.partnerRole === 'freelancer'
    if (activeTab === 'voluntarios') return c.partnerRole === 'voluntario'
    return true
  })

  const selectedPartner = conversations.find((c) => c.partnerId === selectedPartnerId)

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        {/* Encabezado Principal */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-accent-400">
              <MessageSquare size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider">Mensajería Directa IA</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Centro de Mensajes</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Comunícate con tu equipo, candidatos o reclutadores asistido en tiempo real por Gemini AI.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setNotifModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:border-white/20 hover:bg-white/10 hover:text-white transition-all"
          >
            <Bell size={14} className="text-amber-400" />
            Alertas Correo / Teléfono
          </button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => {
                setError(null)
                loadConversations()
              }}
              className="flex items-center gap-1 rounded-full border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
            >
              <RefreshCw size={12} />
              Reintentar
            </button>
          </motion.div>
        )}

        {/* Layout Grid de 3 columnas */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Columna Izquierda: Lista de Conversaciones (4 cols) */}
          <div className="lg:col-span-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
            {/* Tabs para Reclutador */}
            {isRecruiter && (
              <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-ink-950/60 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('freelancers')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                    activeTab === 'freelancers'
                      ? 'bg-gradient-to-r from-accent-500 to-violet-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserCheck size={13} />
                  Freelancers
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('voluntarios')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all ${
                    activeTab === 'voluntarios'
                      ? 'bg-gradient-to-r from-accent-500 to-violet-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <HeartHandshake size={13} />
                  Voluntarios
                </button>
              </div>
            )}

            <div className="space-y-2 candidate-scroll max-h-[600px] overflow-y-auto pr-1">
              {loadingConv && (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-accent-400" />
                  <span className="ml-3 text-sm text-slate-400">Cargando chats...</span>
                </div>
              )}

              {!loadingConv && filteredConversations.length === 0 && (
                <div className="py-12 text-center">
                  <MessageSquare size={24} className="mx-auto text-slate-600" />
                  <p className="mt-2 text-xs text-slate-400">Sin mensajes en esta sección.</p>
                </div>
              )}

              {filteredConversations.map((c) => {
                const isSelected = selectedPartnerId === c.partnerId
                const avatarSrc = c.partnerAvatarUrl ? `${API_URL}${c.partnerAvatarUrl}` : null
                const initials = c.partnerName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <button
                    key={c.partnerId}
                    type="button"
                    onClick={() => setSelectedPartnerId(c.partnerId)}
                    className={`flex w-full items-start gap-3 rounded-2xl p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border border-accent-500/40 bg-gradient-to-r from-accent-500/15 to-violet-500/15 text-white'
                        : 'border border-transparent hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={c.partnerName} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-xs font-bold text-white">
                        {initials}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-xs font-bold text-white">{c.partnerName}</p>
                        <span className="text-[10px] text-slate-500">
                          {new Date(c.lastMessageAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">{c.lastMessage}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium capitalize text-slate-300">
                          {c.partnerRole}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-white">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Columna Centro: Ventana del Chat Activo (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-[650px] rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
            {selectedPartner ? (
              <>
                {/* Cabecera del chat activo */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    {selectedPartner.partnerAvatarUrl ? (
                      <img
                        src={`${API_URL}${selectedPartner.partnerAvatarUrl}`}
                        alt={selectedPartner.partnerName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-xs font-bold text-white">
                        {selectedPartner.partnerName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-white">{selectedPartner.partnerName}</h3>
                      <p className="text-[11px] text-slate-400">
                        {selectedPartner.partnerProfession || selectedPartner.partnerRole}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                    Activo
                  </span>
                </div>

                {/* Stream de mensajes */}
                <div className="flex-1 overflow-y-auto py-4 space-y-3 candidate-scroll pr-1">
                  {loadingMsgs && (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-accent-400" />
                      <span className="ml-3 text-sm text-slate-400">Cargando mensajes...</span>
                    </div>
                  )}

                  {!loadingMsgs && messages.length === 0 && (
                    <div className="py-16 text-center">
                      <MessageSquare size={28} className="mx-auto text-slate-600" />
                      <p className="mt-2 text-xs text-slate-400">Inicia la conversación enviando un mensaje.</p>
                    </div>
                  )}

                  {messages.map((m) => {
                    const isMe = m.senderId === user?.id
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                            isMe
                              ? 'bg-gradient-to-r from-accent-500 to-violet-600 text-white rounded-br-none'
                              : 'bg-slate-800 border border-white/10 text-slate-200 rounded-bl-none'
                          }`}
                        >
                          <p className="leading-relaxed">{m.message}</p>
                          <span className={`mt-1 block text-[9px] text-right ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                            {new Date(m.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Inline error al enviar mensaje */}
                {sendError && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
                    <AlertCircle size={13} className="shrink-0" />
                    {sendError}
                  </div>
                )}

                {/* Formulario para enviar mensaje */}
                <form onSubmit={handleSendMessage} className="mt-2 flex items-center gap-2 pt-2 border-t border-white/10">
                  <input
                    type="text"
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    placeholder="Escribe tu mensaje..."
                    className="flex-1 rounded-full border border-white/10 bg-slate-950/60 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-accent-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessageText.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-accent-500 to-violet-500 text-white shadow-md disabled:opacity-50 hover:scale-105 transition-transform"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Users size={32} className="text-slate-600" />
                <p className="mt-3 text-sm text-slate-400">Selecciona un contacto para chatear.</p>
                <p className="mt-2 text-xs text-slate-500 max-w-xs">
                  Los contactos aparecen aquí cuando un reclutador te escribe o cuando te postulas a una oferta.
                </p>
                <Link
                  to="/dashboard/ofertas"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-md hover:scale-105 transition-transform"
                >
                  <Briefcase size={13} />
                  Ver ofertas
                </Link>
              </div>
            )}
          </div>

          {/* Columna Derecha: Gemini AI Chat Copilot (3 cols) */}
          <div className="lg:col-span-3 rounded-3xl border border-violet-500/30 bg-violet-950/20 p-4 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2 text-violet-400">
              <Sparkles size={16} />
              <h3 className="text-xs font-bold uppercase tracking-wider">Gemini AI Copilot</h3>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              La IA puede analizar esta conversación para asesorarte, redactar sugerencias o guiar tus decisiones.
            </p>

            <button
              type="button"
              disabled={!selectedPartnerId || analyzingAI}
              onClick={handleAnalyzeAI}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-xs font-bold text-violet-300 hover:bg-violet-500/20 disabled:opacity-50 transition-all"
            >
              <Brain size={14} />
              {analyzingAI ? 'Analizando...' : 'Analizar Conversación con IA'}
            </button>

            {aiAnalysis && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 text-xs">
                {/* Resumen */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-400">
                    <Brain size={12} />
                    Resumen Ejecutivo
                  </p>
                  <p className="mt-1.5 text-slate-300 leading-relaxed">{aiAnalysis.analysis}</p>
                </div>

                {/* Respuestas Sugeridas */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <Bot size={12} />
                    Borradores Sugeridos (Haz clic para usar)
                  </p>
                  {aiAnalysis.suggestedReplies.map((reply, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewMessageText(reply)}
                      className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11px] text-slate-300 hover:border-accent-500/50 hover:bg-accent-500/10 hover:text-white transition-all"
                    >
                      "{reply}"
                    </button>
                  ))}
                </div>

                {/* Consejo de Decisión */}
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    <Lightbulb size={12} />
                    Consejo Estratégico
                  </p>
                  <p className="mt-1.5 text-amber-200 leading-relaxed">{aiAnalysis.decisionAdvice}</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Modal de Preferencias de Notificación de Mensajes */}
        <AnimatePresence>
          {notifModalOpen && (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotifModalOpen(false)}
            >
              <motion.div
                className="relative w-full max-w-md rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl"
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setNotifModalOpen(false)}
                  className="absolute right-4 top-4 text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center gap-2 text-amber-400">
                  <Bell size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Alertas de Mensajes</span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-white">Configurar Notificaciones</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Selecciona por dónde deseas recibir avisos cuando te envíen un nuevo mensaje.
                </p>

                <form onSubmit={handleSaveNotifSettings} className="mt-5 space-y-4">
                  {notifSuccess && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 size={16} />
                      ¡Preferencias actualizadas!
                    </div>
                  )}

                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs font-semibold text-slate-200">
                    <span className="flex items-center gap-2">
                      <Mail size={15} className="text-accent-400" />
                      Notificar por Correo Electrónico
                    </span>
                    <input
                      type="checkbox"
                      checked={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-white/10 text-accent-500"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs font-semibold text-slate-200">
                    <span className="flex items-center gap-2">
                      <Phone size={15} className="text-emerald-400" />
                      Notificar por Teléfono / SMS
                    </span>
                    <input
                      type="checkbox"
                      checked={notifyPhone}
                      onChange={(e) => setNotifyPhone(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-white/10 text-emerald-500"
                    />
                  </label>

                  {notifyPhone && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-300">Número Telefónico (SMS)</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+52 55 1234 5678"
                        className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingNotif}
                    className="mt-2 w-full rounded-full bg-gradient-to-r from-accent-500 to-violet-500 py-3 text-xs font-bold text-white shadow-lg disabled:opacity-60"
                  >
                    {savingNotif ? 'Guardando...' : 'Guardar Preferencias'}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
