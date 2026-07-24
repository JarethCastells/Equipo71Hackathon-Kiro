/**
 * realtime.ts — Capa WebSocket con socket.io para mensajería directa en tiempo real.
 *
 * initRealtime(httpServer) configura el servidor socket.io con:
 *  - Handshake autenticado con JWT (verifyToken). Req 8.1.
 *  - CORS alineado a CLIENT_URL. Req 8.4.
 *  - Sala personal user:<userId> al conectar. Req 8.3.
 *  - Eventos: conversation:join/leave, message:send, message:read, typing.
 *  - Rate limit en message:send (en memoria). Req 4.5.
 *  - Broadcast message:new y unread:update. Req 4.1, 6.2, 6.3, 8.3.
 *
 * Cumple Requisitos: 4.1, 4.4, 5.1, 5.2, 5.3, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4.
 */

import type { RowDataPacket } from 'mysql2';
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { verifyToken } from './auth.js';
import { isMember } from './conversationStore.js';
import pool from './db.js';
import { postMessage } from './messageService.js';
import { markRead } from './messageStore.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuthenticatedSocket extends Socket {
  userId: string;
  email: string;
}

// ─── Rate limiter en memoria ──────────────────────────────────────────────────

/** Límite de mensajes por usuario en la ventana de tiempo. */
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Devuelve true si el usuario ha superado el rate limit de envío.
 */
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

// ─── Helpers de emisión ───────────────────────────────────────────────────────

let _io: Server | null = null;

/**
 * Emite message:new a la sala de conversación y unread:update a la sala del receptor.
 * Req 4.1, 6.2, 6.3, 8.3.
 */
export function emitMessage(
  conversationId: string,
  message: unknown,
  recipientIds: string[],
): void {
  if (!_io) return;
  _io.to(`conversation:${conversationId}`).emit('message:new', message);
  for (const recipientId of recipientIds) {
    _io.to(`user:${recipientId}`).emit('unread:update', { conversationId });
  }
}

/**
 * Emite message:read a la sala de conversación.
 * Req 5.3.
 */
export function emitRead(conversationId: string, userId: string): void {
  if (!_io) return;
  _io.to(`conversation:${conversationId}`).emit('message:read', { conversationId, userId });
}

/**
 * Emite unread:update a la sala personal del usuario.
 * Req 6.3.
 */
export function emitUnread(userId: string, conversationId: string): void {
  if (!_io) return;
  _io.to(`user:${userId}`).emit('unread:update', { conversationId });
}

/**
 * Emite conversation:new a la sala personal del receptor cuando se inicia
 * una conversación nueva. Permite que el receptor refresque su bandeja sin polling.
 */
export function emitConversationNew(recipientId: string, conversationId: string): void {
  if (!_io) return;
  _io.to(`user:${recipientId}`).emit('conversation:new', { conversationId });
}

// ─── Helpers internos ────────────────────────────────────────────────────────

interface MemberRow extends RowDataPacket {
  user_id: string;
}

/**
 * Obtiene los IDs de todos los miembros de una conversación excepto el emisor.
 */
async function getOtherMemberIds(conversationId: string, excludeUserId: string): Promise<string[]> {
  const [rows] = await pool.query<MemberRow[]>(
    'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
    [conversationId, excludeUserId],
  );
  return rows.map((r) => r.user_id);
}

// ─── initRealtime ─────────────────────────────────────────────────────────────

/**
 * Inicializa el servidor socket.io adjunto al httpServer dado.
 * Debe llamarse una sola vez desde index.ts.
 */
