export type AccountRole = 'freelancer' | 'voluntario' | 'reclutador';

export type RateType = 'hourly' | 'project';

export type UserPlan = 'libre' | 'plus' | 'pro';

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

export interface AuthResponse {
  token: string;
  user: PublicUser;
  emailPreviewUrl?: string;
}

export interface LoginResponse {
  token?: string;
  user?: PublicUser;
  requiresTwoFactor?: boolean;
  pendingToken?: string;
}

export interface SignupResponse {
  message: string;
  emailSent: boolean;
  emailPreviewUrl?: string;
}

export interface ResendResponse {
  message: string;
  emailPreviewUrl?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  holderName: string;
  accountLast4: string;
  isDefault: boolean;
  createdAt: string;
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

export interface ActivityEntry {
  id: string;
  eventType: ActivityEventType;
  description: string;
  ipAddress: string | null;
  createdAt: string;
}

export type NotificationType = 'new_match' | 'security' | 'system';

export interface NotificationEntry {
  id: string;
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
  perks: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface UserPlatform {
  id: string;
  platformName: string;
  url: string;
  createdAt: string;
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

export interface JobApplicationWithApplicant extends JobApplication {
  applicantName: string;
  applicantEmail: string;
  applicantRole: AccountRole;
  applicantAvatarUrl: string | null;
}

export interface JobApplicationWithPosting extends JobApplication {
  postingTitle: string;
}

export interface HiringAgreement {
  id: string;
  recruiterId: string;
  freelancerId: string;
  postingId: string | null;
  agreedAmount: number;
  agreementText: string;
  acceptedAt: string;
}

export interface HiringAgreementWithDetails extends HiringAgreement {
  freelancerName: string;
  postingTitle: string | null;
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed';
export type PaymentProvider = 'stripe' | 'mercadopago' | 'conekta' | 'simulated';

export interface PayoutDestination {
  id: string;
  bankName: string;
  holderName: string;
  accountLast4: string;
}

export interface PaymentRecord {
  id: string;
  agreementId: string;
  recruiterId: string;
  freelancerId: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  status: PaymentStatus;
  destinationBankName: string | null;
  destinationAccountLast4: string | null;
  createdAt: string;
  paidAt: string | null;
  recruiterName?: string;
  freelancerName?: string;
  agreementText?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensajería directa (sistema nuevo con Socket.IO)
// ─────────────────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  createdBy: string;
  isGroup: boolean;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationSummary extends Conversation {
  otherParticipant: PublicUser;
  lastMessage: Message | null;
  unreadCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensajería legacy (chat directo con IA Gemini)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface LegacyConversationSummary {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerRole: AccountRole;
  partnerAvatarUrl: string | null;
  partnerProfession: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface AIAnalysisResponse {
  analysis: string;
  suggestedReplies: string[];
  decisionAdvice: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Galería de fotos & mini-blog
// ─────────────────────────────────────────────────────────────────────────────

export interface UserPhoto {
  id: string;
  userId: string;
  photoUrl: string;
  caption: string | null;
  createdAt: string;
}

export interface UserPost {
  id: string;
  userId: string;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cliente HTTP
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'talentflow_token';

export class ApiError extends Error {
  status: number;
  emailNotVerified?: boolean;
  expired?: boolean;

  constructor(
    message: string,
    status: number,
    extra?: { emailNotVerified?: boolean; expired?: boolean },
  ) {
    super(message);
    this.status = status;
    this.emailNotVerified = extra?.emailNotVerified;
    this.expired = extra?.expired;
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'Ocurrió un error inesperado.', res.status, {
      emailNotVerified: data.emailNotVerified,
      expired: data.expired,
    });
  }

  return data as T;
}

// --- Auth ---

export function signup(input: {
  name: string;
  email: string;
  password: string;
  role: AccountRole;
}): Promise<SignupResponse> {
  return request<SignupResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function verifyLoginCode(input: {
  pendingToken: string;
  code: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/verify-login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function verifyEmail(token: string): Promise<AuthResponse & { alreadyVerified?: boolean }> {
  return request<AuthResponse & { alreadyVerified?: boolean }>('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function resendVerification(email: string): Promise<ResendResponse> {
  return request<ResendResponse>('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function fetchMe(token?: string): Promise<{ user: PublicUser }> {
  return request<{ user: PublicUser }>('/api/auth/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// --- Perfil ---

export function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  return fetch(`${API_URL}/api/profile/avatar`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'No se pudo subir la imagen.', res.status);
    return data;
  });
}

export function updateProfile(input: {
  name?: string;
  bio?: string;
}): Promise<{ user: PublicUser }> {
  return request<{ user: PublicUser }>('/api/profile/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>('/api/profile/password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function requestEmailChange(input: {
  newEmail: string;
  currentPassword: string;
}): Promise<{ message: string; emailPreviewUrl?: string }> {
  return request('/api/profile/email/request-change', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function confirmEmailChange(token: string): Promise<{ message: string }> {
  return request('/api/profile/email/confirm-change', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function updateNotificationPrefs(input: {
  notifyNewMatches?: boolean;
  notifySecurity?: boolean;
}): Promise<{ user: PublicUser }> {
  return request('/api/profile/notifications/prefs', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateUserPlan(plan: UserPlan): Promise<{ user: PublicUser }> {
  return request('/api/profile/plan', {
    method: 'PATCH',
    body: JSON.stringify({ plan }),
  });
}

export function upgradePlanCheckout(data: {
  plan: UserPlan;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  holderName?: string;
}): Promise<{ user: PublicUser; message: string }> {
  return request('/api/profile/upgrade-plan-checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface OptimizedCvResult {
  professionalSummary: string;
  highlightedSkills: string[];
  tailoredExperience: string;
  strengthsAdvice: string;
  formattedCvText: string;
  compatibilityScore: number;
  atsAnalysis?: {
    score: number;
    platformCompatibility: {
      workday: string;
      greenhouse: string;
      taleo: string;
      lever: string;
    };
    passedChecks: string[];
    keywordsFound: string[];
    missingKeywords: string[];
  };
}

export function optimizeCvWithAI(data: {
  currentCvText?: string;
  targetJobTitle?: string;
  targetJobDescription?: string;
  customPrompt?: string;
}): Promise<{ optimizedCv: OptimizedCvResult }> {
  return request('/api/profile/cv/optimize', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function saveGeneratedCv(data: {
  bio?: string;
  profession?: string;
  formattedCvText: string;
}): Promise<{ user: PublicUser; message: string }> {
  return request('/api/profile/cv/save-generated', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// --- Verificación en dos pasos (2FA) ---

export function setup2FA(): Promise<{ secret: string; qrDataUrl: string }> {
  return request('/api/2fa/setup', { method: 'POST' });
}

export function enable2FA(code: string): Promise<{ message: string }> {
  return request('/api/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
}

export function disable2FA(currentPassword: string): Promise<{ message: string }> {
  return request('/api/2fa/disable', { method: 'POST', body: JSON.stringify({ currentPassword }) });
}

// --- Cuentas bancarias ---

export function listBankAccounts(): Promise<{ accounts: BankAccount[] }> {
  return request('/api/bank-accounts');
}

export function addBankAccount(input: {
  bankName: string;
  holderName: string;
  accountNumber: string;
  isDefault?: boolean;
}): Promise<{ account: BankAccount }> {
  return request('/api/bank-accounts', { method: 'POST', body: JSON.stringify(input) });
}

export function removeBankAccount(id: string): Promise<{ message: string }> {
  return request(`/api/bank-accounts/${id}`, { method: 'DELETE' });
}

// --- Actividad ---

export function listActivity(): Promise<{ entries: ActivityEntry[] }> {
  return request('/api/activity');
}

// --- Notificaciones ---

export function listNotifications(): Promise<{
  entries: NotificationEntry[];
  unreadCount: number;
}> {
  return request('/api/notifications');
}

export function markAllNotificationsRead(): Promise<{ message: string }> {
  return request('/api/notifications/read-all', { method: 'POST' });
}

export function markNotificationRead(id: string): Promise<{ message: string }> {
  return request(`/api/notifications/${id}/read`, { method: 'POST' });
}

// --- Ofertas de proyecto ---

export function listJobPostings(): Promise<{ postings: JobPosting[] }> {
  return request('/api/job-postings');
}

export function createJobPosting(input: {
  title: string;
  description: string;
  budgetPerHour: number;
  roleTarget: AccountRole;
  skills?: string;
  perks?: string;
}): Promise<{ posting: JobPosting }> {
  return request('/api/job-postings', { method: 'POST', body: JSON.stringify(input) });
}

export function updateJobPosting(
  id: string,
  input: {
    title?: string;
    description?: string;
    budgetPerHour?: number;
    roleTarget?: AccountRole;
    skills?: string;
    perks?: string;
  },
): Promise<{ posting: JobPosting }> {
  return request(`/api/job-postings/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteJobPosting(id: string): Promise<{ message: string }> {
  return request(`/api/job-postings/${id}`, { method: 'DELETE' });
}

export function applyToJobPosting(
  postingId: string,
  message?: string,
): Promise<{ application: JobApplication }> {
  return request(`/api/job-postings/${postingId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function listPostingApplications(
  postingId: string,
): Promise<{ applications: JobApplicationWithApplicant[] }> {
  return request(`/api/job-postings/${postingId}/applications`);
}

// --- Matching IA ---

export interface RankedApplicant extends JobApplicationWithApplicant {
  matchScore: number;
  matchReason: string;
  strengthTags: string[];
}

export interface RankingResponse {
  applicants: RankedApplicant[];
  recommendation: { applicantId: string; reason: string } | null;
  summary: string;
  suggestion: string;
}

export function listRankedApplicants(postingId: string): Promise<RankingResponse> {
  return request(`/api/job-postings/${postingId}/ranked-applicants`);
}

export function askAI(postingId: string, question: string): Promise<{ answer: string }> {
  return request(`/api/job-postings/${postingId}/ask-ai`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export function listMyApplications(): Promise<{ applications: JobApplicationWithPosting[] }> {
  return request('/api/job-postings/my-applications');
}

export function updateApplicationStatus(
  applicationId: string,
  status: 'accepted' | 'rejected',
): Promise<{ message: string }> {
  return request(`/api/job-postings/applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function hireFreelancer(input: {
  freelancerId: string;
  postingId?: string;
  agreedAmount: number;
  agreementText: string;
}): Promise<{ agreement: HiringAgreement }> {
  return request('/api/job-postings/hire', { method: 'POST', body: JSON.stringify(input) });
}

export function listMyHiringAgreements(): Promise<{ agreements: HiringAgreementWithDetails[] }> {
  return request('/api/job-postings/my-agreements');
}

// --- Pagos & Checkout ---

export function getFreelancerDestinationAccount(
  freelancerId: string,
): Promise<{ destination: PayoutDestination | null }> {
  return request(`/api/payments/destination/${freelancerId}`);
}

export function processPaymentCheckout(input: {
  agreementId: string;
  provider?: PaymentProvider;
  paymentMethod?: 'card' | 'spei' | 'escrow';
}): Promise<{ payment: PaymentRecord; message: string }> {
  return request('/api/payments/checkout', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listMyPayments(): Promise<{ payments: PaymentRecord[] }> {
  return request('/api/payments/my-payments');
}

// --- Detalles específicos por rol / onboarding ---

export function updateRoleDetails(input: {
  profession?: string | null;
  location?: string | null;
  interests?: string | null;
  rateType?: RateType | null;
  rateAmount?: number | null;
  availability?: string | null;
  onboardingCompleted?: boolean;
}): Promise<{ user: PublicUser }> {
  return request('/api/profile/role-details', { method: 'PATCH', body: JSON.stringify(input) });
}

// --- Plataformas conectadas ---

export function listPlatforms(): Promise<{ platforms: UserPlatform[] }> {
  return request('/api/profile/platforms');
}

export function addPlatform(
  platformName: string,
  url: string,
): Promise<{ platform: UserPlatform }> {
  return request('/api/profile/platforms', {
    method: 'POST',
    body: JSON.stringify({ platformName, url }),
  });
}

export function removePlatform(id: string): Promise<{ message: string }> {
  return request(`/api/profile/platforms/${id}`, { method: 'DELETE' });
}

// --- CV ---

export function uploadCv(file: File): Promise<{ cvUrl: string }> {
  const formData = new FormData();
  formData.append('cv', file);
  return fetch(`${API_URL}/api/profile/cv`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'No se pudo subir el CV.', res.status);
    return data;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensajería directa (sistema nuevo con Socket.IO — /api/conversations)
// ─────────────────────────────────────────────────────────────────────────────

/** Crear u obtener un DM con otro usuario (idempotente por dm_key). */
export function createConversation(recipientId: string): Promise<Conversation> {
  return request<{ conversation: Conversation }>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ recipientId }),
  }).then((res) => res.conversation);
}

/** Bandeja: lista de conversaciones del usuario en sesión, ordenada por último mensaje. */
export function listConversations(): Promise<ConversationSummary[]> {
  return request<{ conversations: ConversationSummary[] }>('/api/conversations').then(
    (res) => res.conversations,
  );
}

/** Historial de mensajes de una conversación con paginación keyset. */
export function listMessages(
  conversationId: string,
  options?: { before?: string; limit?: number },
): Promise<{ messages: Message[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (options?.before) params.set('before', options.before);
  if (options?.limit != null) params.set('limit', String(options.limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request<{ messages: Message[]; nextCursor: string | null }>(
    `/api/conversations/${conversationId}/messages${qs}`,
  );
}

/** Enviar un mensaje por REST (fallback cuando el socket no está disponible). */
export function sendMessage(conversationId: string, body: string): Promise<Message> {
  return request<Message>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

/** Marcar una conversación como leída (actualiza last_read_at). */
export function markConversationRead(conversationId: string): Promise<void> {
  return request<void>(`/api/conversations/${conversationId}/read`, { method: 'POST' });
}

/** Total de mensajes no leídos del usuario en sesión. */
export function getUnreadMessageCount(): Promise<{ count: number }> {
  return request<{ unreadCount: number }>('/api/conversations/unread-count').then((res) => ({
    count: res.unreadCount,
  }));
}

/** Búsqueda mínima de contactos para iniciar un DM. */
export function searchContacts(q: string): Promise<PublicUser[]> {
  const params = new URLSearchParams({ q });
  return request<{ contacts: PublicUser[] }>(
    `/api/conversations/contacts?${params.toString()}`,
  ).then((res) => res.contacts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mensajería legacy con Gemini AI (/api/messages)
// ─────────────────────────────────────────────────────────────────────────────

export function getLegacyConversations(): Promise<{ conversations: LegacyConversationSummary[] }> {
  return request('/api/messages/conversations');
}

export function getMessagesThread(otherUserId: string): Promise<{ messages: ChatMessage[] }> {
  return request(`/api/messages/${otherUserId}`);
}

export function sendChatMessage(input: {
  receiverId: string;
  message: string;
}): Promise<{ message: ChatMessage }> {
  return request('/api/messages', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function analyzeChatWithAI(input: {
  partnerId: string;
  conversation: { senderName: string; message: string }[];
}): Promise<AIAnalysisResponse> {
  return request('/api/messages/analyze-ai', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateMessageNotificationSettings(input: {
  notifyMessagesEmail?: boolean;
  notifyMessagesPhone?: boolean;
  phoneNumber?: string;
}): Promise<{ user: PublicUser }> {
  return request('/api/messages/notification-settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// --- Galería de Fotos ---

export function listPhotos(): Promise<{ photos: UserPhoto[] }> {
  return request('/api/profile/photos');
}

export function uploadPhoto(file: File, caption?: string): Promise<{ photo: UserPhoto }> {
  const formData = new FormData();
  formData.append('photo', file);
  if (caption) formData.append('caption', caption);
  return fetch(`${API_URL}/api/profile/photos`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'No se pudo subir la foto.', res.status);
    return data;
  });
}

export function deletePhoto(id: string): Promise<{ message: string }> {
  return request(`/api/profile/photos/${id}`, { method: 'DELETE' });
}

// --- Mini-Blog ---

export function listPosts(): Promise<{ posts: UserPost[] }> {
  return request('/api/profile/posts');
}

export function createPost(input: {
  title: string;
  content: string;
  imageUrl?: string;
}): Promise<{ post: UserPost }> {
  return request('/api/profile/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deletePost(id: string): Promise<{ message: string }> {
  return request(`/api/profile/posts/${id}`, { method: 'DELETE' });
}

export interface GlobalSearchResult {
  jobs: Array<{ id: string; title: string; roleTarget: string; budgetPerHour: number; description: string }>;
  people: Array<{ id: string; name: string; email: string; role: string; profession?: string; bio?: string; avatarUrl?: string }>;
  companies: Array<{ id: string; name: string; email: string; role: string; profession?: string; bio?: string; avatarUrl?: string }>;
}

export function searchGlobal(q: string): Promise<{ results: GlobalSearchResult }> {
  return request(`/api/job-postings/global-search?q=${encodeURIComponent(q)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Asistente IA (chat flotante con voz)
// ─────────────────────────────────────────────────────────────────────────────

export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Envía un mensaje al asistente y devuelve su respuesta en texto. */
export function sendAssistantMessage(input: {
  message: string;
  history: AssistantChatMessage[];
}): Promise<{ reply: string }> {
  return request('/api/assistant/message', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
