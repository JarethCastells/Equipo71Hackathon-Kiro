import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import type { AccountRole } from './types.js'

export interface ChatMessage {
  id: string
  senderId: string
  receiverId: string
  message: string
  readAt: string | null
  createdAt: string
}

export interface ConversationSummary {
  partnerId: string
  partnerName: string
  partnerEmail: string
  partnerRole: AccountRole
  partnerAvatarUrl: string | null
  partnerProfession: string | null
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

interface ChatMessageRow extends RowDataPacket {
  id: string
  sender_id: string
  receiver_id: string
  message: string
  read_at: Date | null
  created_at: Date
}

function mapRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    message: row.message,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function sendChatMessage(input: {
  senderId: string
  receiverId: string
  message: string
}): Promise<ChatMessage> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO chat_messages (id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)`,
    [id, input.senderId, input.receiverId, input.message.trim()],
  )

  const [rows] = await pool.query<ChatMessageRow[]>('SELECT * FROM chat_messages WHERE id = ?', [id])
  return mapRow(rows[0])
}

export async function getConversationMessages(user1Id: string, user2Id: string): Promise<ChatMessage[]> {
  const [rows] = await pool.query<ChatMessageRow[]>(
    `SELECT * FROM chat_messages
     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
     ORDER BY created_at ASC`,
    [user1Id, user2Id, user2Id, user1Id],
  )
  return rows.map(mapRow)
}

export async function markConversationAsRead(userId: string, partnerId: string): Promise<void> {
  await pool.query(
    `UPDATE chat_messages SET read_at = NOW() WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL`,
    [userId, partnerId],
  )
}

export async function listConversationsForUser(userId: string): Promise<ConversationSummary[]> {
  // Obtener usuarios distintos con los que ha habido mensajes
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
        u.id as partner_id,
        u.name as partner_name,
        u.email as partner_email,
        u.role as partner_role,
        u.avatar_url as partner_avatar_url,
        u.profession as partner_profession,
        m.message as last_message,
        m.created_at as last_message_at,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.receiver_id = ? AND cm.sender_id = u.id AND cm.read_at IS NULL) as unread_count
     FROM users u
     JOIN chat_messages m ON (
        m.id = (
          SELECT id FROM chat_messages cm2
          WHERE (cm2.sender_id = ? AND cm2.receiver_id = u.id) OR (cm2.sender_id = u.id AND cm2.receiver_id = ?)
          ORDER BY cm2.created_at DESC LIMIT 1
        )
     )
     WHERE u.id != ?
     ORDER BY m.created_at DESC`,
    [userId, userId, userId, userId],
  )

  return rows.map((r) => ({
    partnerId: r.partner_id,
    partnerName: r.partner_name,
    partnerEmail: r.partner_email,
    partnerRole: r.partner_role as AccountRole,
    partnerAvatarUrl: r.partner_avatar_url,
    partnerProfession: r.partner_profession,
    lastMessage: r.last_message,
    lastMessageAt: new Date(r.last_message_at).toISOString(),
    unreadCount: Number(r.unread_count ?? 0),
  }))
}
