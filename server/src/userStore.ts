import { randomUUID } from 'node:crypto'
import type { RowDataPacket } from 'mysql2'
import pool from './db.js'
import type { AccountRole, RateType, User } from './types.js'

interface UserRow extends RowDataPacket {
  id: string
  name: string
  email: string
  password_hash: string
  role: AccountRole
  email_verified: number
  verification_token_hash: string | null
  verification_token_expires: Date | null
  avatar_url: string | null
  bio: string | null
  plan: 'libre' | 'plus' | 'pro'
  pending_email: string | null

  pending_email_token_hash: string | null
  pending_email_expires: Date | null
  totp_secret: string | null
  totp_enabled: number
  notify_new_matches: number
  notify_security: number
  notify_messages_email: number
  notify_messages_phone: number
  phone_number: string | null
  onboarding_completed: number
  profession: string | null
  location: string | null
  interests: string | null
  rate_type: RateType | null
  rate_amount: string | null
  cv_url: string | null
  availability: string | null
  created_at: Date
}

function mapRow(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    emailVerified: Boolean(row.email_verified),
    verificationTokenHash: row.verification_token_hash,
    verificationTokenExpires: row.verification_token_expires ? new Date(row.verification_token_expires).toISOString() : null,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    plan: row.plan ?? 'libre',
    pendingEmail: row.pending_email,

    pendingEmailTokenHash: row.pending_email_token_hash,
    pendingEmailExpires: row.pending_email_expires ? new Date(row.pending_email_expires).toISOString() : null,
    totpSecret: row.totp_secret,
    totpEnabled: Boolean(row.totp_enabled),
    notifyNewMatches: Boolean(row.notify_new_matches),
    notifySecurity: Boolean(row.notify_security),
    notifyMessagesEmail: Boolean(row.notify_messages_email ?? 1),
    notifyMessagesPhone: Boolean(row.notify_messages_phone ?? 0),
    phoneNumber: row.phone_number,
    onboardingCompleted: Boolean(row.onboarding_completed),
    profession: row.profession,
    location: row.location,
    interests: row.interests,
    rateType: row.rate_type,
    rateAmount: row.rate_amount !== null ? Number(row.rate_amount) : null,
    cvUrl: row.cv_url,
    availability: row.availability,
    createdAt: new Date(row.created_at).toISOString(),
  }
}


export async function findUserByEmail(email: string): Promise<User | undefined> {
  const normalized = email.trim().toLowerCase()
  const [rows] = await pool.query<UserRow[]>('SELECT * FROM users WHERE email = ? LIMIT 1', [normalized])
  return rows[0] ? mapRow(rows[0]) : undefined
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [rows] = await pool.query<UserRow[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id])
  return rows[0] ? mapRow(rows[0]) : undefined
}

export async function findUserByVerificationTokenHash(tokenHash: string): Promise<User | undefined> {
  const [rows] = await pool.query<UserRow[]>(
    'SELECT * FROM users WHERE verification_token_hash = ? LIMIT 1',
    [tokenHash],
  )
  return rows[0] ? mapRow(rows[0]) : undefined
}

export async function findUserByPendingEmailTokenHash(tokenHash: string): Promise<User | undefined> {
  const [rows] = await pool.query<UserRow[]>(
    'SELECT * FROM users WHERE pending_email_token_hash = ? LIMIT 1',
    [tokenHash],
  )
  return rows[0] ? mapRow(rows[0]) : undefined
}

