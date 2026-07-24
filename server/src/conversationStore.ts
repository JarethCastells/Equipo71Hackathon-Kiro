import type { RowDataPacket } from 'mysql2';
import { randomUUID } from 'node:crypto';
import pool from './db.js';
import type { Conversation, ConversationSummary, Message, PublicUser, UserPlan } from './types.js';
import { toPublicConversation, toPublicMessage } from './types.js';

// ─── Row interfaces ──────────────────────────────────────────────────────────

interface ConversationRow extends RowDataPacket {
  id: string;
  created_by: string;
  is_group: number;
  title: string | null;
  dm_key: string | null;
  last_message_at: Date | null;
  created_at: Date;
}

interface ConversationMemberRow extends RowDataPacket {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: Date | null;
  last_email_at: Date | null;
  joined_at: Date;
}

interface MessageRow extends RowDataPacket {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: Date;
}

interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  role: string;
  email_verified: number;
  avatar_url: string | null;
  bio: string | null;
  pending_email: string | null;
  totp_enabled: number;
  notify_new_matches: number;
  notify_security: number;
  onboarding_completed: number;
  profession: string | null;
  location: string | null;
  interests: string | null;
  rate_type: string | null;
  rate_amount: string | null;
  cv_url: string | null;
  availability: string | null;
  created_at: Date;
}

// ─── mapRow helpers ──────────────────────────────────────────────────────────

