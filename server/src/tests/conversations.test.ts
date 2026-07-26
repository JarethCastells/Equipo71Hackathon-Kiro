/**
 * Pruebas de integración del router conversations.ts
 *
 * Cubre:
 * - POST /api/conversations: crear/obtener DM idempotente (Req 1.1-1.4)
 * - GET  /api/conversations: bandeja del usuario (Req 2.1-2.4)
 * - GET  /api/conversations/:id/messages: historial paginado (Req 3.1-3.3)
 * - POST /api/conversations/:id/messages: enviar mensaje (Req 4.3-4.6)
 * - POST /api/conversations/:id/read: marcar leído (Req 6.1)
 * - GET  /api/conversations/unread-count: total no leídos (Req 6.4)
 * - GET  /api/conversations/contacts: búsqueda de usuarios (Req 1.3)
 * - 403 cuando el usuario no es miembro (Req 2.1, 3.3, 4.6)
 *
 * Estrategia: mocks de todos los stores/servicios para aislar el router.
 * Se usa supertest para simular peticiones HTTP reales.
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (antes de importar el router) ─────────────────────────────────────

vi.mock('../conversationStore.js', () => ({
  findOrCreateDirectConversation: vi.fn(),
  listConversationsForUser: vi.fn(),
  isMember: vi.fn(),
  // buildDmKey es una función pura real (no necesita mock de comportamiento),
  // pero routes/conversations.ts la importa y la invoca directamente, así
  // que debe existir en el mock del módulo o la llamada lanza TypeError.
  buildDmKey: (userA: string, userB: string) => {
    const [min, max] = userA < userB ? [userA, userB] : [userB, userA];
    return `${min}:${max}`;
  },
}));

vi.mock('../messageStore.js', () => ({
  listMessages: vi.fn(),
  countTotalUnread: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock('../messageService.js', () => ({
  postMessage: vi.fn(),
}));

vi.mock('../db.js', () => ({
  default: {
    query: vi.fn(),
  },
}));

// Mock requireAuth so it reads req.auth injected by the test middleware
// (avoids checking the actual Authorization header)
vi.mock('../auth.js', () => ({
  requireAuth: (
    req: Request & { auth?: { sub: string; email: string } },
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.auth) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    next();
  },
}));

// ─── Imports tras los mocks ───────────────────────────────────────────────────

import {
  findOrCreateDirectConversation,
  isMember,
  listConversationsForUser,
} from '../conversationStore.js';
import pool from '../db.js';
import { postMessage } from '../messageService.js';
import { countTotalUnread, listMessages, markRead } from '../messageStore.js';
import conversationRoutes from '../routes/conversations.js';

// ─── App de test ──────────────────────────────────────────────────────────────

/**
 * Construye una app Express mínima con el router montado.
 * Inyecta req.auth para simular el middleware requireAuth.
 */
function buildApp(userId = 'user-alice') {
  const app = express();
  app.use(express.json());

  // Simular requireAuth: inyectar req.auth directamente
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { auth?: { sub: string; email: string } }).auth = {
      sub: userId,
      email: `${userId}@test.com`,
    };
    next();
  });

  app.use('/api/conversations', conversationRoutes);

  // Error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    res.status(500).json({ error: msg });
  });

  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CONV_ID = 'conv-aaaaa-00001';
const USER_ALICE = 'user-alice';
const USER_BOB = 'user-bob';
const USER_CHARLIE = 'user-charlie';

const CONVERSATION = {
  id: CONV_ID,
  createdBy: USER_ALICE,
  isGroup: false,
  title: null,
  lastMessageAt: null,
  createdAt: new Date().toISOString(),
};

const MESSAGE = {
  id: 'msg-00001',
  conversationId: CONV_ID,
  senderId: USER_ALICE,
  body: 'Hola Bob',
  createdAt: new Date().toISOString(),
};

