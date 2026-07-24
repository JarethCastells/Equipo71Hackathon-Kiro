/**
 * routes/conversations.ts — REST API de mensajería directa.
 *
 * Endpoints:
 *   POST   /api/conversations              — Crear u obtener DM (idempotente vía dm_key)
 *   GET    /api/conversations              — Bandeja del usuario
 *   GET    /api/conversations/unread-count — Total de no leídos (badge)
 *   GET    /api/conversations/contacts     — Búsqueda de usuarios
 *   GET    /api/conversations/:id/messages — Historial con paginación keyset
 *   POST   /api/conversations/:id/messages — Enviar mensaje (usa postMessage)
 *   POST   /api/conversations/:id/read     — Marcar conversación como leída
 *
 * Todos los handlers usan requireAuth + asyncRoute.
 * assertMembership lanza 403 si el usuario no es miembro.
 * Rate limits: envío ~60 msgs/5min, creación ~30/hora.
 *
 * Cumple Requisitos 1.1-1.4, 2.1-2.4, 3.1-3.3, 4.3-4.6, 6.1, 6.4.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { RowDataPacket } from 'mysql2';
import { requireAuth, type AuthedRequest } from '../auth.js';
import {
  buildDmKey,
  findOrCreateDirectConversation,
  isMember,
  listConversationsForUser,
} from '../conversationStore.js';
import pool from '../db.js';
import { postMessage } from '../messageService.js';
import { countTotalUnread, listMessages, markRead } from '../messageStore.js';
import { emitConversationNew, emitMessage } from '../realtime.js';
import { toPublicUser, type UserPlan } from '../types.js';

const router = Router();

// ─── asyncRoute helper ────────────────────────────────────────────────────────

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>;

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as AuthedRequest, res, next).catch(next);
  };
}

// ─── assertMembership helper ──────────────────────────────────────────────────

/**
 * Verifica que userId sea miembro de conversationId.
 * Lanza un error HTTP 403 si no lo es, de modo que asyncRoute lo capture y
 * lo propague al middleware de errores centralizado.
 * Cumple Requisitos 2.1, 3.3, 4.6.
 */
async function assertMembership(
  conversationId: string,
  userId: string,
  res: Response,
): Promise<boolean> {
  const member = await isMember(conversationId, userId);
  if (!member) {
    res.status(403).json({ error: 'No tienes acceso a esta conversación.' });
    return false;
  }
  return true;
}

// ─── Rate limiters ────────────────────────────────────────────────────────────

/** Límite de creación de conversaciones: ~30/hora por IP. */
const createConversationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas conversaciones iniciadas. Espera un momento.' },
});

/** Límite de envío de mensajes: ~60 por 5 minutos por IP. */
const sendMessageLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Enviaste demasiados mensajes en poco tiempo. Espera unos minutos.' },
});

// ─── POST / — Crear u obtener DM ─────────────────────────────────────────────

/**
 * Crea o recupera la conversación directa entre el usuario autenticado y el
 * recipientId indicado. Idempotente: si ya existe la devuelve sin crear duplicado.
 * Cumple Requisitos 1.1, 1.2, 1.3, 1.4.
 */
router.post(
  '/',
  requireAuth,
  createConversationLimiter,
  asyncRoute(async (req, res) => {
    const { recipientId } = req.body ?? {};
    const userId = req.auth!.sub;

    if (typeof recipientId !== 'string' || recipientId.trim().length === 0) {
      return res.status(400).json({ error: 'El campo recipientId es obligatorio.' });
    }

    const recipient = recipientId.trim();

    if (recipient === userId) {
      return res.status(400).json({ error: 'No puedes iniciar una conversación contigo mismo.' });
    }

    // Verificar que el destinatario existe
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE id = ? LIMIT 1', [
      recipient,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario destinatario no encontrado.' });
    }

    const prevConversationId = await (async () => {
      // Comprobar si la conversación ya existía antes de crear
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM conversations WHERE dm_key = ? LIMIT 1',
        [buildDmKey(userId, recipient)],
      );
      return (existing as RowDataPacket[])[0]?.id ?? null;
    })();

    const conversation = await findOrCreateDirectConversation(userId, recipient);

    // Si la conversación fue NUEVA (no existía antes), notificar al receptor en tiempo real
    if (!prevConversationId || prevConversationId !== conversation.id) {
      try {
        emitConversationNew(recipient, conversation.id);
      } catch {
        // Fallo en emit nunca cancela la respuesta HTTP
      }
    }

    res.status(201).json({ conversation });
  }),
);

// ─── GET / — Bandeja de conversaciones ───────────────────────────────────────

/**
 * Devuelve las conversaciones del usuario autenticado: últimos mensajes,
 * no leídos y el otro participante. Ordenadas por last_message_at DESC.
 * Cumple Requisitos 2.1, 2.2, 2.3, 2.4.
 */
router.get(
  '/',
  requireAuth,
  asyncRoute(async (req, res) => {
    const conversations = await listConversationsForUser(req.auth!.sub);
    res.json({ conversations });
  }),
);

// ─── GET /unread-count — Badge global de no leídos ───────────────────────────

/**
 * Devuelve el total de mensajes no leídos del usuario en todas sus conversaciones.
 * Cumple Requisito 6.3, 6.4.
 *
 * IMPORTANTE: esta ruta debe ir ANTES de /:id/messages para que Express no
 * la interprete como un ID de conversación.
 */
router.get(
  '/unread-count',
  requireAuth,
  asyncRoute(async (req, res) => {
    const count = await countTotalUnread(req.auth!.sub);
    res.json({ unreadCount: count });
  }),
);

// ─── GET /contacts — Búsqueda de usuarios ────────────────────────────────────

