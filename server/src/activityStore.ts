import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import type { ActivityEventType, ActivityLogEntry } from './types.js'

interface ActivityRow extends RowDataPacket {
  id: string
  user_id: string
  event_type: ActivityEventType
  description: string
  ip_address: string | null
  created_at: Date
}

function mapRow(row: ActivityRow): ActivityLogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    description: row.description,
    ipAddress: row.ip_address,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function logActivity(
  userId: string,
  eventType: ActivityEventType,
  description: string,
  ipAddress?: string | null,
): Promise<void> {
  await pool.query(
    'INSERT INTO activity_log (id, user_id, event_type, description, ip_address) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), userId, eventType, description, ipAddress ?? null],
  )
}

export async function listActivity(userId: string, limit = 20): Promise<ActivityLogEntry[]> {
  const [rows] = await pool.query<ActivityRow[]>(
    'SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit],
  )
  return rows.map(mapRow)
}
