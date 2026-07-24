import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '../lib/api';
import { listMessages, markConversationRead } from '../lib/api';
import { useSocket } from './useSocket';

const PAGE_SIZE = 30;
const POLLING_INTERVAL_MS = 30_000;

interface UseMessagesResult {
  messages: Message[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  typingUsers: string[]; // IDs de usuarios que están escribiendo
}

/**
 * Carga el historial de mensajes de una conversación y mantiene sincronía en tiempo real.
 *
 * - Carga inicial vía REST (mensajes más recientes).
 * - Escucha `message:new` para añadir mensajes en tiempo real.
 * - Escucha `typing` para mostrar el indicador "escribiendo…".
 * - Escucha `message:read` para notificación en vivo.
 * - Llama `markRead` al abrir la conversación y cuando la ventana recupera el foco.
 * - Si el socket no está conectado, hace polling cada 30 s.
 */
export function useMessages(conversationId: string | null): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const { socket, connected } = useSocket();

  // Evitar cargas simultáneas de "cargar más"
  const loadingMoreRef = useRef(false);
  // Guardamos el conversationId activo para limpiar estado al cambiar
  const activeConversationRef = useRef<string | null>(null);

  // Temporizadores para limpiar el estado "escribiendo…"
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Marcar como leído ─────────────────────────────────────────────────────
  const markRead = useCallback(async (convId: string) => {
    try {
      await markConversationRead(convId);
    } catch {
      // Los fallos de markRead son silenciosos; no interrumpen la UX.
    }
  }, []);

  // ── Carga inicial de mensajes ─────────────────────────────────────────────
  const loadInitial = useCallback(
    async (convId: string) => {
      setLoading(true);
      setError(null);
      setMessages([]);
      setNextCursor(null);
      setHasMore(false);
      setTypingUsers([]);

      try {
        const { messages: msgs, nextCursor: cursor } = await listMessages(convId, {
          limit: PAGE_SIZE,
        });
        setMessages([...msgs].reverse());
        setNextCursor(cursor);
        setHasMore(cursor !== null);
        // Marcar como leído al abrir
        await markRead(convId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los mensajes.');
      } finally {
        setLoading(false);
      }
    },
    [markRead],
  );

  // ── Cargar más (historial anterior) ──────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!conversationId || !nextCursor || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    try {
      const { messages: olderMsgs, nextCursor: cursor } = await listMessages(conversationId, {
        before: nextCursor,
        limit: PAGE_SIZE,
      });
      setMessages((prev) => [...[...olderMsgs].reverse(), ...prev]);
      setNextCursor(cursor);
      setHasMore(cursor !== null);
    } catch {
      // Silencioso; el usuario puede reintentar pulsando "Cargar más"
    } finally {
      loadingMoreRef.current = false;
    }
  }, [conversationId, nextCursor]);

  // ── Reacción al cambio de conversación ───────────────────────────────────
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      setNextCursor(null);
      setHasMore(false);
      setTypingUsers([]);
      activeConversationRef.current = null;
      return;
    }

    activeConversationRef.current = conversationId;
    loadInitial(conversationId);
  }, [conversationId, loadInitial]);

  // ── Unirse a la sala de conversación vía socket ──────────────────────────
  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit('conversation:join', { conversationId });

    return () => {
      socket.emit('conversation:leave', { conversationId });
    };
  }, [socket, conversationId]);

  // ── Eventos en tiempo real ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleNewMessage = (msg: Message) => {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) => {
        // Evitar duplicados (el envío optimista ya pudo añadirlo)
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Marcar como leído si esta es la conversación activa
      if (activeConversationRef.current === conversationId) {
        markRead(conversationId);
      }
    };

    const handleTyping = ({
      userId,
      conversationId: convId,
    }: {
      userId: string;
      conversationId: string;
    }) => {
      if (convId !== conversationId) return;

      setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));

      // Limpiar el indicador si no llega otro evento en 3 s
      const existing = typingTimers.current.get(userId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
        typingTimers.current.delete(userId);
      }, 3000);

      typingTimers.current.set(userId, timer);
    };

    const handleMessageRead = ({ conversationId: convId }: { conversationId: string }) => {
      // Podríamos actualizar recibos de lectura aquí en el futuro
      if (convId !== conversationId) return;
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('message:read', handleMessageRead);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('message:read', handleMessageRead);
    };
  }, [socket, conversationId, markRead]);

  // ── Marcar leído al recuperar el foco de la ventana ─────────────────────
  useEffect(() => {
    if (!conversationId) return;

    const handleFocus = () => {
      if (activeConversationRef.current === conversationId) {
        markRead(conversationId);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [conversationId, markRead]);

  // ── Polling fallback cuando el socket no está conectado ──────────────────
  useEffect(() => {
    if (connected || !conversationId) return;

    const poll = async () => {
      try {
        const { messages: msgs, nextCursor: cursor } = await listMessages(conversationId, {
          limit: PAGE_SIZE,
        });
        setMessages((prev) => {
          const reversed = [...msgs].reverse();
          const existingIds = new Set(prev.map((m) => m.id));
          const newOnly = reversed.filter((m) => !existingIds.has(m.id));
          const all = [...prev, ...newOnly];
          all.sort((a, b) => {
            const t = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return t !== 0 ? t : a.id.localeCompare(b.id);
          });
          const seen = new Set<string>();
          return all.filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
        });
        setNextCursor(cursor);
        setHasMore(cursor !== null);
      } catch {
        // Silencioso en polling
      }
    };

    const interval = setInterval(poll, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [connected, conversationId]);

  // ── Limpiar temporizadores al desmontar ──────────────────────────────────
  useEffect(() => {
    return () => {
      typingTimers.current.forEach((t) => clearTimeout(t));
      typingTimers.current.clear();
    };
  }, []);

  return { messages, loading, error, hasMore, loadMore, typingUsers };
}