/**
 * Búsqueda mínima de usuarios para iniciar una conversación.
 * Filtra por nombre o email (LIKE), excluye al usuario autenticado.
 * Devuelve una representación reducida (toPublicUser).
 * Cumple Requisito 1.3.
 */
router.get(
  '/contacts',
  requireAuth,
  asyncRoute(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (q.length === 0) {
      return res.json({ contacts: [] });
    }

    if (q.length > 100) {
      return res.status(400).json({ error: 'La búsqueda no puede superar 100 caracteres.' });
    }

    const pattern = `%${q}%`;
    const userId = req.auth!.sub;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, email, role, email_verified, avatar_url, bio, pending_email,
            totp_enabled, notify_new_matches, notify_security, onboarding_completed,
            profession, location, interests, rate_type, rate_amount, cv_url, availability, created_at
     FROM users
     WHERE id != ?
       AND email_verified = 1
       AND (name LIKE ? OR email LIKE ?)
     ORDER BY name ASC
     LIMIT 20`,
      [userId, pattern, pattern],
    );

    const contacts = rows.map((row) =>
      toPublicUser({
        id: row.id as string,
        name: row.name as string,
        email: row.email as string,
        passwordHash: '',
        role: row.role as ReturnType<typeof toPublicUser>['role'],
        emailVerified: Boolean(row.email_verified),
        verificationTokenHash: null,
        verificationTokenExpires: null,
        avatarUrl: row.avatar_url as string | null,
        bio: row.bio as string | null,
        pendingEmail: row.pending_email as string | null,
        pendingEmailTokenHash: null,
        pendingEmailExpires: null,
        totpSecret: null,
        totpEnabled: Boolean(row.totp_enabled),
        plan: (row.plan as UserPlan) ?? 'libre',
        notifyNewMatches: Boolean(row.notify_new_matches),
        notifySecurity: Boolean(row.notify_security),
        notifyMessagesEmail: Boolean(row.notify_messages_email ?? true),
        notifyMessagesPhone: Boolean(row.notify_messages_phone ?? false),
        phoneNumber: row.phone_number as string | null,
        onboardingCompleted: Boolean(row.onboarding_completed),
        profession: row.profession as string | null,
        location: row.location as string | null,
        interests: row.interests as string | null,
        rateType: row.rate_type as ReturnType<typeof toPublicUser>['rateType'],
        rateAmount: row.rate_amount !== null ? Number(row.rate_amount) : null,
        cvUrl: row.cv_url as string | null,
        availability: row.availability as string | null,
        createdAt: new Date(row.created_at as Date).toISOString(),
      }),
    );

    res.json({ contacts });
  }),
);

// ─── GET /:id/messages — Historial con paginación keyset ─────────────────────

/**
 * Devuelve hasta `limit` mensajes anteriores al cursor `before` (ISO datetime).
 * Si no se pasa cursor, devuelve los mensajes más recientes.
 * Solo accesible para miembros de la conversación.
 * Cumple Requisitos 3.1, 3.2, 3.3.
 */
router.get(
  '/:id/messages',
  requireAuth,
  asyncRoute(async (req, res) => {
    const conversationId = req.params.id;
    const userId = req.auth!.sub;

    if (!(await assertMembership(conversationId, userId, res))) return;

    const cursor = typeof req.query.before === 'string' ? req.query.before : null;

    const limitRaw = Number(req.query.limit ?? 30);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 30;

    const messages = await listMessages(conversationId, cursor, limit);
    res.json({ messages });
  }),
);

// ─── POST /:id/messages — Enviar mensaje ─────────────────────────────────────

/**
 * Envía un mensaje a la conversación. Usa postMessage() como punto único de
 * escritura (persistencia + notificaciones + correo con throttling).
 * Solo accesible para miembros de la conversación.
 * Cumple Requisitos 4.3, 4.4, 4.5, 4.6.
 */
router.post(
  '/:id/messages',
  requireAuth,
  sendMessageLimiter,
  asyncRoute(async (req, res) => {
    const conversationId = req.params.id;
    const userId = req.auth!.sub;

    if (!(await assertMembership(conversationId, userId, res))) return;

    const { body } = req.body ?? {};

    if (typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'El cuerpo del mensaje no puede estar vacío.' });
    }

    // postMessage valida longitud máxima y lanza Error en español si falla
    let message;
    try {
      message = await postMessage({ conversationId, senderId: userId, body });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al enviar el mensaje.';
      return res.status(400).json({ error: errorMsg });
    }

    // Emitir en tiempo real a los otros miembros del chat (Req 8.3)
    try {
      const [memberRows] = await pool.query<RowDataPacket[]>(
        'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
        [conversationId, userId],
      );
      const recipientIds = (memberRows as RowDataPacket[]).map(
        (r) => (r as { user_id: string }).user_id,
      );
      emitMessage(conversationId, message, recipientIds);
    } catch {
      // Fallo en emit nunca cancela la respuesta HTTP
    }

    res.status(201).json({ message });
  }),
);

// ─── POST /:id/read — Marcar conversación como leída ─────────────────────────

/**
 * Actualiza last_read_at del usuario en la conversación al momento actual.
 * Después de esto el conteo de no leídos para esta conversación es 0.
 * Solo accesible para miembros de la conversación.
 * Cumple Requisito 6.1.
 */
router.post(
  '/:id/read',
  requireAuth,
  asyncRoute(async (req, res) => {
    const conversationId = req.params.id;
    const userId = req.auth!.sub;

    if (!(await assertMembership(conversationId, userId, res))) return;

    await markRead(conversationId, userId);
    res.json({ message: 'Conversación marcada como leída.' });
  }),
);

export default router;
