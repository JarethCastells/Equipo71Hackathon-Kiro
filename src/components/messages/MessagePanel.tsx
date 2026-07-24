import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMessages } from '../../hooks/useMessages';
import { useSendMessage } from '../../hooks/useSendMessage';
import type { ConversationSummary } from '../../lib/api';
import MessageComposer from './MessageComposer';
import MessageList from './MessageList';
import MessagesEmptyState from './MessagesEmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface MessagePanelProps {
  conversation: ConversationSummary | null;
  /** Callback para volver a la lista en móvil */
  onBack?: () => void;
}

/**
 * Columna derecha del panel de mensajería.
 *
 * Incluye:
 * - Header con avatar y nombre del otro participante.
 * - Lista de mensajes con scroll, paginación y burbujas.
 * - Indicador "escribiendo…".
 * - Compositor de mensajes.
 *
 * Los mensajes confirmados llegan vía el evento `message:new` del socket
 * y son gestionados íntegramente por `useMessages`.
 */
export default function MessagePanel({ conversation, onBack }: MessagePanelProps) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  const { send, sending } = useSendMessage();

  const { messages, loading, error, hasMore, loadMore, typingUsers } = useMessages(
    conversation?.id ?? null,
  );

  // ── Mapa de participantes ─────────────────────────────────────────────────
  const participantNames: Record<string, string> = {};
  if (user) participantNames[user.id] = user.name;
  if (conversation?.otherParticipant) {
    participantNames[conversation.otherParticipant.id] = conversation.otherParticipant.name;
  }

  // ── Manejar envío ─────────────────────────────────────────────────────────
  const handleSend = useCallback(
    (body: string) => {
      if (!conversation) return;
      send(conversation.id, body);
    },
    [conversation, send],
  );

  // ── Sin conversación seleccionada ────────────────────────────────────────
  if (!conversation) {
    return <MessagesEmptyState noConversations={false} />;
  }

  const { otherParticipant } = conversation;
  const avatarSrc = otherParticipant.avatarUrl ? `${API_URL}${otherParticipant.avatarUrl}` : null;
  const initials = (otherParticipant.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <motion.div
      key={conversation.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className='flex h-full flex-col'>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className='flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3'>
        {/* Botón volver (solo móvil) */}
        {onBack && (
          <button
            type='button'
            onClick={onBack}
            aria-label='Volver'
            className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden'>
            <ArrowLeft size={18} />
          </button>
        )}

        {/* Avatar */}
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={otherParticipant.name}
            className='h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover'
          />
        ) : (
          <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-violet-500 text-xs font-bold text-white'>
            {initials}
          </span>
        )}

        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-semibold text-white'>{otherParticipant.name}</p>
          <p className='truncate text-xs capitalize text-slate-400'>{otherParticipant.role}</p>
        </div>
      </header>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className='shrink-0 border-b border-red-500/20 bg-red-500/10 px-4 py-2'>
          <p className='text-xs text-red-400'>{error}</p>
        </div>
      )}

      {/* ── Lista de mensajes ───────────────────────────────────────────────── */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        participantNames={participantNames}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        typingUserIds={typingUsers}
      />

      {/* ── Compositor ─────────────────────────────────────────────────────── */}
      <MessageComposer conversationId={conversation.id} onSend={handleSend} disabled={sending} />
    </motion.div>
  );
}
