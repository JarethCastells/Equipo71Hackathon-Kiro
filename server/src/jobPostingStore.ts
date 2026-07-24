import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import type { AccountRole, JobPosting } from './types.js'

interface JobPostingRow extends RowDataPacket {
  id: string
  created_by: string
  title: string
  description: string
  budget_per_hour: string
  role_target: AccountRole
  skills: string | null
  perks: string | null
  created_at: Date
  updated_at: Date | null
}

function mapRow(row: JobPostingRow): JobPosting {
  return {
    id: row.id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    budgetPerHour: Number(row.budget_per_hour),
    roleTarget: row.role_target,
    skills: row.skills,
    perks: row.perks,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}


export async function createJobPosting(input: {
  createdBy: string
  title: string
  description: string
  budgetPerHour: number
  roleTarget: AccountRole
  skills?: string
  perks?: string
}): Promise<JobPosting> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO job_postings (id, created_by, title, description, budget_per_hour, role_target, skills, perks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.createdBy,
      input.title,
      input.description,
      input.budgetPerHour,
      input.roleTarget,
      input.skills ?? null,
      input.perks ?? null,
    ],
  )
  const [rows] = await pool.query<JobPostingRow[]>('SELECT * FROM job_postings WHERE id = ?', [id])
  return mapRow(rows[0])
}

export async function listJobPostings(limit = 20): Promise<JobPosting[]> {
  const [rows] = await pool.query<JobPostingRow[]>(
    'SELECT * FROM job_postings ORDER BY created_at DESC LIMIT ?',
    [limit],
  )
  return rows.map(mapRow)
}

export async function findJobPostingById(id: string): Promise<JobPosting | undefined> {
  const [rows] = await pool.query<JobPostingRow[]>('SELECT * FROM job_postings WHERE id = ?', [id])
  return rows[0] ? mapRow(rows[0]) : undefined
}

/**
 * Usuarios cuyo rol coincide con el objetivo de la oferta, que tienen las
 * notificaciones de nuevos matches activadas, y cuya cuenta está verificada.
 * Es la base del "avísame por correo si hay una oferta que se ajuste a mi
 * perfil": se ejecuta justo después de publicar una oferta nueva.
 */
export async function findMatchingUsersForPosting(posting: JobPosting): Promise<
  { id: string; name: string; email: string }[]
> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, email FROM users
     WHERE role = ? AND email_verified = 1 AND notify_new_matches = 1 AND id != ?`,
    [posting.roleTarget, posting.createdBy],
  )
  return rows as { id: string; name: string; email: string }[]
}

export async function updateJobPosting(
  id: string,
  createdBy: string,
  input: {
    title?: string
    description?: string
    budgetPerHour?: number
    roleTarget?: AccountRole
    skills?: string
    perks?: string
  },
): Promise<JobPosting | undefined> {
  const existing = await findJobPostingById(id)
  if (!existing || existing.createdBy !== createdBy) {
    return undefined
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (input.title !== undefined) {
    fields.push('title = ?')
    values.push(input.title)
  }
  if (input.description !== undefined) {
    fields.push('description = ?')
    values.push(input.description)
  }
  if (input.budgetPerHour !== undefined) {
    fields.push('budget_per_hour = ?')
    values.push(input.budgetPerHour)
  }
  if (input.roleTarget !== undefined) {
    fields.push('role_target = ?')
    values.push(input.roleTarget)
  }
  if (input.skills !== undefined) {
    fields.push('skills = ?')
    values.push(input.skills || null)
  }
  if (input.perks !== undefined) {
    fields.push('perks = ?')
    values.push(input.perks || null)
  }

  fields.push('updated_at = NOW()')

  if (fields.length > 0) {
    values.push(id, createdBy)
    await pool.query(`UPDATE job_postings SET ${fields.join(', ')} WHERE id = ? AND created_by = ?`, values)
  }


  return findJobPostingById(id)
}

export async function deleteJobPosting(id: string, createdBy: string): Promise<boolean> {
  const existing = await findJobPostingById(id)
  if (!existing || existing.createdBy !== createdBy) {
    return false
  }

  await pool.query('DELETE FROM job_postings WHERE id = ? AND created_by = ?', [id, createdBy])
  return true
}

