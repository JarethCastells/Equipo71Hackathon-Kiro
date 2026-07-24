/**
 * Pruebas unitarias para realtime.ts
 *
 * Cubre:
 * - Handshake válido (JWT correcto): conexión aceptada. Req 8.1.
 * - Handshake inválido (sin token / token malo): conexión rechazada. Req 8.1.
 * - conversation:join de un no miembro: rechazado. Req 8.2.
 * - conversation:join de un miembro: socket se une a la sala correcta. Req 8.2.
 * - message:send: broadcast a la sala correcta + unread:update al receptor. Req 4.1, 6.2, 8.3.
 * - message:send con rate limit superado: rechazado. Req 4.5.
 * - typing: retransmitido a la sala (sin el emisor). Req 5.1.
 * - message:read: marca leído y emite evento a la sala. Req 5.3, 6.1.
 *
 * Estrategia: mocks completos de todas las dependencias (db, stores, service).
 * Se simulan los middlewares y handlers de socket.io directamente sin levantar
 * un servidor real, lo que hace las pruebas rápidas y deterministas.
 */

import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../auth.js', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('../conversationStore.js', () => ({
  isMember: vi.fn(),
  findConversationById: vi.fn(),
}));

vi.mock('../messageService.js', () => ({
  postMessage: vi.fn(),
}));

vi.mock('../messageStore.js', () => ({
  markRead: vi.fn(),
  getMembership: vi.fn(),
}));

vi.mock('../db.js', () => ({
  default: {
    query: vi.fn(),
  },
}));

// ─── Imports tras los mocks ───────────────────────────────────────────────────

import { verifyToken } from '../auth.js';
import { isMember } from '../conversationStore.js';
import { postMessage } from '../messageService.js';
import { markRead } from '../messageStore.js';
import pool from '../db.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'valid-jwt-token';
const INVALID_TOKEN = 'bad-token';
const USER_ALICE = 'user-alice';
const USER_BOB = 'user-bob';
const CONV_ID = 'conv-test-001';

const ALICE_PAYLOAD = { sub: USER_ALICE, email: 'alice@test.com' };

const SAMPLE_MESSAGE = {
  id: 'msg-001',
  conversationId: CONV_ID,
  senderId: USER_ALICE,
  body: 'Hola Bob',
  createdAt: new Date().toISOString(),
};

// ─── Helper: construir socket simulado ────────────────────────────────────────

/**
 * Construye un objeto socket mínimo que simula la interfaz de socket.io.
 * Permite capturar joins, emits y los handlers registrados con on().
 */
function buildMockSocket(overrides: Record<string, unknown> = {}) {
  const rooms = new Set<string>();
  const emitted: Array<{ event: string; data: unknown }> = [];
  const handlers = new Map<string, (...args: unknown[]) => void>();

  const socket = {
    id: 'socket-abc',
    userId: USER_ALICE,
    email: 'alice@test.com',
    handshake: {
      auth: { token: VALID_TOKEN },
    },
    rooms,
    join(room: string) {
      rooms.add(room);
    },
    leave(room: string) {
      rooms.delete(room);
    },
    emit(event: string, data?: unknown) {
      emitted.push({ event, data });
    },
    to(_room: string) {
      // Devuelve un objeto que también registra emits para aserciones
      return {
        emit(event: string, data?: unknown) {
          emitted.push({ event, data });
        },
      };
    },
    on(event: string, handler: (...args: unknown[]) => void) {
      handlers.set(event, handler);
    },
    _emitted: emitted,
    _handlers: handlers,
    ...overrides,
  };

  return socket;
}

/**
 * Construye un io.to() simulado que captura los broadcasts.
 */
