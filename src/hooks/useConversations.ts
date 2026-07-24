import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationSummary } from '../lib/api';
import { listConversations } from '../lib/api';
import { useSocket } from './useSocket';

const POLLING_INTERVAL_MS = 30_000;

interface UseConversationsResult {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Carga la bandeja de conversaciones del usuario autenticado.
 *
 * - Carga inicial vía REST.
 * - Se refresca automáticamente cuando llega un evento `conversation:updated`
 *   (socket.io).
 * - Si el socket no está conectado, cae a polling cada 30 s.
 */
export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket, connected } = useSocket();

  // Guardamos si ya realizamos la carga inicial para no mostrar skeleton en refrescos.
  const initialLoadDone = useRef(false);

  const fetch = useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las conversaciones.');
    } finally {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
  }, []);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch();
  }, [fetch]);

  // ── Escuchar eventos del socket para refrescar la bandeja ─────────────────
  // `unread:update`    — nuevo mensaje recibido
  // `conversation:new` — conversación creada por otro usuario
  // `conversation:updated` — cambios de metadatos
  // Al conectarse el socket, también hacemos un fetch para recuperar
  // eventos que pudieran haber llegado durante el handshake.
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      fetch();
    };

    // Fetch inmediato al (re)conectarse para cerrar la ventana de race condition
    socket.on('connect', handler);
    socket.on('unread:update', handler);
    socket.on('conversation:new', handler);
    socket.on('conversation:updated', handler);
    return () => {
      socket.off('connect', handler);
      socket.off('unread:update', handler);
      socket.off('conversation:new', handler);
      socket.off('conversation:updated', handler);
    };
  }, [socket, fetch]);

  // ── Polling fallback cuando el socket no está conectado ────────────────────
  useEffect(() => {
    if (connected) return; // El socket está activo; no necesitamos polling.

    const interval = setInterval(fetch, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [connected, fetch]);

  return { conversations, loading, error, reload: fetch };
}
