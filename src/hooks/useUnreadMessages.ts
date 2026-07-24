import { useCallback, useEffect, useRef, useState } from 'react';
import { getUnreadMessageCount } from '../lib/api';
import { useSocket } from './useSocket';

const POLL_INTERVAL_MS = 30_000;

/**
 * Contador global de mensajes no leídos del usuario en sesión.
 *
 * - Carga inicial: llama `getUnreadMessageCount()` al montar.
 * - Actualización en vivo: escucha `unread:update` del socket y re-fetcha el conteo real.
 *   El servidor emite `{ conversationId }` sin count, así que siempre consultamos la API.
 * - Fallback: polling REST cada 30 s.
 *
 * Requisitos: 6.2, 6.3, 9.2, 9.3
 */
export function useUnreadMessages(): { count: number } {
  const [count, setCount] = useState(0);
  const { socket } = useSocket();
  // Evitar llamadas concurrentes
  const fetchingRef = useRef(false);

  const loadCount = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await getUnreadMessageCount();
      setCount(res.count);
    } catch {
      // Silencioso: el badge mantiene el último valor conocido.
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // ── Carga inicial + polling fallback ───────────────────────────────────────
  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadCount]);

  // ── Actualización en vivo por WebSocket ────────────────────────────────────
  // El servidor emite `unread:update` con { conversationId } cuando llega un
  // mensaje nuevo. Re-fetch el conteo real en lugar de leer el payload.
  useEffect(() => {
    if (!socket) return;

    socket.on('unread:update', loadCount);
    return () => {
      socket.off('unread:update', loadCount);
    };
  }, [socket, loadCount]);

  return { count };
}