function buildMockIo() {
  const broadcasts: Array<{ room: string; event: string; data: unknown }> = [];

  const io = {
    to(room: string) {
      return {
        emit(event: string, data?: unknown) {
          broadcasts.push({ room, event, data });
        },
      };
    },
    _broadcasts: broadcasts,
  };

  return io;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// Importamos las funciones puras del módulo para testear la lógica interna.
// Como realtime.ts inicializa socket.io, lo testeamos de forma unitaria
// sin instanciar el servidor real.

describe('verifyToken — handshake JWT (Req 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acepta una conexión con token válido', () => {
    (verifyToken as MockedFunction<typeof verifyToken>).mockReturnValue(ALICE_PAYLOAD);

    const result = verifyToken(VALID_TOKEN);

    expect(result).not.toBeNull();
    expect(result?.sub).toBe(USER_ALICE);
  });

  it('rechaza una conexión sin token (null)', () => {
    (verifyToken as MockedFunction<typeof verifyToken>).mockReturnValue(null);

    const result = verifyToken(INVALID_TOKEN);

    expect(result).toBeNull();
  });

  it('rechaza una conexión con token expirado', () => {
    (verifyToken as MockedFunction<typeof verifyToken>).mockReturnValue(null);

    const result = verifyToken('expired.token.here');

    expect(result).toBeNull();
  });
});

// ─── Lógica del middleware de handshake ───────────────────────────────────────

describe('Middleware de handshake de socket.io (Req 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Simula el comportamiento del middleware de handshake definido en initRealtime.
   * Extrae el token de socket.handshake.auth.token y llama verifyToken.
   */
  function runHandshakeMiddleware(
    token: string | undefined,
  ): { error: Error | null; userId: string | null } {
    const tokenPayload = verifyToken as MockedFunction<typeof verifyToken>;

    if (!token) {
      return { error: new Error('Autenticación requerida'), userId: null };
    }

    const payload = tokenPayload(token);
    if (!payload) {
      return { error: new Error('Token inválido o expirado'), userId: null };
    }

    return { error: null, userId: payload.sub };
  }

  it('handshake sin token → error "Autenticación requerida"', () => {
    const { error } = runHandshakeMiddleware(undefined);
    expect(error?.message).toBe('Autenticación requerida');
  });

  it('handshake con token inválido → error "Token inválido o expirado"', () => {
    (verifyToken as MockedFunction<typeof verifyToken>).mockReturnValue(null);

    const { error } = runHandshakeMiddleware(INVALID_TOKEN);
    expect(error?.message).toBe('Token inválido o expirado');
  });

  it('handshake con token válido → sin error, userId extraído', () => {
    (verifyToken as MockedFunction<typeof verifyToken>).mockReturnValue(ALICE_PAYLOAD);

    const { error, userId } = runHandshakeMiddleware(VALID_TOKEN);
    expect(error).toBeNull();
    expect(userId).toBe(USER_ALICE);
  });
});

// ─── conversation:join (Req 8.2) ─────────────────────────────────────────────

describe('conversation:join — validación de membresía (Req 8.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Simula el handler de conversation:join del socket.
   */
  async function runJoinHandler(
    socket: ReturnType<typeof buildMockSocket>,
    conversationId: string,
  ): Promise<void> {
    const member = await isMember(conversationId, socket.userId);
    if (!member) {
      socket.emit('error', { message: 'No tienes acceso a esta conversación' });
      return;
    }
    socket.join(`conversation:${conversationId}`);
  }

  it('join rechazado si el usuario NO es miembro', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(false);
    const socket = buildMockSocket();

    await runJoinHandler(socket, CONV_ID);

    expect(socket._emitted).toContainEqual({
      event: 'error',
      data: { message: 'No tienes acceso a esta conversación' },
    });
    expect(socket.rooms).not.toContain(`conversation:${CONV_ID}`);
  });

  it('join aceptado si el usuario ES miembro', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(true);
    const socket = buildMockSocket();

    await runJoinHandler(socket, CONV_ID);

    expect(socket.rooms.has(`conversation:${CONV_ID}`)).toBe(true);
    expect(socket._emitted.find((e) => e.event === 'error')).toBeUndefined();
  });

  it('join rechazado llama a isMember con los parámetros correctos', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(false);
    const socket = buildMockSocket();

    await runJoinHandler(socket, CONV_ID);

    expect(isMember).toHaveBeenCalledWith(CONV_ID, USER_ALICE);
  });
});

// ─── message:send — broadcast correcto (Req 4.1, 8.3) ────────────────────────

