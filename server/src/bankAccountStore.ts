import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import { encryptSecret } from './crypto.js'
import type { BankAccount } from './types.js'

interface BankAccountRow extends RowDataPacket {
  id: string
  user_id: string
  bank_name: string
  holder_name: string
  account_number_encrypted: string
  account_last4: string
  is_default: number
  created_at: Date
}

function mapRow(row: BankAccountRow): BankAccount {
  return {
    id: row.id,
    userId: row.user_id,
    bankName: row.bank_name,
    holderName: row.holder_name,
    accountNumberEncrypted: row.account_number_encrypted,
    accountLast4: row.account_last4,
    isDefault: Boolean(row.is_default),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function listBankAccounts(userId: string): Promise<BankAccount[]> {
  const [rows] = await pool.query<BankAccountRow[]>(
    'SELECT * FROM bank_accounts WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    [userId],
  )
  return rows.map(mapRow)
}

export async function countBankAccounts(userId: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as count FROM bank_accounts WHERE user_id = ?',
    [userId],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function addBankAccount(input: {
  userId: string
  bankName: string
  holderName: string
  accountNumber: string
  isDefault: boolean
}): Promise<BankAccount> {
  const id = randomUUID()
  const encrypted = encryptSecret(input.accountNumber)
  const last4 = input.accountNumber.slice(-4)

  if (input.isDefault) {
    await pool.query('UPDATE bank_accounts SET is_default = 0 WHERE user_id = ?', [input.userId])
  }

  await pool.query(
    `INSERT INTO bank_accounts (id, user_id, bank_name, holder_name, account_number_encrypted, account_last4, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.userId, input.bankName, input.holderName, encrypted, last4, input.isDefault ? 1 : 0],
  )

  const [rows] = await pool.query<BankAccountRow[]>('SELECT * FROM bank_accounts WHERE id = ?', [id])
  return mapRow(rows[0])
}

export async function removeBankAccount(userId: string, accountId: string): Promise<boolean> {
  const [result] = await pool.query('DELETE FROM bank_accounts WHERE id = ? AND user_id = ?', [
    accountId,
    userId,
  ])
  return (result as { affectedRows: number }).affectedRows > 0
}

export async function findBankAccountById(userId: string, accountId: string): Promise<BankAccount | undefined> {
  const [rows] = await pool.query<BankAccountRow[]>(
    'SELECT * FROM bank_accounts WHERE id = ? AND user_id = ? LIMIT 1',
    [accountId, userId],
  )
  return rows[0] ? mapRow(rows[0]) : undefined
}
