import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Pencil, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { Conversation, ConversationSummary } from '../../lib/api';
import ConversationListItem from './ConversationListItem';
import ConversationSearch from './ConversationSearch';
import MessagesEmptyState from './MessagesEmptyState';
import NewConversationModal from './NewConversationModal';

interface ConversationListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
  /** Llamado cuando se crea/recupera un DM para seleccionarlo y recargar la lista */
  onConversationReady?: (conversation: Conversation) => void;
}

/** Skeleton de fila mientras carga */
function ConversationSkeleton() {
  return (
    <div className='flex items-center gap-3 rounded-xl px-3 py-3'>
      <div className='h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/10' />
      <div className='flex-1 space-y-2'>
        <div className='h-3 w-2/3 animate-pulse rounded bg-white/10' />
        <div className='h-2.5 w-1/2 animate-pulse rounded bg-white/[0.06]' />
      </div>
    </div>
  );
}

/**
 * Columna izquierda de la pantalla de mensajes.
 *
 * Incluye: buscador, botón de nueva conversación, lista de conversaciones
 * con estados de carga/error/vacío.
 */
export default function ConversationList({
  conversations,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
  onConversationReady,
}: ConversationListProps) {
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.otherParticipant.name.toLowerCase().includes(query.toLowerCase()),
      )
    : conversations;

  const handleConversationReady = (conversation: Conversation) => {
    onConversationReady?.(conversation);
    onSelect(conversation.id);
  };

  return (
    <div className='flex h-full flex-col gap-3'>
      {/* Modal de nueva conversación */}
      <AnimatePresence>
        {showModal && (
          <NewConversationModal
            onClose={() => setShowModal(false)}
            onConversationReady={handleConversationReady}
          />
        )}
      </AnimatePresence>

      {/* Cabecera */}
      <div className='shrink-0'>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-base font-semibold text-white'>Mensajes</h2>
          <button
            type='button'
            onClick={() => setShowModal(true)}
            className='flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-slate-400 transition-colors hover:border-accent-500/40 hover:bg-accent-500/10 hover:text-accent-400'
            title='Nueva conversación'
            aria-label='Nueva conversación'>
            <Pencil size={14} />
          </button>
        </div>
        <ConversationSearch value={query} onChange={setQuery} />
      </div>

      {/* Cuerpo */}
      <div className='flex-1 overflow-y-auto space-y-1 pr-1 candidate-scroll'>
        {/* Estado de carga */}
        {loading && (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <ConversationSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Estado de error */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='flex flex-col items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-5 text-center'>
            <AlertCircle size={20} className='text-rose-400' />
            <p className='text-sm text-rose-300'>{error}</p>
            <button
              type='button'
              onClick={onRetry}
              className='flex items-center gap-1.5 rounded-full border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/10'>
              <RefreshCw size={12} />
              Reintentar
            </button>
          </motion.div>
        )}

        {/* Estado vacío */}
        {!loading && !error && filtered.length === 0 && (
          <MessagesEmptyState noConversations={conversations.length === 0} />
        )}

        {/* Lista de conversaciones */}
        {!loading && !error && filtered.length > 0 && (
          <AnimatePresence initial={false}>
            {filtered.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                selected={conv.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
