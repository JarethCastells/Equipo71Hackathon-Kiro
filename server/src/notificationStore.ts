import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import type { NotificationEntry, NotificationType } from './types.js'

interface NotificationRow extends RowDataPacket {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  read_at: Date | null
  created_at: Date
}

function mapRow(row: NotificationRow): NotificationEntry {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<NotificationEntry> {
  const id = randomUUID()
  await pool.query('INSERT INTO notifications (id, user_id, type, title, body) VALUES (?, ?, ?, ?, ?)', [
    id,
    userId,
    type,
    title,
    body,
  ])
  const [rows] = await pool.query<NotificationRow[]>('SELECT * FROM notifications WHERE id = ?', [id])
  return mapRow(rows[0])
}

export async function listNotifications(userId: string, limit = 30): Promise<NotificationEntry[]> {
  const [rows] = await pool.query<NotificationRow[]>(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit],
  )
  return rows.map(mapRow)
}

export async function countUnread(userId: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [userId],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function markAllRead(userId: string): Promise<void> {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [userId])
}

export async function markOneRead(userId: string, notificationId: string): Promise<void> {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND id = ?', [
    userId,
    notificationId,
  ])
}
