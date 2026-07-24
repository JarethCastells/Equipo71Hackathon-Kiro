export type AccountRole = 'freelancer' | 'voluntario' | 'reclutador';

export type RateType = 'hourly' | 'project';

export type UserPlan = 'libre' | 'plus' | 'pro';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AccountRole;
  emailVerified: boolean;
  verificationTokenHash: string | null;
  verificationTokenExpires: string | null;
  avatarUrl: string | null;
  bio: string | null;
  plan: UserPlan;
  pendingEmail: string | null;
  pendingEmailTokenHash: string | null;
  pendingEmailExpires: string | null;
  totpSecret: string | null;
  totpEnabled: boolean;
  notifyNewMatches: boolean;
  notifySecurity: boolean;
  notifyMessagesEmail: boolean;
  notifyMessagesPhone: boolean;
  phoneNumber: string | null;
  // --- Datos específicos por rol (onboarding) ---
  onboardingCompleted: boolean;
  profession: string | null;
  location: string | null;
  interests: string | null;
  rateType: RateType | null;
  rateAmount: number | null;
  cvUrl: string | null;
  availability: string | null;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  emailVerified: boolean;
  avatarUrl: string | null;
  bio: string | null;
  plan: UserPlan;
  pendingEmail: string | null;
  totpEnabled: boolean;
  notifyNewMatches: boolean;
  notifySecurity: boolean;
  notifyMessagesEmail: boolean;
  notifyMessagesPhone: boolean;
  phoneNumber: string | null;
  onboardingCompleted: boolean;
  profession: string | null;
  location: string | null;
  interests: string | null;
  rateType: RateType | null;
  rateAmount: number | null;
  cvUrl: string | null;
  availability: string | null;
  createdAt: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    plan: user.plan ?? 'libre',
    pendingEmail: user.pendingEmail,
    totpEnabled: user.totpEnabled,
    notifyNewMatches: user.notifyNewMatches,
    notifySecurity: user.notifySecurity,
    notifyMessagesEmail: user.notifyMessagesEmail ?? true,
    notifyMessagesPhone: user.notifyMessagesPhone ?? false,
    phoneNumber: user.phoneNumber,
    onboardingCompleted: user.onboardingCompleted,
    profession: user.profession,
    location: user.location,
    interests: user.interests,
    rateType: user.rateType,
    rateAmount: user.rateAmount,
    cvUrl: user.cvUrl,
    availability: user.availability,
    createdAt: user.createdAt,
  };
}

export interface UserPlatform {
  id: string;
  userId: string;
  platformName: string;
  url: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  userId: string;
  bankName: string;
  holderName: string;
  accountNumberEncrypted: string;
  accountLast4: string;
  isDefault: boolean;
  createdAt: string;
}

export interface PublicBankAccount {
  id: string;
  bankName: string;
  holderName: string;
  accountLast4: string;
  isDefault: boolean;
  createdAt: string;
}

export function toPublicBankAccount(account: BankAccount): PublicBankAccount {
  return {
    id: account.id,
    bankName: account.bankName,
    holderName: account.holderName,
    accountLast4: account.accountLast4,
    isDefault: account.isDefault,
    createdAt: account.createdAt,
  };
}

export type ActivityEventType =
  | 'account_created'
  | 'email_verified'
  | 'password_changed'
  | 'email_change_requested'
  | 'email_changed'
  | 'profile_updated'
  | 'avatar_updated'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'bank_account_added'
  | 'bank_account_removed'
  | 'login'
  | 'login_failed_2fa';

export interface ActivityLogEntry {
  id: string;
  userId: string;
  eventType: ActivityEventType;
  description: string;
  ipAddress: string | null;
  createdAt: string;
}

export type NotificationType = 'new_match' | 'security' | 'system';

export interface NotificationEntry {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface JobPosting {
  id: string;
  createdBy: string;
  title: string;
  description: string;
  budgetPerHour: number;
  roleTarget: AccountRole;
  skills: string | null;
  // Incentivos no monetarios (comida, pasajes, hospedaje...), sobre todo
  // relevantes en vacantes dirigidas a voluntarios.
  perks: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export type JobApplicationStatus = 'pending' | 'accepted' | 'rejected';

export interface JobApplication {
  id: string;
  postingId: string;
  applicantId: string;
  message: string | null;
  status: JobApplicationStatus;
  createdAt: string;
}

export interface HiringAgreement {
  id: string;
  recruiterId: string;
  freelancerId: string;
  postingId: string | null;
  agreedAmount: number;
  agreementText: string;
  acceptedAt: string;
  ipAddress: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensajería directa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forma pública de una conversación. Nunca expone `dm_key` (clave interna de
 * deduplicación) ni `is_group` como entero crudo.
 */
export interface Conversation {
  id: string;
  createdBy: string;
  isGroup: boolean;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

/**
 * Entrada de bandeja: conversación enriquecida con el otro participante,
 * el último mensaje y el conteo de no leídos del usuario en sesión.
 * Cumple Requisito 2.2.
 */
export interface ConversationSummary extends Conversation {
  otherParticipant: PublicUser;
  lastMessage: Message | null;
  unreadCount: number;
}

/**
 * Forma pública de un mensaje. Solo expone emisor, cuerpo y fecha;
 * nunca campos internos de la tabla. Cumple Requisito 3.4.
 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

/**
 * Fila interna tal como llega de la BD (snake_case → camelCase).
 * Incluye `dmKey` e `isGroup` como número; se usa solo dentro de los stores.
 */
export interface ConversationRow {
  id: string;
  createdBy: string;
  isGroup: number; // TINYINT(1) de MySQL
  title: string | null;
  dmKey: string | null; // clave interna, no exponer nunca
  lastMessageAt: string | null;
  createdAt: string;
}

/**
 * Fila interna de mensaje tal como llega de la BD.
 */
export interface MessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

/** Convierte una fila interna de conversación al tipo público. Omite `dmKey`. */
export function toPublicConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    createdBy: row.createdBy,
    isGroup: row.isGroup !== 0,
    title: row.title,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
  };
}

/** Convierte una fila interna de mensaje al tipo público. */
export function toPublicMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt,
  };
}
