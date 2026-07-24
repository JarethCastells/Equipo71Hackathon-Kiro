/**
 * SocketContext — conexión socket.io única autenticada con JWT.
 *
 * Demo (consola del navegador):
 *   1. Abre las herramientas de desarrollador.
 *   2. Busca "[Socket] conectado" o "[Socket] evento recibido" en la consola.
 *   3. Desde otra sesión emite un evento y verás el log aquí.
 */
import type { ReactNode } from 'react';
import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'talentflow_token';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      // Sin JWT no intentamos conectar; el socket queda null.
      return;
    }

    // Crea el socket autenticado — el JWT se envía en el handshake (auth.token)
    // para que el servidor lo valide con verifyToken() antes de aceptar la conexión.
    const socket = io(API_URL, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // ── Eventos de ciclo de vida ──────────────────────────────────────────────

    socket.on('connect', () => {
      console.log('[Socket] conectado — id:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] desconectado —', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      // Si el JWT es inválido el servidor rechaza el handshake; el motivo llega aquí.
      console.warn('[Socket] error de conexión —', err.message);
      setConnected(false);
    });

    // ── Demo: escuchar cualquier evento para visibilidad en consola ───────────
    // socket.onAny es útil durante desarrollo para confirmar que los eventos llegan.
    socket.onAny((event: string, ...args: unknown[]) => {
      console.log('[Socket] evento recibido —', event, args);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.offAny();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []); // Solo al montar/desmontar el proveedor

  const value = useMemo<SocketContextValue>(
    () => ({ socket: socketRef.current, connected }),
    // socketRef.current cambia por referencia; re-exponemos cuando connected cambia
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connected],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export { SocketContext };