export function initRealtime(httpServer: HttpServer): Server {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const io = new Server(httpServer, {
    cors: {
      origin: clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  _io = io;

  // ── Middleware de handshake: validar JWT ────────────────────────────────────
  // Req 8.1: verificar JWT en el handshake; rechazar si es inválido.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      next(new Error('Autenticación requerida'));
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      next(new Error('Token inválido o expirado'));
      return;
    }

    const authedSocket = socket as AuthenticatedSocket;
    authedSocket.userId = payload.sub;
    authedSocket.email = payload.email;
    next();
  });

  // ── Manejadores de conexión ────────────────────────────────────────────────
  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId } = socket;

    // Unirse a la sala personal para badges y avisos cruzados. Req 8.3.
    socket.join(`user:${userId}`);

    // ── conversation:join ──────────────────────────────────────────────────
    // Req 8.2: validar membresía antes de permitir unirse a la sala.
    socket.on('conversation:join', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data ?? {};
        if (!conversationId || typeof conversationId !== 'string') {
          socket.emit('error', { message: 'conversationId inválido' });
          return;
        }

        const member = await isMember(conversationId, userId);
        if (!member) {
          socket.emit('error', { message: 'No tienes acceso a esta conversación' });
          return;
        }

        socket.join(`conversation:${conversationId}`);
      } catch (err) {
        console.error('[realtime] conversation:join error:', err);
        socket.emit('error', { message: 'Error al unirse a la conversación' });
      }
    });

    // ── conversation:leave ─────────────────────────────────────────────────
    socket.on('conversation:leave', (data: { conversationId: string }) => {
      const { conversationId } = data ?? {};
      if (conversationId && typeof conversationId === 'string') {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // ── message:send ───────────────────────────────────────────────────────
    // Req 4.1, 4.5, 8.2, 8.3.
    socket.on(
      'message:send',
      async (data: { conversationId: string; body: string }, ack?: (res: unknown) => void) => {
        try {
          const { conversationId, body } = data ?? {};

          // Validar parámetros básicos
          if (!conversationId || typeof conversationId !== 'string') {
            const err = { error: 'conversationId inválido' };
            ack ? ack(err) : socket.emit('error', err);
            return;
          }

          // Rate limit. Req 4.5.
          if (isRateLimited(userId)) {
            const err = { error: 'Has superado el límite de mensajes. Espera unos minutos.' };
            ack ? ack(err) : socket.emit('error', err);
            return;
          }

          // Validar membresía. Req 8.2.
          const member = await isMember(conversationId, userId);
          if (!member) {
            const err = { error: 'No tienes acceso a esta conversación' };
            ack ? ack(err) : socket.emit('error', err);
            return;
          }

          // Persistir mensaje y ejecutar efectos secundarios. Req 4.1.
          const message = await postMessage({ conversationId, senderId: userId, body });

          // Broadcast message:new a la sala de la conversación. Req 8.3.
          io.to(`conversation:${conversationId}`).emit('message:new', message);

          // Emitir unread:update a cada otro miembro. Req 6.2, 6.3.
          const otherIds = await getOtherMemberIds(conversationId, userId);
          for (const recipientId of otherIds) {
            io.to(`user:${recipientId}`).emit('unread:update', { conversationId });
          }

          // Confirmar al emisor (si usa ack).
          ack && ack({ ok: true, message });
        } catch (err) {
          console.error('[realtime] message:send error:', err);
          const errorMsg = err instanceof Error ? err.message : 'Error al enviar el mensaje';
          const errorObj = { error: errorMsg };
          ack ? ack(errorObj) : socket.emit('error', errorObj);
        }
      },
    );

    // ── message:read ────────────────────────────────────────────────────────
    // Req 5.3, 6.1.
    socket.on('message:read', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data ?? {};
        if (!conversationId || typeof conversationId !== 'string') {
          socket.emit('error', { message: 'conversationId inválido' });
          return;
        }

        const member = await isMember(conversationId, userId);
        if (!member) {
          socket.emit('error', { message: 'No tienes acceso a esta conversación' });
          return;
        }

        await markRead(conversationId, userId);

        // Notificar a la sala de la conversación. Req 5.3.
        io.to(`conversation:${conversationId}`).emit('message:read', {
          conversationId,
          userId,
        });
      } catch (err) {
        console.error('[realtime] message:read error:', err);
        socket.emit('error', { message: 'Error al marcar como leído' });
      }
    });

    // ── typing ──────────────────────────────────────────────────────────────
    // Req 5.1, 5.2.
    socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      const { conversationId, isTyping } = data ?? {};
      if (!conversationId || typeof conversationId !== 'string') return;

      // Retransmitir a todos en la sala excepto al emisor. Req 5.1.
      socket.to(`conversation:${conversationId}`).emit('typing', {
        conversationId,
        userId,
        isTyping: Boolean(isTyping),
      });
    });

    // ── desconexión ─────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      // socket.io limpia las salas automáticamente al desconectar
      void reason;
    });
  });

  console.log('[realtime] Servidor socket.io iniciado');
  return io;
}
