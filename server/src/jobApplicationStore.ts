import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import type { AccountRole, JobApplication, JobApplicationStatus } from './types.js'

interface JobApplicationRow extends RowDataPacket {
  id: string
  posting_id: string
  applicant_id: string
  message: string | null
  status: JobApplicationStatus
  created_at: Date
}

function mapRow(row: JobApplicationRow): JobApplication {
  return {
    id: row.id,
    postingId: row.posting_id,
    applicantId: row.applicant_id,
    message: row.message,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function createApplication(input: {
  postingId: string
  applicantId: string
  message?: string | null
}): Promise<JobApplication> {
  const id = randomUUID()
  await pool.query(
    'INSERT INTO job_applications (id, posting_id, applicant_id, message) VALUES (?, ?, ?, ?)',
    [id, input.postingId, input.applicantId, input.message ?? null],
  )
  const [rows] = await pool.query<JobApplicationRow[]>('SELECT * FROM job_applications WHERE id = ?', [id])
  return mapRow(rows[0])
}

export async function hasApplied(postingId: string, applicantId: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM job_applications WHERE posting_id = ? AND applicant_id = ? LIMIT 1',
    [postingId, applicantId],
  )
  return rows.length > 0
}

/** Postulaciones a una oferta, junto con datos públicos básicos del postulante. */
export async function listApplicationsForPosting(
  postingId: string,
): Promise<(JobApplication & { applicantName: string; applicantEmail: string; applicantRole: AccountRole; applicantAvatarUrl: string | null })[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, u.name as applicant_name, u.email as applicant_email, u.role as applicant_role, u.avatar_url as applicant_avatar_url
     FROM job_applications a
     JOIN users u ON u.id = a.applicant_id
     WHERE a.posting_id = ?
     ORDER BY a.created_at DESC`,
    [postingId],
  )
  return rows.map((row) => ({
    ...mapRow(row as JobApplicationRow),
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    applicantRole: row.applicant_role,
    applicantAvatarUrl: row.applicant_avatar_url,
  }))
}

/** Postulaciones que un usuario ha hecho, con el título de la oferta. */
export async function listApplicationsByApplicant(
  applicantId: string,
): Promise<(JobApplication & { postingTitle: string })[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, p.title as posting_title
     FROM job_applications a
     JOIN job_postings p ON p.id = a.posting_id
     WHERE a.applicant_id = ?
     ORDER BY a.created_at DESC`,
    [applicantId],
  )
  return rows.map((row) => ({ ...mapRow(row as JobApplicationRow), postingTitle: row.posting_title }))
}

export async function findApplicationById(id: string): Promise<JobApplication | undefined> {
  const [rows] = await pool.query<JobApplicationRow[]>('SELECT * FROM job_applications WHERE id = ?', [id])
  return rows[0] ? mapRow(rows[0]) : undefined
}

export async function updateApplicationStatus(id: string, status: JobApplicationStatus): Promise<void> {
  await pool.query('UPDATE job_applications SET status = ? WHERE id = ?', [status, id])
}
