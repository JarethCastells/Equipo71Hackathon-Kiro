import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import { listBankAccounts } from './bankAccountStore.js'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed'
export type PaymentProvider = 'stripe' | 'mercadopago' | 'conekta' | 'simulated'

export interface PaymentRecord {
  id: string
  agreementId: string
  recruiterId: string
  freelancerId: string
  amount: number
  currency: string
  provider: PaymentProvider
  providerPaymentId: string | null
  status: PaymentStatus
  destinationBankName: string | null
  destinationAccountLast4: string | null
  createdAt: string
  paidAt: string | null
}

interface PaymentRow extends RowDataPacket {
  id: string
  agreement_id: string
  recruiter_id: string
  freelancer_id: string
  amount: string
  currency: string
  provider: string
  provider_payment_id: string | null
  status: PaymentStatus
  destination_bank_name: string | null
  destination_account_last4: string | null
  created_at: Date
  paid_at: Date | null
}

function mapRow(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    agreementId: row.agreement_id,
    recruiterId: row.recruiter_id,
    freelancerId: row.freelancer_id,
    amount: Number(row.amount),
    currency: row.currency,
    provider: row.provider as PaymentProvider,
    providerPaymentId: row.provider_payment_id,
    status: row.status,
    destinationBankName: row.destination_bank_name,
    destinationAccountLast4: row.destination_account_last4,
    createdAt: new Date(row.created_at).toISOString(),
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
  }
}

/**
 * Obtiene la cuenta bancaria destino (predeterminada o primera) del freelancer.
 */
export async function getFreelancerDestinationAccount(freelancerId: string) {
  const accounts = await listBankAccounts(freelancerId)
  if (accounts.length === 0) return null
  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0]
  return {
    id: defaultAccount.id,
    bankName: defaultAccount.bankName,
    holderName: defaultAccount.holderName,
    accountLast4: defaultAccount.accountLast4,
  }
}

export async function createPayment(input: {
  agreementId: string
  recruiterId: string
  freelancerId: string
  amount: number
  currency?: string
  provider?: PaymentProvider
  providerPaymentId?: string | null
  status?: PaymentStatus
  destinationBankName?: string | null
  destinationAccountLast4?: string | null
}): Promise<PaymentRecord> {
  const id = randomUUID()
  const currency = input.currency ?? 'MXN'
  const provider = input.provider ?? 'stripe'
  const status = input.status ?? 'pending'
  const paidAt = status === 'succeeded' ? new Date() : null

  await pool.query(
    `INSERT INTO payments (
      id, agreement_id, recruiter_id, freelancer_id, amount, currency, provider,
      provider_payment_id, status, destination_bank_name, destination_account_last4, paid_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.agreementId,
      input.recruiterId,
      input.freelancerId,
      input.amount,
      currency,
      provider,
      input.providerPaymentId ?? null,
      status,
      input.destinationBankName ?? null,
      input.destinationAccountLast4 ?? null,
      paidAt,
    ],
  )

  const [rows] = await pool.query<PaymentRow[]>('SELECT * FROM payments WHERE id = ?', [id])
  return mapRow(rows[0])
}

export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  providerPaymentId?: string,
): Promise<PaymentRecord | null> {
  const paidAt = status === 'succeeded' ? new Date() : null

  await pool.query(
    `UPDATE payments SET status = ?, provider_payment_id = COALESCE(?, provider_payment_id), paid_at = COALESCE(?, paid_at) WHERE id = ?`,
    [status, providerPaymentId ?? null, paidAt, paymentId],
  )

  const [rows] = await pool.query<PaymentRow[]>('SELECT * FROM payments WHERE id = ?', [paymentId])
  return rows[0] ? mapRow(rows[0]) : null
}

export async function getPaymentByAgreementId(agreementId: string): Promise<PaymentRecord | null> {
  const [rows] = await pool.query<PaymentRow[]>(
    'SELECT * FROM payments WHERE agreement_id = ? ORDER BY created_at DESC LIMIT 1',
    [agreementId],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function listPaymentsForUser(
  userId: string,
): Promise<(PaymentRecord & { recruiterName: string; freelancerName: string; agreementText: string })[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.*, rec.name as recruiter_name, free.name as freelancer_name, a.agreement_text
     FROM payments p
     JOIN users rec ON rec.id = p.recruiter_id
     JOIN users free ON free.id = p.freelancer_id
     JOIN hiring_agreements a ON a.id = p.agreement_id
     WHERE p.recruiter_id = ? OR p.freelancer_id = ?
     ORDER BY p.created_at DESC`,
    [userId, userId],
  )

  return rows.map((row) => ({
    ...mapRow(row as PaymentRow),
    recruiterName: row.recruiter_name,
    freelancerName: row.freelancer_name,
    agreementText: row.agreement_text,
  }))
}