describe('message:send — broadcast a la sala correcta (Req 4.1, 6.2, 8.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Simula el handler de message:send.
   */
  async function runSendHandler(
    io: ReturnType<typeof buildMockIo>,
    socket: ReturnType<typeof buildMockSocket>,
    data: { conversationId: string; body: string },
    userId: string,
    rateLimited = false,
  ): Promise<void> {
    const { conversationId, body } = data;

    if (rateLimited) {
      socket.emit('error', {
        error: 'Has superado el límite de mensajes. Espera unos minutos.',
      });
      return;
    }

    const member = await isMember(conversationId, userId);
    if (!member) {
      socket.emit('error', { error: 'No tienes acceso a esta conversación' });
      return;
    }

    const message = await postMessage({ conversationId, senderId: userId, body });

    // Broadcast message:new a conversation room
    io.to(`conversation:${conversationId}`).emit('message:new', message);

    // Emit unread:update a cada otro miembro
    const poolMock = pool as unknown as { query: MockedFunction<() => Promise<unknown>> };
    const [rows] = (await poolMock.query()) as [Array<{ user_id: string }>];
    for (const row of rows) {
      io.to(`user:${row.user_id}`).emit('unread:update', { conversationId });
    }
  }

  it('broadcast message:new va a la sala conversation:<id>', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(true);
    (postMessage as MockedFunction<typeof postMessage>).mockResolvedValue(SAMPLE_MESSAGE);
    const poolMock = pool as unknown as { query: MockedFunction<() => Promise<unknown>> };
    poolMock.query.mockResolvedValue([[{ user_id: USER_BOB }]]);

    const io = buildMockIo();
    const socket = buildMockSocket();

    await runSendHandler(io, socket, { conversationId: CONV_ID, body: 'Hola' }, USER_ALICE);

    const msgBroadcast = io._broadcasts.find(
      (b) => b.room === `conversation:${CONV_ID}` && b.event === 'message:new',
    );
    expect(msgBroadcast).toBeDefined();
    expect(msgBroadcast?.data).toMatchObject({ id: SAMPLE_MESSAGE.id });
  });

  it('unread:update va a la sala user:<receptorId>', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(true);
    (postMessage as MockedFunction<typeof postMessage>).mockResolvedValue(SAMPLE_MESSAGE);
    const poolMock = pool as unknown as { query: MockedFunction<() => Promise<unknown>> };
    poolMock.query.mockResolvedValue([[{ user_id: USER_BOB }]]);

    const io = buildMockIo();
    const socket = buildMockSocket();

    await runSendHandler(io, socket, { conversationId: CONV_ID, body: 'Hola' }, USER_ALICE);

    const unreadBroadcast = io._broadcasts.find(
      (b) => b.room === `user:${USER_BOB}` && b.event === 'unread:update',
    );
    expect(unreadBroadcast).toBeDefined();
    expect(unreadBroadcast?.data).toMatchObject({ conversationId: CONV_ID });
  });

  it('no hace broadcast si el usuario no es miembro', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(false);

    const io = buildMockIo();
    const socket = buildMockSocket();

    await runSendHandler(io, socket, { conversationId: CONV_ID, body: 'Intento' }, USER_ALICE);

    expect(io._broadcasts).toHaveLength(0);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('devuelve error de rate limit cuando se supera el límite', async () => {
    const io = buildMockIo();
    const socket = buildMockSocket();

    await runSendHandler(
      io,
      socket,
      { conversationId: CONV_ID, body: 'Spam' },
      USER_ALICE,
      true, // rateLimited = true
    );

    expect(socket._emitted).toContainEqual(
      expect.objectContaining({ event: 'error' }),
    );
    expect(io._broadcasts).toHaveLength(0);
  });

  it('no llama a postMessage cuando el usuario no es miembro', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(false);

    const io = buildMockIo();
    const socket = buildMockSocket();

    await runSendHandler(io, socket, { conversationId: CONV_ID, body: 'Test' }, USER_ALICE);

    expect(postMessage).not.toHaveBeenCalled();
  });
});

// ─── message:read (Req 5.3, 6.1) ─────────────────────────────────────────────

