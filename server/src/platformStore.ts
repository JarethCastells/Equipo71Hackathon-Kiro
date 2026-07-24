import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import type { UserPlatform } from './types.js'

interface PlatformRow extends RowDataPacket {
  id: string
  user_id: string
  platform_name: string
  url: string
  created_at: Date
}

function mapRow(row: PlatformRow): UserPlatform {
  return {
    id: row.id,
    userId: row.user_id,
    platformName: row.platform_name,
    url: row.url,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

const MAX_PLATFORMS_PER_USER = 8

export async function listPlatforms(userId: string): Promise<UserPlatform[]> {
  const [rows] = await pool.query<PlatformRow[]>(
    'SELECT * FROM user_platforms WHERE user_id = ? ORDER BY created_at ASC',
    [userId],
  )
  return rows.map(mapRow)
}

export async function countPlatforms(userId: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM user_platforms WHERE user_id = ?',
    [userId],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function addPlatform(userId: string, platformName: string, url: string): Promise<UserPlatform> {
  const id = randomUUID()
  await pool.query('INSERT INTO user_platforms (id, user_id, platform_name, url) VALUES (?, ?, ?, ?)', [
    id,
    userId,
    platformName,
    url,
  ])
  const [rows] = await pool.query<PlatformRow[]>('SELECT * FROM user_platforms WHERE id = ?', [id])
  return mapRow(rows[0])
}

export async function removePlatform(userId: string, platformId: string): Promise<boolean> {
  const [result] = await pool.query('DELETE FROM user_platforms WHERE id = ? AND user_id = ?', [
    platformId,
    userId,
  ])
  return (result as { affectedRows: number }).affectedRows > 0
}

export { MAX_PLATFORMS_PER_USER }