export async function createUser(input: {
  name: string
  email: string
  passwordHash: string
  role: AccountRole
  verificationTokenHash: string
  verificationTokenExpires: Date
}): Promise<User> {
  const user: User = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    role: input.role,
    emailVerified: false,
    verificationTokenHash: input.verificationTokenHash,
    verificationTokenExpires: input.verificationTokenExpires.toISOString(),
    avatarUrl: null,
    bio: null,
    plan: 'libre',
    pendingEmail: null,

    pendingEmailTokenHash: null,
    pendingEmailExpires: null,
    totpSecret: null,
    totpEnabled: false,
    notifyNewMatches: true,
    notifySecurity: true,
    notifyMessagesEmail: true,
    notifyMessagesPhone: false,
    phoneNumber: null,
    onboardingCompleted: false,

    profession: null,
    location: null,
    interests: null,
    rateType: null,
    rateAmount: null,
    cvUrl: null,
    availability: null,
    createdAt: new Date().toISOString(),
  }

  await pool.query(
    `INSERT INTO users
      (id, name, email, password_hash, role, email_verified, verification_token_hash, verification_token_expires, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.role,
      user.verificationTokenHash,
      input.verificationTokenExpires,
      new Date(user.createdAt),
    ],
  )

  return user
}

export async function setVerificationToken(
  userId: string,
  tokenHash: string,
  expires: Date,
): Promise<void> {
  await pool.query(
    'UPDATE users SET verification_token_hash = ?, verification_token_expires = ? WHERE id = ?',
    [tokenHash, expires, userId],
  )
}

export async function markEmailVerified(userId: string): Promise<void> {
  await pool.query(
    'UPDATE users SET email_verified = 1, verification_token_hash = NULL, verification_token_expires = NULL WHERE id = ?',
    [userId],
  )
}

export async function updateProfile(
  userId: string,
  input: { name?: string; bio?: string | null; avatarUrl?: string | null },
): Promise<void> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.name !== undefined) {
    fields.push('name = ?')
    values.push(input.name.trim())
  }
  if (input.bio !== undefined) {
    fields.push('bio = ?')
    values.push(input.bio)
  }
  if (input.avatarUrl !== undefined) {
    fields.push('avatar_url = ?')
    values.push(input.avatarUrl)
  }

  if (fields.length === 0) return

  values.push(userId)
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId])
}

export async function updateNotificationPrefs(
  userId: string,
  input: { notifyNewMatches?: boolean; notifySecurity?: boolean },
): Promise<void> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.notifyNewMatches !== undefined) {
    fields.push('notify_new_matches = ?')
    values.push(input.notifyNewMatches ? 1 : 0)
  }
  if (input.notifySecurity !== undefined) {
    fields.push('notify_security = ?')
    values.push(input.notifySecurity ? 1 : 0)
  }

  if (fields.length === 0) return

  values.push(userId)
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
}

export async function setPendingEmail(
  userId: string,
  pendingEmail: string,
  tokenHash: string,
  expires: Date,
): Promise<void> {
  await pool.query(
    'UPDATE users SET pending_email = ?, pending_email_token_hash = ?, pending_email_expires = ? WHERE id = ?',
    [pendingEmail, tokenHash, expires, userId],
  )
}

export async function confirmPendingEmail(userId: string, newEmail: string): Promise<void> {
  await pool.query(
    'UPDATE users SET email = ?, pending_email = NULL, pending_email_token_hash = NULL, pending_email_expires = NULL WHERE id = ?',
    [newEmail, userId],
  )
}

export async function clearPendingEmail(userId: string): Promise<void> {
  await pool.query(
    'UPDATE users SET pending_email = NULL, pending_email_token_hash = NULL, pending_email_expires = NULL WHERE id = ?',
    [userId],
  )
}

export async function setTotpSecret(userId: string, secret: string | null, enabled: boolean): Promise<void> {
  await pool.query('UPDATE users SET totp_secret = ?, totp_enabled = ? WHERE id = ?', [
    secret,
    enabled ? 1 : 0,
    userId,
  ])
}

/**
 * Actualiza los campos de onboarding/detalles específicos por rol. Los
 * campos que no aplican a un rol simplemente no se envían desde el
 * frontend (ej. un voluntario nunca manda rateType/rateAmount).
 */
export async function updateRoleDetails(
  userId: string,
  input: {
    profession?: string | null
    location?: string | null
    interests?: string | null
    rateType?: RateType | null
    rateAmount?: number | null
    availability?: string | null
    onboardingCompleted?: boolean
  },
): Promise<void> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.profession !== undefined) {
    fields.push('profession = ?')
    values.push(input.profession)
  }
  if (input.location !== undefined) {
    fields.push('location = ?')
    values.push(input.location)
  }
  if (input.interests !== undefined) {
    fields.push('interests = ?')
    values.push(input.interests)
  }
  if (input.rateType !== undefined) {
    fields.push('rate_type = ?')
    values.push(input.rateType)
  }
  if (input.rateAmount !== undefined) {
    fields.push('rate_amount = ?')
    values.push(input.rateAmount)
  }
  if (input.availability !== undefined) {
    fields.push('availability = ?')
    values.push(input.availability)
  }
  if (input.onboardingCompleted !== undefined) {
    fields.push('onboarding_completed = ?')
    values.push(input.onboardingCompleted ? 1 : 0)
  }

  if (fields.length === 0) return

  values.push(userId)
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
}

export async function setCvUrl(userId: string, cvUrl: string): Promise<void> {
  await pool.query('UPDATE users SET cv_url = ? WHERE id = ?', [cvUrl, userId])
}

export async function updateUserPlan(userId: string, plan: 'libre' | 'plus' | 'pro'): Promise<void> {
  await pool.query('UPDATE users SET plan = ? WHERE id = ?', [plan, userId])
}

export async function updateMessageNotificationSettings(
  userId: string,
  input: { notifyMessagesEmail?: boolean; notifyMessagesPhone?: boolean; phoneNumber?: string | null },
): Promise<void> {
  const fields: string[] = []
  const values: unknown[] = []

  if (input.notifyMessagesEmail !== undefined) {
    fields.push('notify_messages_email = ?')
    values.push(input.notifyMessagesEmail ? 1 : 0)
  }
  if (input.notifyMessagesPhone !== undefined) {
    fields.push('notify_messages_phone = ?')
    values.push(input.notifyMessagesPhone ? 1 : 0)
  }
  if (input.phoneNumber !== undefined) {
    fields.push('phone_number = ?')
    values.push(input.phoneNumber)
  }

  if (fields.length === 0) return
  values.push(userId)
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
}


