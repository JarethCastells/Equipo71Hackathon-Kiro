import type { RowDataPacket } from 'mysql2';
import { randomUUID } from 'node:crypto';
import pool from './db.js';
import type { Message } from './types.js';
import { toPublicMessage } from './types.js';

// ─── Row interfaces ──────────────────────────────────────────────────────────

export interface MessageRow extends RowDataPacket {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: Date;
}

export interface MembershipRow extends RowDataPacket {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: Date | null;
  last_email_at: Date | null;
  joined_at: Date;
}

// ─── mapRow helpers ──────────────────────────────────────────────────────────

function mapRow(row: MessageRow): import('./types.js').MessageRow {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function mapMemberRow(row: MembershipRow): MembershipRow {
  return row;
}

// ─── createMessage ───────────────────────────────────────────────────────────

/**
 * Inserta un nuevo mensaje en la conversación y lo devuelve como tipo público.
 * Cumple Requisito 4.1.
 */
export async function createMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<Message> {
  const { conversationId, senderId, body } = params;
  const id = randomUUID();

  await pool.query(
    `INSERT INTO messages (id, conversation_id, sender_id, body)
     VALUES (?, ?, ?, ?)`,
    [id, conversationId, senderId, body],
  );

  const [rows] = await pool.query<MessageRow[]>(
    'SELECT * FROM messages WHERE id = ? LIMIT 1',
    [id],
  );

  return toPublicMessage(mapRow(rows[0]));
}

// ─── listMessages ────────────────────────────────────────────────────────────

/**
 * Devuelve los mensajes de una conversación con paginación keyset.
 *
 * @param conversationId  ID de la conversación.
 * @param cursor          Cursor ISO datetime de `created_at` del último mensaje
 *                        visto (opcional). Cuando se pasa, devuelve mensajes
 *                        anteriores a ese cursor.
 * @param limit           Máximo de mensajes a devolver (default 30).
 *
 * Orden: DESC por (created_at, id) → los más recientes primero en cada página.
 * Cumple Requisitos 3.1, 3.2.
 */
export async function listMessages(
  conversationId: string,
  cursor: string | null,
  limit: number,
): Promise<Message[]> {
  let rows: MessageRow[];

  if (cursor) {
    [rows] = await pool.query<MessageRow[]>(
      `SELECT * FROM messages
       WHERE conversation_id = ?
         AND (created_at < ? OR (created_at = ? AND id < ?))
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [conversationId, cursor, cursor, cursor, limit],
    );
  } else {
    [rows] = await pool.query<MessageRow[]>(
      `SELECT * FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [conversationId, limit],
    );
  }

  return rows.map((r) => toPublicMessage(mapRow(r)));
}

// ─── countUnreadForUser ──────────────────────────────────────────────────────

/**
 * Cuenta los mensajes no leídos del usuario en una conversación concreta.
 * Un mensaje es "no leído" si:
 *   - su sender_id != userId (no son propios)
 *   - su created_at > last_read_at del miembro (o last_read_at es NULL)
 * Cumple Requisito 6.4.
 */
export async function countUnreadForUser(
  conversationId: string,
  userId: string,
): Promise<number> {
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS unread_count
     FROM messages m
     INNER JOIN conversation_members cm
       ON cm.conversation_id = m.conversation_id
       AND cm.user_id = ?
     WHERE m.conversation_id = ?
       AND m.sender_id != ?
       AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)`,
    [userId, conversationId, userId],
  );

  return Number(countRows[0].unread_count);
}

// ─── countTotalUnread ────────────────────────────────────────────────────────

/**
 * Suma los mensajes no leídos del usuario en todas sus conversaciones.
 * Usado para el badge global del sidebar. Cumple Requisito 6.3.
 */
export async function countTotalUnread(userId: string): Promise<number> {
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_unread
     FROM messages m
     INNER JOIN conversation_members cm
       ON cm.conversation_id = m.conversation_id
       AND cm.user_id = ?
     WHERE m.sender_id != ?
       AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)`,
    [userId, userId],
  );

  return Number(countRows[0].total_unread);
}

// ─── markRead ────────────────────────────────────────────────────────────────

/**
 * Actualiza last_read_at del miembro al momento actual.
 * Después de esto countUnreadForUser devuelve 0. Cumple Requisito 6.1.
 */
export async function markRead(conversationId: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE conversation_members
     SET last_read_at = NOW()
     WHERE conversation_id = ? AND user_id = ?`,
    [conversationId, userId],
  );
}

// ─── getMembership ───────────────────────────────────────────────────────────

/**
 * Devuelve la fila de membresía de un usuario en una conversación,
 * o null si no existe. Útil para verificar membresía y leer last_read_at / last_email_at.
 */
export async function getMembership(
  conversationId: string,
  userId: string,
): Promise<MembershipRow | null> {
  const [rows] = await pool.query<MembershipRow[]>(
    `SELECT * FROM conversation_members
     WHERE conversation_id = ? AND user_id = ?
     LIMIT 1`,
    [conversationId, userId],
  );

  return rows[0] ?? null;
}

// ─── setLastEmailAt ──────────────────────────────────────────────────────────

/**
 * Actualiza last_email_at del miembro para controlar el throttling de correos.
 * Cumple Requisito 7.2.
 */
export async function setLastEmailAt(
  conversationId: string,
  userId: string,
  date: Date,
): Promise<void> {
  await pool.query(
    `UPDATE conversation_members
     SET last_email_at = ?
     WHERE conversation_id = ? AND user_id = ?`,
    [date, conversationId, userId],
  );
}