function mapConversationRow(row: ConversationRow): import('./types.js').ConversationRow {
  return {
    id: row.id,
    createdBy: row.created_by,
    isGroup: row.is_group,
    title: row.title,
    dmKey: row.dm_key,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapMessageRow(row: MessageRow): import('./types.js').MessageRow {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapUserRow(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as PublicUser['role'],
    emailVerified: Boolean(row.email_verified),
    avatarUrl: row.avatar_url,
    bio: row.bio,
    plan: (row.plan as UserPlan) ?? 'libre',
    pendingEmail: row.pending_email,
    totpEnabled: Boolean(row.totp_enabled),
    notifyNewMatches: Boolean(row.notify_new_matches),
    notifySecurity: Boolean(row.notify_security),
    notifyMessagesEmail: Boolean(row.notify_messages_email ?? true),
    notifyMessagesPhone: Boolean(row.notify_messages_phone ?? false),
    phoneNumber: row.phone_number ?? null,
    onboardingCompleted: Boolean(row.onboarding_completed),
    profession: row.profession,
    location: row.location,
    interests: row.interests,
    rateType: row.rate_type as PublicUser['rateType'],
    rateAmount: row.rate_amount !== null ? Number(row.rate_amount) : null,
    cvUrl: row.cv_url,
    availability: row.availability,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// ─── dm_key helper ───────────────────────────────────────────────────────────

/**
 * Construye el dm_key canónico: min(userId, recipientId) + ':' + max(userId, recipientId).
 * Garantiza que el mismo par siempre produce la misma clave independientemente del orden.
 */
export function buildDmKey(userA: string, userB: string): string {
  const [min, max] = userA < userB ? [userA, userB] : [userB, userA];
  return `${min}:${max}`;
}

// ─── findOrCreateDirectConversation ─────────────────────────────────────────

/**
 * Obtiene o crea la conversación directa entre dos usuarios.
 * Idempotente: si ya existe una con el mismo dm_key la devuelve sin crear duplicado.
 * La unicidad a nivel de base de datos está garantizada por el índice UNIQUE en dm_key.
 *
 * Cumple Requisitos 1.1, 1.2, 1.5.
 */
export async function findOrCreateDirectConversation(
  userId: string,
  recipientId: string,
): Promise<Conversation> {
  const dmKey = buildDmKey(userId, recipientId);

  // Intento optimista: buscar la conversación existente primero
  const existing = await findConversationByDmKey(dmKey);
  if (existing) return existing;

  const conversationId = randomUUID();
  const memberId1 = randomUUID();
  const memberId2 = randomUUID();

  // Usamos conexión individual para la transacción
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // INSERT IGNORE para manejar la condición de carrera de forma atómica:
    // si dos peticiones concurrentes llegan al mismo tiempo, solo una inserta;
    // la otra recibe affectedRows=0 y luego el SELECT devuelve la existente.
    await conn.query(
      `INSERT IGNORE INTO conversations (id, created_by, is_group, title, dm_key)
       VALUES (?, ?, 0, NULL, ?)`,
      [conversationId, userId, dmKey],
    );

    // Recuperar la conversación real (puede ser la recién creada o la preexistente)
    const [convRows] = await conn.query<ConversationRow[]>(
      'SELECT * FROM conversations WHERE dm_key = ? LIMIT 1',
      [dmKey],
    );
    const actualConvId = convRows[0].id;

    // Solo insertar miembros si la conversación fue recién creada por nosotros
    if (actualConvId === conversationId) {
      await conn.query(
        `INSERT IGNORE INTO conversation_members (id, conversation_id, user_id)
         VALUES (?, ?, ?), (?, ?, ?)`,
        [memberId1, conversationId, userId, memberId2, conversationId, recipientId],
      );
    }

    await conn.commit();

    return toPublicConversation(mapConversationRow(convRows[0]));
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── findConversationByDmKey ──────────────────────────────────────────────────

async function findConversationByDmKey(dmKey: string): Promise<Conversation | null> {
  const [rows] = await pool.query<ConversationRow[]>(
    'SELECT * FROM conversations WHERE dm_key = ? LIMIT 1',
    [dmKey],
  );
  return rows[0] ? toPublicConversation(mapConversationRow(rows[0])) : null;
}

// ─── findConversationById ────────────────────────────────────────────────────

/**
 * Busca una conversación por ID. Devuelve undefined si no existe.
 */
export async function findConversationById(
  conversationId: string,
): Promise<Conversation | undefined> {
  const [rows] = await pool.query<ConversationRow[]>(
    'SELECT * FROM conversations WHERE id = ? LIMIT 1',
    [conversationId],
  );
  return rows[0] ? toPublicConversation(mapConversationRow(rows[0])) : undefined;
}

// ─── isMember ────────────────────────────────────────────────────────────────

/**
 * Comprueba si un usuario es miembro de una conversación.
 * Cumple Requisito 2.1, 3.3, 4.6.
 */
export async function isMember(conversationId: string, userId: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1',
    [conversationId, userId],
  );
  return rows.length > 0;
}

// ─── touchLastMessage ────────────────────────────────────────────────────────

/**
 * Actualiza last_message_at de la conversación al momento actual.
 * Se llama al persistir un nuevo mensaje. Cumple Requisito 4.2.
 */
export async function touchLastMessage(conversationId: string): Promise<void> {
  await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = ?', [
    conversationId,
  ]);
}

// ─── listConversationsForUser ────────────────────────────────────────────────

/**
 * Devuelve la bandeja del usuario: conversaciones en las que es miembro,
 * ordenadas por last_message_at DESC, con el otro participante, el último
 * mensaje y el conteo de no leídos.
 * Cumple Requisitos 2.1, 2.2, 2.3, 2.4.
 */
export async function listConversationsForUser(userId: string): Promise<ConversationSummary[]> {
  // Obtener todas las conversaciones del usuario con su miembro membership
  const [convRows] = await pool.query<ConversationRow[]>(
    `SELECT c.*
     FROM conversations c
     INNER JOIN conversation_members cm ON cm.conversation_id = c.id
     WHERE cm.user_id = ?
     ORDER BY c.last_message_at DESC`,
    [userId],
  );

  if (convRows.length === 0) return [];

  const conversationIds = convRows.map((r) => r.id);

  // Obtener todos los miembros de esas conversaciones (excepto el usuario actual)
  const placeholders = conversationIds.map(() => '?').join(', ');
  const [memberRows] = await pool.query<ConversationMemberRow[]>(
    `SELECT * FROM conversation_members
     WHERE conversation_id IN (${placeholders}) AND user_id != ?`,
    [...conversationIds, userId],
  );

  // Obtener los IDs de los otros participantes
  const otherUserIds = [...new Set(memberRows.map((m) => m.user_id))];
  if (otherUserIds.length === 0) return [];

  const userPlaceholders = otherUserIds.map(() => '?').join(', ');
  const [userRows] = await pool.query<UserRow[]>(
    `SELECT id, name, email, role, email_verified, avatar_url, bio, pending_email,
            totp_enabled, notify_new_matches, notify_security, onboarding_completed,
            profession, location, interests, rate_type, rate_amount, cv_url, availability, created_at
     FROM users WHERE id IN (${userPlaceholders})`,
    otherUserIds,
  );

  // Obtener el último mensaje de cada conversación
  const [lastMsgRows] = await pool.query<MessageRow[]>(
    `SELECT m.*
     FROM messages m
     INNER JOIN (
       SELECT conversation_id, MAX(created_at) AS max_at
       FROM messages
       WHERE conversation_id IN (${placeholders})
       GROUP BY conversation_id
     ) latest ON m.conversation_id = latest.conversation_id AND m.created_at = latest.max_at
     WHERE m.conversation_id IN (${placeholders})`,
    [...conversationIds, ...conversationIds],
  );

  // Obtener last_read_at del usuario actual para cada conversación
  const [membershipRows] = await pool.query<ConversationMemberRow[]>(
    `SELECT * FROM conversation_members
     WHERE conversation_id IN (${placeholders}) AND user_id = ?`,
    [...conversationIds, userId],
  );

  // Obtener conteo de no leídos por conversación
  const [unreadRows] = await pool.query<RowDataPacket[]>(
    `SELECT m.conversation_id, COUNT(*) AS unread_count
     FROM messages m
     INNER JOIN conversation_members cm
       ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
     WHERE m.conversation_id IN (${placeholders})
       AND m.sender_id != ?
       AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
     GROUP BY m.conversation_id`,
    [userId, ...conversationIds, userId],
  );

  // Construir mapas para lookup O(1)
  const userMap = new Map<string, PublicUser>(userRows.map((r) => [r.id, mapUserRow(r)]));
  const membersByConv = new Map<string, string>();
  for (const m of memberRows) {
    membersByConv.set(m.conversation_id, m.user_id);
  }
  const lastMsgByConv = new Map<string, Message>();
  for (const m of lastMsgRows) {
    lastMsgByConv.set(m.conversation_id, toPublicMessage(mapMessageRow(m)));
  }
  const lastReadByConv = new Map<string, Date | null>();
  for (const m of membershipRows) {
    lastReadByConv.set(m.conversation_id, m.last_read_at);
  }
  const unreadByConv = new Map<string, number>();
  for (const row of unreadRows) {
    unreadByConv.set(row.conversation_id as string, Number(row.unread_count));
  }

  // Ensamblar ConversationSummary[]
  const summaries: ConversationSummary[] = [];
  for (const convRow of convRows) {
    const otherUserId = membersByConv.get(convRow.id);
    if (!otherUserId) continue;
    const otherParticipant = userMap.get(otherUserId);
    if (!otherParticipant) continue;

    const conv = toPublicConversation(mapConversationRow(convRow));
    summaries.push({
      ...conv,
      otherParticipant,
      lastMessage: lastMsgByConv.get(convRow.id) ?? null,
      unreadCount: unreadByConv.get(convRow.id) ?? 0,
    });
  }

  return summaries;
}
