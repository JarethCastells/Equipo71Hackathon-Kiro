import { motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Message } from '../../lib/api';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  /** Mapa de userId → nombre para mostrar en burbujas ajenas */
  participantNames: Record<string, string>;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  typingUserIds: string[];
  /** IDs de mensajes optimistas (aún no confirmados) */
  optimisticIds?: string[];
}

/**
 * Lista de mensajes con scroll invertido y paginación hacia arriba.
 *
 * - Hace scroll automático al último mensaje al cargar o recibir uno nuevo.
 * - El botón "Cargar más" aparece en la parte superior si hay historial anterior.
 * - Las burbujas propias se alinean a la derecha; las ajenas, a la izquierda.
 */
export default function MessageList({
  messages,
  currentUserId,
  participantNames,
  loading,
  hasMore,
  onLoadMore,
  typingUserIds,
  optimisticIds = [],
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const prevMessageCountRef = useRef(0);

  // Nombre de usuarios que escriben (IDs → nombres)
  const typingNames = typingUserIds
    .filter((id) => id !== currentUserId)
    .map((id) => participantNames[id] ?? 'Alguien');

  // ── Scroll al último mensaje cuando llegan mensajes nuevos ───────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const prevCount = prevMessageCountRef.current;
    const currCount = messages.length;

    // Si la cantidad subió por el final (mensaje nuevo), hacemos scroll al fondo.
    if (currCount > prevCount) {
      const lastMsg = messages[messages.length - 1];
      const isNewFromBottom = prevCount === 0 || lastMsg?.id !== messages[prevCount - 1]?.id;

      if (isNewFromBottom || prevCount === 0) {
        bottomRef.current?.scrollIntoView({ behavior: prevCount === 0 ? 'instant' : 'smooth' });
      }
    }

    prevMessageCountRef.current = currCount;
  }, [messages]);

  // ── Preservar posición de scroll al cargar historial anterior ────────────
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const prevHeight = prevScrollHeightRef.current;

    if (prevHeight > 0) {
      const newScrollTop = container.scrollHeight - prevHeight;
      container.scrollTop = newScrollTop;
      prevScrollHeightRef.current = 0;
    }
  }, [messages.length]);

  const handleLoadMore = () => {
    if (containerRef.current) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
    }
    onLoadMore();
  };

  // ── Skeleton de carga ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className='flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`h-8 rounded-2xl bg-white/[0.06] animate-pulse ${
                i % 2 === 0 ? 'w-40' : 'w-56'
              }`}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className='flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4 scroll-smooth'>
      {/* Botón "Cargar más" */}
      {hasMore && (
        <div className='flex justify-center pb-2'>
          <button
            type='button'
            onClick={handleLoadMore}
            className='rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-200'>
            Cargar mensajes anteriores
          </button>
        </div>
      )}

      {/* Estado vacío */}
      {messages.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className='py-8 text-center text-sm text-slate-500'>
          Aún no hay mensajes. ¡Empieza la conversación!
        </motion.p>
      )}

      {/* Burbujas de mensajes */}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={msg.senderId === currentUserId}
          senderName={participantNames[msg.senderId]}
          isOptimistic={optimisticIds.includes(msg.id)}
        />
      ))}

      {/* Indicador "escribiendo…" */}
      <TypingIndicator names={typingNames} />

      {/* Ancla al fondo para auto-scroll */}
      <div ref={bottomRef} />
    </div>
  );
}