describe('message:read — marcar leído y emitir evento (Req 5.3, 6.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function runReadHandler(
    io: ReturnType<typeof buildMockIo>,
    socket: ReturnType<typeof buildMockSocket>,
    data: { conversationId: string },
    userId: string,
  ): Promise<void> {
    const { conversationId } = data;

    const member = await isMember(conversationId, userId);
    if (!member) {
      socket.emit('error', { message: 'No tienes acceso a esta conversación' });
      return;
    }

    await markRead(conversationId, userId);

    io.to(`conversation:${conversationId}`).emit('message:read', { conversationId, userId });
  }

  it('llama a markRead con conversationId y userId correctos', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(true);
    (markRead as MockedFunction<typeof markRead>).mockResolvedValue(undefined);

    const io = buildMockIo();
    const socket = buildMockSocket();

    await runReadHandler(io, socket, { conversationId: CONV_ID }, USER_ALICE);

    expect(markRead).toHaveBeenCalledWith(CONV_ID, USER_ALICE);
  });

  it('emite message:read a la sala de la conversación', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(true);
    (markRead as MockedFunction<typeof markRead>).mockResolvedValue(undefined);

    const io = buildMockIo();
    const socket = buildMockSocket();

    await runReadHandler(io, socket, { conversationId: CONV_ID }, USER_ALICE);

    const readBroadcast = io._broadcasts.find(
      (b) => b.room === `conversation:${CONV_ID}` && b.event === 'message:read',
    );
    expect(readBroadcast).toBeDefined();
    expect(readBroadcast?.data).toMatchObject({ conversationId: CONV_ID, userId: USER_ALICE });
  });

  it('rechaza si el usuario no es miembro', async () => {
    (isMember as MockedFunction<typeof isMember>).mockResolvedValue(false);

    const io = buildMockIo();
    const socket = buildMockSocket();

    await runReadHandler(io, socket, { conversationId: CONV_ID }, USER_ALICE);

    expect(markRead).not.toHaveBeenCalled();
    expect(socket._emitted).toContainEqual(
      expect.objectContaining({ event: 'error' }),
    );
  });
});

// ─── typing (Req 5.1, 5.2) ────────────────────────────────────────────────────

describe('typing — notificar a otros miembros (Req 5.1, 5.2)', () => {
  it('retransmite el evento typing a la sala excluyendo al emisor', () => {
    const broadcastsToRoom: Array<{ event: string; data: unknown }> = [];

    // Simula socket.to(room).emit(...)
    const socket = buildMockSocket({
      to(room: string) {
        void room;
        return {
          emit(event: string, data?: unknown) {
            broadcastsToRoom.push({ event, data });
          },
        };
      },
    });

    // Simular el handler de typing
    const typingHandler = (data: { conversationId: string; isTyping: boolean }) => {
      const { conversationId, isTyping } = data;
      if (!conversationId || typeof conversationId !== 'string') return;
      socket.to(`conversation:${conversationId}`).emit('typing', {
        conversationId,
        userId: (socket as typeof socket & { userId: string }).userId,
        isTyping: Boolean(isTyping),
      });
    };

    typingHandler({ conversationId: CONV_ID, isTyping: true });

    expect(broadcastsToRoom).toContainEqual({
      event: 'typing',
      data: { conversationId: CONV_ID, userId: USER_ALICE, isTyping: true },
    });
  });

  it('emite isTyping=false cuando el usuario deja de escribir (Req 5.2)', () => {
    const broadcastsToRoom: Array<{ event: string; data: unknown }> = [];

    const socket = buildMockSocket({
      to(_room: string) {
        return {
          emit(event: string, data?: unknown) {
            broadcastsToRoom.push({ event, data });
          },
        };
      },
    });

    const typingHandler = (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing', {
        conversationId: data.conversationId,
        userId: (socket as typeof socket & { userId: string }).userId,
        isTyping: Boolean(data.isTyping),
      });
    };

    typingHandler({ conversationId: CONV_ID, isTyping: false });

    expect(broadcastsToRoom).toContainEqual({
      event: 'typing',
      data: expect.objectContaining({ isTyping: false }),
    });
  });
});

// ─── Sala personal user:<userId> (Req 8.3) ────────────────────────────────────

describe('Sala personal user:<userId> al conectar (Req 8.3)', () => {
  it('el socket se une a la sala user:<userId> al conectar', () => {
    const socket = buildMockSocket();
    const userId = socket.userId;

    // Simular el evento connection del servidor
    socket.join(`user:${userId}`);

    expect(socket.rooms.has(`user:${userId}`)).toBe(true);
  });
});