const CONVERSATION_SUMMARY = {
  ...CONVERSATION,
  otherParticipant: {
    id: USER_BOB,
    name: 'Bob Demo',
    email: 'bob@test.com',
    role: 'freelancer',
    emailVerified: true,
    avatarUrl: null,
    bio: null,
    pendingEmail: null,
    totpEnabled: false,
    notifyNewMatches: true,
    notifySecurity: true,
    onboardingCompleted: true,
    profession: null,
    location: null,
    interests: null,
    rateType: null,
    rateAmount: null,
    cvUrl: null,
    availability: null,
    createdAt: new Date().toISOString(),
  },
  lastMessage: MESSAGE,
  unreadCount: 2,
};

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Defaults razonables
  (isMember as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  (findOrCreateDirectConversation as ReturnType<typeof vi.fn>).mockResolvedValue(CONVERSATION);
  (listConversationsForUser as ReturnType<typeof vi.fn>).mockResolvedValue([CONVERSATION_SUMMARY]);
  (listMessages as ReturnType<typeof vi.fn>).mockResolvedValue([MESSAGE]);
  (countTotalUnread as ReturnType<typeof vi.fn>).mockResolvedValue(3);
  (markRead as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (postMessage as ReturnType<typeof vi.fn>).mockResolvedValue(MESSAGE);

  // pool.query por defecto: usuario existe
  const poolMock = pool as unknown as { query: ReturnType<typeof vi.fn> };
  poolMock.query.mockResolvedValue([[{ id: USER_BOB }]]);
});

// ─── POST /api/conversations ──────────────────────────────────────────────────

describe('POST /api/conversations — crear/obtener DM', () => {
  it('crea la conversación y devuelve 201 con la conversación', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app).post('/api/conversations').send({ recipientId: USER_BOB });

    expect(res.status).toBe(201);
    expect(res.body.conversation).toBeDefined();
    expect(res.body.conversation.id).toBe(CONV_ID);
  });

  it('llama a findOrCreateDirectConversation con el userId del emisor', async () => {
    const app = buildApp(USER_ALICE);
    await supertest(app).post('/api/conversations').send({ recipientId: USER_BOB });

    expect(findOrCreateDirectConversation).toHaveBeenCalledWith(USER_ALICE, USER_BOB);
  });

  it('devuelve 400 si recipientId está ausente', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app).post('/api/conversations').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recipientId/i);
  });

  it('devuelve 400 si recipientId es el propio usuario', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app).post('/api/conversations').send({ recipientId: USER_ALICE });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/contigo mismo/i);
  });

  it('devuelve 404 si el destinatario no existe en BD', async () => {
    const poolMock = pool as unknown as { query: ReturnType<typeof vi.fn> };
    poolMock.query.mockResolvedValue([[]]); // usuario no encontrado

    const app = buildApp(USER_ALICE);
    const res = await supertest(app)
      .post('/api/conversations')
      .send({ recipientId: 'non-existent-user' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrado/i);
  });

  it('es idempotente: dos llamadas devuelven la misma conversación', async () => {
    const app = buildApp(USER_ALICE);

    const res1 = await supertest(app).post('/api/conversations').send({ recipientId: USER_BOB });

    const res2 = await supertest(app).post('/api/conversations').send({ recipientId: USER_BOB });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.conversation.id).toBe(res2.body.conversation.id);
  });
});

// ─── GET /api/conversations ───────────────────────────────────────────────────

describe('GET /api/conversations — bandeja del usuario', () => {
  it('devuelve 200 con la lista de conversaciones', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app).get('/api/conversations');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.conversations)).toBe(true);
  });

  it('llama a listConversationsForUser con el userId del autenticado', async () => {
    const app = buildApp(USER_ALICE);
    await supertest(app).get('/api/conversations');

    expect(listConversationsForUser).toHaveBeenCalledWith(USER_ALICE);
  });

  it('cada conversación incluye otherParticipant y unreadCount', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app).get('/api/conversations');

    expect(res.status).toBe(200);
    const conv = res.body.conversations[0];
    expect(conv.otherParticipant).toBeDefined();
    expect(typeof conv.unreadCount).toBe('number');
  });

  it('devuelve lista vacía cuando no hay conversaciones', async () => {
    (listConversationsForUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const app = buildApp(USER_ALICE);
    const res = await supertest(app).get('/api/conversations');

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(0);
  });
});

// ─── GET /api/conversations/unread-count ─────────────────────────────────────

