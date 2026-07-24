import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import type { HiringAgreement } from './types.js'

interface HiringAgreementRow extends RowDataPacket {
  id: string
  recruiter_id: string
  freelancer_id: string
  posting_id: string | null
  agreed_amount: string
  agreement_text: string
  accepted_at: Date
  ip_address: string | null
}

function mapRow(row: HiringAgreementRow): HiringAgreement {
  return {
    id: row.id,
    recruiterId: row.recruiter_id,
    freelancerId: row.freelancer_id,
    postingId: row.posting_id,
    agreedAmount: Number(row.agreed_amount),
    agreementText: row.agreement_text,
    acceptedAt: new Date(row.accepted_at).toISOString(),
    ipAddress: row.ip_address,
  }
}

export async function createHiringAgreement(input: {
  recruiterId: string
  freelancerId: string
  postingId?: string | null
  agreedAmount: number
  agreementText: string
  ipAddress?: string | null
}): Promise<HiringAgreement> {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO hiring_agreements (id, recruiter_id, freelancer_id, posting_id, agreed_amount, agreement_text, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.recruiterId,
      input.freelancerId,
      input.postingId ?? null,
      input.agreedAmount,
      input.agreementText,
      input.ipAddress ?? null,
    ],
  )
  const [rows] = await pool.query<HiringAgreementRow[]>('SELECT * FROM hiring_agreements WHERE id = ?', [id])
  return mapRow(rows[0])
}

export async function listAgreementsForRecruiter(
  recruiterId: string,
): Promise<(HiringAgreement & { freelancerName: string; postingTitle: string | null })[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, u.name as freelancer_name, p.title as posting_title
     FROM hiring_agreements a
     JOIN users u ON u.id = a.freelancer_id
     LEFT JOIN job_postings p ON p.id = a.posting_id
     WHERE a.recruiter_id = ?
     ORDER BY a.accepted_at DESC`,
    [recruiterId],
  )
  return rows.map((row) => ({
    ...mapRow(row as HiringAgreementRow),
    freelancerName: row.freelancer_name,
    postingTitle: row.posting_title,
  }))
}
