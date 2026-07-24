import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'

export interface UserPhoto {
  id: string
  userId: string
  photoUrl: string
  caption: string | null
  createdAt: string
}

export interface UserPost {
  id: string
  userId: string
  title: string
  content: string
  imageUrl: string | null
  createdAt: string
}

interface PhotoRow extends RowDataPacket {
  id: string
  user_id: string
  photo_url: string
  caption: string | null
  created_at: Date
}

interface PostRow extends RowDataPacket {
  id: string
  user_id: string
  title: string
  content: string
  image_url: string | null
  created_at: Date
}

function mapPhotoRow(row: PhotoRow): UserPhoto {
  return {
    id: row.id,
    userId: row.user_id,
    photoUrl: row.photo_url,
    caption: row.caption,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function mapPostRow(row: PostRow): UserPost {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    imageUrl: row.image_url,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

// --- Fotos / Galería ---

export async function addPhoto(input: {
  userId: string
  photoUrl: string
  caption?: string
}): Promise<UserPhoto> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO user_photos (id, user_id, photo_url, caption) VALUES (?, ?, ?, ?)`,
    [id, input.userId, input.photoUrl, input.caption?.trim() || null],
  )
  const [rows] = await pool.query<PhotoRow[]>('SELECT * FROM user_photos WHERE id = ?', [id])
  return mapPhotoRow(rows[0])
}

export async function listPhotosForUser(userId: string): Promise<UserPhoto[]> {
  const [rows] = await pool.query<PhotoRow[]>(
    'SELECT * FROM user_photos WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  )
  return rows.map(mapPhotoRow)
}

export async function deletePhoto(id: string, userId: string): Promise<boolean> {
  const [res] = await pool.query<RowDataPacket[]>(
    'DELETE FROM user_photos WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  return (res as unknown as { affectedRows: number }).affectedRows > 0
}

// --- Mini-Blog / Publicaciones ---

export async function createPost(input: {
  userId: string
  title: string
  content: string
  imageUrl?: string
}): Promise<UserPost> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO user_posts (id, user_id, title, content, image_url) VALUES (?, ?, ?, ?, ?)`,
    [id, input.userId, input.title.trim(), input.content.trim(), input.imageUrl || null],
  )
  const [rows] = await pool.query<PostRow[]>('SELECT * FROM user_posts WHERE id = ?', [id])
  return mapPostRow(rows[0])
}

export async function listPostsForUser(userId: string): Promise<UserPost[]> {
  const [rows] = await pool.query<PostRow[]>(
    'SELECT * FROM user_posts WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  )
  return rows.map(mapPostRow)
}

export async function deletePost(id: string, userId: string): Promise<boolean> {
  const [res] = await pool.query<RowDataPacket[]>(
    'DELETE FROM user_posts WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  return (res as unknown as { affectedRows: number }).affectedRows > 0
}
