import { useCallback, useRef, useState } from 'react';
import { sendMessage } from '../lib/api';
import { useSocket } from './useSocket';

interface UseSendMessageResult {
  send: (conversationId: string, body: string) => Promise<void>;
  sending: boolean;
  error: string | null;
}

/**
 * Envía un mensaje por WebSocket con fallback REST.
 *
 * Flujo:
 * 1. Intenta emitir `message:send` por socket.
 * 2. Si el socket no está disponible o falla, cae a `POST /api/conversations/:id/messages`.
 * 3. El evento `message:new` que llega desde el servidor es gestionado por `useMessages`,
 *    que actualiza la lista de mensajes confirmados. No se usa mensajería optimista.
 */
export function useSendMessage(): UseSendMessageResult {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket, connected } = useSocket();

  // Evitar envíos simultáneos del mismo mensaje
  const inFlightRef = useRef(false);

  const send = useCallback(
    async (conversationId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      setSending(true);
      setError(null);

      try {
        if (connected && socket) {
          // ── Camino principal: WebSocket ──────────────────────────────────
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Tiempo de espera del socket agotado'));
            }, 8000);

            socket.emit(
              'message:send',
              { conversationId, body: trimmed },
              (ack: { ok: boolean; error?: string }) => {
                clearTimeout(timeout);
                if (ack?.ok) {
                  resolve();
                } else {
                  reject(new Error(ack?.error ?? 'Error al enviar por socket'));
                }
              },
            );
          });
        } else {
          // ── Fallback: REST ───────────────────────────────────────────────
          await sendMessage(conversationId, trimmed);
        }
      } catch (socketErr) {
        // El socket falló; intentar por REST como fallback
        if (connected && socket) {
          try {
            await sendMessage(conversationId, trimmed);
          } catch (restErr) {
            setError(restErr instanceof Error ? restErr.message : 'No se pudo enviar el mensaje.');
          }
        } else {
          setError(
            socketErr instanceof Error ? socketErr.message : 'No se pudo enviar el mensaje.',
          );
        }
      } finally {
        setSending(false);
        inFlightRef.current = false;
      }
    },
    [socket, connected],
  );

  return { send, sending, error };
}