describe('GET /api/conversations/unread-count — badge global', () => {
  it('devuelve 200 con el total de no leídos', async () => {
    (countTotalUnread as ReturnType<typeof vi.fn>).mockResolvedValue(5);

    const app = buildApp(USER_ALICE);
    const res = await supertest(app).get('/api/conversations/unread-count');

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(5);
  });

  it('devuelve 0 cuando no hay mensajes no leídos', async () => {
    (countTotalUnread as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const app = buildApp(USER_ALICE);
    const res = await supertest(app).get('/api/conversations/unread-count');

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(0);
  });

  it('llama a countTotalUnread con el userId correcto', async () => {
    const app = buildApp(USER_ALICE);
    await supertest(app).get('/api/conversations/unread-count');

    expect(countTotalUnread).toHaveBeenCalledWith(USER_ALICE);
  });
});

// ─── GET /api/conversations/contacts ─────────────────────────────────────────

describe('GET /api/conversations/contacts — búsqueda de usuarios', () => {
  it('devuelve 200 con array de contactos cuando hay resultados', async () => {
    const poolMock = pool as unknown as { query: ReturnType<typeof vi.fn> };
    poolMock.query.mockResolvedValue([
      [
        {
          id: USER_BOB,
          name: 'Bob Demo',
          email: 'bob@test.com',
          role: 'freelancer',
          email_verified: 1,
          avatar_url: null,
          bio: null,
          pending_email: null,
          totp_enabled: 0,
          notify_new_matches: 1,
          notify_security: 1,
          onboarding_completed: 1,
          profession: null,
          location: null,
          interests: null,
          rate_type: null,
          rate_amount: null,
          cv_url: null,
          availability: null,
          created_at: new Date(),
        },
      ],
    ]);

    const app = buildApp(USER_ALICE);
    const res = await supertest(app).get('/api/conversations/contacts?q=Bob');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.contacts)).toBe(true);
    expect(res.body.contacts[0].id).toBe(USER_BOB);
  });

  it('devuelve lista vacía cuando q está ausente o vacío', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app).get('/api/conversations/contacts');

    expect(res.status).toBe(200);
    expect(res.body.contacts).toHaveLength(0);
  });

  it('devuelve 400 si q supera 100 caracteres', async () => {
    const app = buildApp(USER_ALICE);
    const longQ = 'a'.repeat(101);
    const res = await supertest(app).get(`/api/conversations/contacts?q=${longQ}`);

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/conversations/:id/messages ─────────────────────────────────────

describe('GET /api/conversations/:id/messages — historial', () => {
  it('devuelve 200 con los mensajes para un miembro', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app).get(`/api/conversations/${CONV_ID}/messages`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it('llama a listMessages con los parámetros correctos', async () => {
    const app = buildApp(USER_ALICE);
    await supertest(app).get(`/api/conversations/${CONV_ID}/messages?limit=10`);

    expect(listMessages).toHaveBeenCalledWith(CONV_ID, null, 10);
  });

  it('pasa el cursor when se provee ?before=', async () => {
    const cursor = '2024-01-01T12:00:00.000Z';
    const app = buildApp(USER_ALICE);
    await supertest(app).get(
      `/api/conversations/${CONV_ID}/messages?before=${encodeURIComponent(cursor)}`,
    );

    expect(listMessages).toHaveBeenCalledWith(CONV_ID, cursor, 30);
  });

  it('devuelve 403 si el usuario NO es miembro — Req 3.3, 4.6', async () => {
    (isMember as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const app = buildApp(USER_CHARLIE); // Charlie no es miembro de la conv
    const res = await supertest(app).get(`/api/conversations/${CONV_ID}/messages`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/acceso/i);
  });

  it('no llama a listMessages cuando el usuario no es miembro', async () => {
    (isMember as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const app = buildApp(USER_CHARLIE);
    await supertest(app).get(`/api/conversations/${CONV_ID}/messages`);

    expect(listMessages).not.toHaveBeenCalled();
  });
});

// ─── POST /api/conversations/:id/messages ────────────────────────────────────

describe('POST /api/conversations/:id/messages — enviar mensaje', () => {
  it('devuelve 201 con el mensaje enviado', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app)
      .post(`/api/conversations/${CONV_ID}/messages`)
      .send({ body: 'Hola Bob' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.body).toBe('Hola Bob');
  });

  it('llama a postMessage con los parámetros correctos', async () => {
    const app = buildApp(USER_ALICE);
    await supertest(app)
      .post(`/api/conversations/${CONV_ID}/messages`)
      .send({ body: 'Test mensaje' });

    expect(postMessage).toHaveBeenCalledWith({
      conversationId: CONV_ID,
      senderId: USER_ALICE,
      body: 'Test mensaje',
    });
  });

  it('devuelve 400 si body está vacío', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app)
      .post(`/api/conversations/${CONV_ID}/messages`)
      .send({ body: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/vacío/i);
  });

  it('devuelve 400 si body está ausente', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app).post(`/api/conversations/${CONV_ID}/messages`).send({});

    expect(res.status).toBe(400);
  });

  it('devuelve 400 si postMessage lanza un error de validación', async () => {
    (postMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('El mensaje no puede superar los 2000 caracteres.'),
    );

    const app = buildApp(USER_ALICE);
    const res = await supertest(app)
      .post(`/api/conversations/${CONV_ID}/messages`)
      .send({ body: 'a'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  it('devuelve 403 si el usuario NO es miembro — Req 4.6', async () => {
    (isMember as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const app = buildApp(USER_CHARLIE);
    const res = await supertest(app)
      .post(`/api/conversations/${CONV_ID}/messages`)
      .send({ body: 'Mensaje no autorizado' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/acceso/i);
  });

  it('no llama a postMessage cuando el usuario no es miembro', async () => {
    (isMember as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const app = buildApp(USER_CHARLIE);
    await supertest(app)
      .post(`/api/conversations/${CONV_ID}/messages`)
      .send({ body: 'Intento no autorizado' });

    expect(postMessage).not.toHaveBeenCalled();
  });
});

// ─── POST /api/conversations/:id/read ────────────────────────────────────────

describe('POST /api/conversations/:id/read — marcar leído', () => {
  it('devuelve 200 y marca la conversación como leída', async () => {
    const app = buildApp(USER_ALICE);
    const res = await supertest(app).post(`/api/conversations/${CONV_ID}/read`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/leída/i);
  });

  it('llama a markRead con conversationId y userId correctos', async () => {
    const app = buildApp(USER_ALICE);
    await supertest(app).post(`/api/conversations/${CONV_ID}/read`);

    expect(markRead).toHaveBeenCalledWith(CONV_ID, USER_ALICE);
  });

  it('devuelve 403 si el usuario NO es miembro — Req 6.1', async () => {
    (isMember as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const app = buildApp(USER_CHARLIE);
    const res = await supertest(app).post(`/api/conversations/${CONV_ID}/read`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/acceso/i);
  });

  it('no llama a markRead cuando el usuario no es miembro', async () => {
    (isMember as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const app = buildApp(USER_CHARLIE);
    await supertest(app).post(`/api/conversations/${CONV_ID}/read`);

    expect(markRead).not.toHaveBeenCalled();
  });
});

// ─── Flujo completo: crear → enviar → leer → unread ──────────────────────────

describe('Flujo completo de conversación', () => {
  it('crear conversación → enviar mensaje → marcar leído → unreadCount 0', async () => {
    const app = buildApp(USER_ALICE);

    // 1. Crear conversación
    const createRes = await supertest(app)
      .post('/api/conversations')
      .send({ recipientId: USER_BOB });
    expect(createRes.status).toBe(201);

    // 2. Enviar mensaje
    const sendRes = await supertest(app)
      .post(`/api/conversations/${CONV_ID}/messages`)
      .send({ body: 'Hola Bob, ¿cómo estás?' });
    expect(sendRes.status).toBe(201);

    // 3. Marcar leído
    const readRes = await supertest(app).post(`/api/conversations/${CONV_ID}/read`);
    expect(readRes.status).toBe(200);

    // 4. Verificar unread count
    (countTotalUnread as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const unreadRes = await supertest(app).get('/api/conversations/unread-count');
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.unreadCount).toBe(0);
  });

  it('listar conversaciones → ver historial de mensajes', async () => {
    const app = buildApp(USER_ALICE);

    // 1. Listar conversaciones
    const listRes = await supertest(app).get('/api/conversations');
    expect(listRes.status).toBe(200);
    expect(listRes.body.conversations.length).toBeGreaterThan(0);

    // 2. Ver historial de la primera conversación
    const convId = listRes.body.conversations[0].id;
    const msgsRes = await supertest(app).get(`/api/conversations/${convId}/messages`);
    expect(msgsRes.status).toBe(200);
    expect(Array.isArray(msgsRes.body.messages)).toBe(true);
  });
});
