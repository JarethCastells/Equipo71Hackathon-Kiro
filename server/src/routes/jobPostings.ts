import { Router, type NextFunction, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import type { RowDataPacket } from 'mysql2'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { sendJobMatchEmail, sendSecurityAlertEmail } from '../mailer.js'
import { createNotification } from '../notificationStore.js'
import { logActivity } from '../activityStore.js'
import { createJobPosting, deleteJobPosting, findJobPostingById, findMatchingUsersForPosting, listJobPostings, updateJobPosting } from '../jobPostingStore.js'

import {
  createApplication,
  hasApplied,
  listApplicationsByApplicant,
  listApplicationsForPosting,
  findApplicationById,
  updateApplicationStatus,
} from '../jobApplicationStore.js'
import { createHiringAgreement, listAgreementsForRecruiter } from '../hiringAgreementStore.js'
import { findUserById } from '../userStore.js'
import { scoreApplicants, askAboutApplicants, type CandidateProfile, type PostingContext } from '../aiMatcher.js'
import pool from '../db.js'
import type { AccountRole } from '../types.js'

const router = Router()
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const VALID_ROLES: AccountRole[] = ['freelancer', 'voluntario', 'reclutador']

type AsyncHandler = (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>
function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as AuthedRequest, res, next).catch(next)
  }
}

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas ofertas publicadas en poco tiempo. Espera unos minutos.' },
})

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas postulaciones en poco tiempo. Espera unos minutos.' },
})

const hireLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas contrataciones en poco tiempo. Espera unos minutos.' },
})

const askAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas preguntas a la IA en poco tiempo. Espera unos minutos.' },
})

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''
  const postings = await listJobPostings(50)
  if (!q) return res.json({ postings })

  const filtered = postings.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    (p.skills && p.skills.toLowerCase().includes(q))
  )
  res.json({ postings: filtered })
}))

/** Búsqueda global al instante (Vacantes, Servicios, Personas y Empresas). */
router.get('/global-search', requireAuth, asyncRoute(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!q) {
    return res.json({ results: { jobs: [], people: [], companies: [] } })
  }

  const term = `%${q}%`
  const termLower = q.toLowerCase()

  const postings = await listJobPostings(50)
  const jobs = postings.filter(p =>
    p.title.toLowerCase().includes(termLower) ||
    p.description.toLowerCase().includes(termLower) ||
    (p.skills && p.skills.toLowerCase().includes(termLower))
  )

  const [userRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, name, email, role, profession, bio, avatar_url FROM users 
     WHERE (name LIKE ? OR email LIKE ? OR profession LIKE ? OR bio LIKE ?) 
     LIMIT 20`,
    [term, term, term, term]
  )

  const people = userRows
    .filter(u => u.role === 'freelancer' || u.role === 'voluntario')
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      profession: u.profession,
      bio: u.bio,
      avatarUrl: u.avatar_url,
    }))

  const companies = userRows
    .filter(u => u.role === 'reclutador')
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      profession: u.profession,
      bio: u.bio,
      avatarUrl: u.avatar_url,
    }))

  res.json({
    results: {
      jobs: jobs.slice(0, 10),
      people: people.slice(0, 10),
      companies: companies.slice(0, 10),
    },
  })
}))

/** Ofertas a las que el usuario autenticado ya se postuló. */
router.get('/my-applications', requireAuth, asyncRoute(async (req, res) => {
  const applications = await listApplicationsByApplicant(req.auth!.sub)
  res.json({ applications })
}))

/** Contrataciones (responsivas firmadas) hechas por el reclutador autenticado. */
router.get('/my-agreements', requireAuth, asyncRoute(async (req, res) => {
  const agreements = await listAgreementsForRecruiter(req.auth!.sub)
  res.json({ agreements })
}))

/**
 * Publica una oferta y, en segundo plano, notifica (dentro de la app y por
 * correo, según preferencia de cada usuario) a todos los perfiles cuyo rol
 * coincide con el objetivo de la oferta. Es el motor de "avísame si hay
 * ofertas que se ajusten a mi perfil".
 */
router.post('/', requireAuth, createLimiter, asyncRoute(async (req, res) => {
  const { title, description, budgetPerHour, roleTarget, skills, perks } = req.body ?? {}

  if (typeof title !== 'string' || title.trim().length < 4) {
    return res.status(400).json({ error: 'Ingresa un título válido para la oferta.' })
  }
  if (typeof description !== 'string' || description.trim().length < 10) {
    return res.status(400).json({ error: 'Describe la oferta con al menos 10 caracteres.' })
  }
  const budget = Number(budgetPerHour)
  if (!Number.isFinite(budget) || budget < 0) {
    return res.status(400).json({ error: 'Ingresa un presupuesto por hora válido.' })
  }
  const finalRole: AccountRole = VALID_ROLES.includes(roleTarget) ? roleTarget : 'freelancer'

  if (finalRole === 'freelancer') {
    if (budget <= 0) {
      return res.status(400).json({ error: 'El sueldo/presupuesto no puede ser $0 para un freelancer. Debe ser mayor a $0.' })
    }
    const budgetStr = String(Math.floor(budget))
    if (budgetStr.length > 4 || budget > 9999) {
      return res.status(400).json({ error: 'El sueldo está limitado a un máximo de 4 caracteres (máximo $9,999/hora).' })
    }
  }

  if (perks !== undefined && perks !== null && (typeof perks !== 'string' || perks.length > 300)) {
    return res.status(400).json({ error: 'Los incentivos (perks) no son válidos.' })
  }

  const posting = await createJobPosting({
    createdBy: req.auth!.sub,
    title: title.trim(),
    description: description.trim(),
    budgetPerHour: finalRole === 'voluntario' ? 0 : budget,
    roleTarget: finalRole,
    skills: typeof skills === 'string' ? skills.trim() : undefined,
    perks: typeof perks === 'string' ? perks.trim() || undefined : undefined,
  })

  res.status(201).json({ posting })

  // El envío de notificaciones/correos ocurre después de responder al
  // cliente: publicar la oferta no debe esperar a que se notifique a todos
  // los usuarios compatibles (podrían ser muchos).
  void notifyMatchingUsers(posting).catch((err) => {
    console.error('[jobPostings] Error notificando usuarios compatibles:', err)
  })
}))

/**
 * Edita una oferta publicada (solo quien la creó).
 */
router.put('/:id', requireAuth, asyncRoute(async (req, res) => {
  const { title, description, budgetPerHour, roleTarget, skills, perks } = req.body ?? {}

  const existing = await findJobPostingById(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Oferta no encontrada.' })
  }
  if (existing.createdBy !== req.auth!.sub) {
    return res.status(403).json({ error: 'Solo quien creó la oferta puede editarla.' })
  }

  if (title !== undefined && (typeof title !== 'string' || title.trim().length < 4)) {
    return res.status(400).json({ error: 'El título debe tener al menos 4 caracteres.' })
  }
  if (description !== undefined && (typeof description !== 'string' || description.trim().length < 10)) {
    return res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres.' })
  }

  const targetRole = roleTarget ? (VALID_ROLES.includes(roleTarget) ? roleTarget : existing.roleTarget) : existing.roleTarget
  const newBudget = budgetPerHour !== undefined ? Number(budgetPerHour) : existing.budgetPerHour

  if (targetRole === 'freelancer') {
    if (newBudget <= 0) {
      return res.status(400).json({ error: 'El sueldo/presupuesto no puede ser $0 para un freelancer. Debe ser mayor a $0.' })
    }
    const budgetStr = String(Math.floor(newBudget))
    if (budgetStr.length > 4 || newBudget > 9999) {
      return res.status(400).json({ error: 'El sueldo está limitado a un máximo de 4 caracteres (máximo $9,999/hora).' })
    }
  }

  const updated = await updateJobPosting(req.params.id, req.auth!.sub, {
    title: typeof title === 'string' ? title.trim() : undefined,
    description: typeof description === 'string' ? description.trim() : undefined,
    budgetPerHour: targetRole === 'voluntario' ? 0 : newBudget,
    roleTarget: targetRole,
    skills: typeof skills === 'string' ? skills.trim() : undefined,
    perks: typeof perks === 'string' ? perks.trim() : undefined,
  })

  await logActivity(req.auth!.sub, 'profile_updated', `Editaste la oferta "${updated?.title}".`, req.ip)

  res.json({ posting: updated })
}))


/**
 * Elimina una oferta publicada (solo quien la creó).
 */
router.delete('/:id', requireAuth, asyncRoute(async (req, res) => {
  const existing = await findJobPostingById(req.params.id)
  if (!existing) {
    return res.status(404).json({ error: 'Oferta no encontrada.' })
  }
  if (existing.createdBy !== req.auth!.sub) {
    return res.status(403).json({ error: 'Solo quien creó la oferta puede eliminarla.' })
  }

  const success = await deleteJobPosting(req.params.id, req.auth!.sub)
  if (!success) {
    return res.status(500).json({ error: 'No se pudo eliminar la oferta.' })
  }

  await logActivity(req.auth!.sub, 'profile_updated', `Eliminaste la oferta "${existing.title}".`, req.ip)

  res.json({ message: 'Oferta eliminada correctamente.' })
}))

/**
 * Postulantes de una oferta rankeados por compatibilidad IA.
 * Solo puede verlos quien publicó la oferta (reclutador owner).
 */
router.get('/:id/ranked-applicants', requireAuth, asyncRoute(async (req, res) => {
  const posting = await findJobPostingById(req.params.id)
  if (!posting) {
    return res.status(404).json({ error: 'Oferta no encontrada.' })
  }
  if (posting.createdBy !== req.auth!.sub) {
    return res.status(403).json({ error: 'Solo quien publicó la oferta puede ver los postulantes.' })
  }

  // Obtener postulantes con datos de perfil para el scoring
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.posting_id, a.applicant_id, a.message, a.status, a.created_at,
            u.name as applicant_name, u.email as applicant_email, u.role as applicant_role,
            u.avatar_url as applicant_avatar_url, u.profession, u.bio, u.interests,
            u.availability, u.rate_amount
     FROM job_applications a
     JOIN users u ON u.id = a.applicant_id
     WHERE a.posting_id = ?
     ORDER BY a.created_at DESC`,
    [posting.id],
  )

  if (rows.length === 0) {
    return res.json({
      applicants: [],
      recommendation: null,
      summary: 'Aún no hay postulaciones.',
      suggestion: '',
    })
  }

  // Construir perfiles para el scoring
  const profiles: CandidateProfile[] = rows.map((row) => ({
    id: row.applicant_id,
    name: row.applicant_name,
    profession: row.profession,
    bio: row.bio,
    interests: row.interests,
    availability: row.availability,
    rateAmount: row.rate_amount !== null ? Number(row.rate_amount) : null,
  }))

  const postingContext: PostingContext = {
    title: posting.title,
    description: posting.description,
    skills: posting.skills,
    budgetPerHour: posting.budgetPerHour,
  }

  // Calcular scores con IA (o heurístico como fallback)
  const ranking = await scoreApplicants(profiles, postingContext)

  // Merge scores con datos de la aplicación
  const applicants = ranking.applicants.map((scored) => {
    const row = rows.find((r) => r.applicant_id === scored.applicantId)!
    return {
      id: row.id,
      postingId: row.posting_id,
      applicantId: row.applicant_id,
      applicantName: row.applicant_name,
      applicantEmail: row.applicant_email,
      applicantRole: row.applicant_role,
      applicantAvatarUrl: row.applicant_avatar_url,
      message: row.message,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      matchScore: scored.matchScore,
      matchReason: scored.matchReason,
      strengthTags: scored.strengthTags,
    }
  })

  res.json({
    applicants,
    recommendation: ranking.recommendation,
    summary: ranking.summary,
    suggestion: ranking.suggestion,
  })
}))

/**
 * Chat con IA sobre los postulantes de una oferta.
 * El reclutador puede hacer preguntas en lenguaje natural.
 */
router.post('/:id/ask-ai', requireAuth, askAiLimiter, asyncRoute(async (req, res) => {
  const { question } = req.body ?? {}

  if (typeof question !== 'string' || question.trim().length < 5 || question.trim().length > 500) {
    return res.status(400).json({ error: 'La pregunta debe tener entre 5 y 500 caracteres.' })
  }

  const posting = await findJobPostingById(req.params.id)
  if (!posting) {
    return res.status(404).json({ error: 'Oferta no encontrada.' })
  }
  if (posting.createdBy !== req.auth!.sub) {
    return res.status(403).json({ error: 'Solo quien publicó la oferta puede usar el chat IA.' })
  }

  // Obtener perfiles de postulantes
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.name, u.profession, u.bio, u.interests, u.availability, u.rate_amount
     FROM job_applications a
     JOIN users u ON u.id = a.applicant_id
     WHERE a.posting_id = ?`,
    [posting.id],
  )

  const profiles: CandidateProfile[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    profession: row.profession,
    bio: row.bio,
    interests: row.interests,
    availability: row.availability,
    rateAmount: row.rate_amount !== null ? Number(row.rate_amount) : null,
  }))

  const postingContext: PostingContext = {
    title: posting.title,
    description: posting.description,
    skills: posting.skills,
    budgetPerHour: posting.budgetPerHour,
  }

  const answer = await askAboutApplicants(question.trim(), profiles, postingContext)
  res.json({ answer })
}))

/**
 * Postulación a una oferta. Pensado sobre todo para que voluntarios ganen
 * experiencia profesional postulándose como personal adicional, pero
 * también aplica a freelancers postulándose directamente.
 */
router.post('/:id/apply', requireAuth, applyLimiter, asyncRoute(async (req, res) => {
  const { message } = req.body ?? {}

  // Los reclutadores publican y contratan, nunca se postulan. Sin este
  // chequeo, un reclutador podía postularse a la oferta de OTRO reclutador
  // (el bloqueo anterior solo cubría "tu propia oferta").
  const requester = await findUserById(req.auth!.sub)
  if (requester?.role === 'reclutador') {
    return res.status(403).json({ error: 'Las cuentas de reclutador no pueden postularse a ofertas.' })
  }

  const posting = await findJobPostingById(req.params.id)
  if (!posting) {
    return res.status(404).json({ error: 'Oferta no encontrada.' })
  }
  if (posting.createdBy === req.auth!.sub) {
    return res.status(400).json({ error: 'No puedes postularte a tu propia oferta.' })
  }
  if (await hasApplied(posting.id, req.auth!.sub)) {
    return res.status(409).json({ error: 'Ya te postulaste a esta oferta.' })
  }
  if (message !== undefined && (typeof message !== 'string' || message.length > 500)) {
    return res.status(400).json({ error: 'El mensaje no puede superar 500 caracteres.' })
  }

  const application = await createApplication({
    postingId: posting.id,
    applicantId: req.auth!.sub,
    message: typeof message === 'string' ? message.trim() : undefined,
  })

  const applicant = await findUserById(req.auth!.sub)
  await createNotification(
    posting.createdBy,
    'new_match',
    `Nueva postulación: ${posting.title}`,
    `${applicant?.name ?? 'Alguien'} se postuló a tu oferta "${posting.title}".`,
  )

  res.status(201).json({ application })
}))

/** Postulantes de una oferta: solo puede verlos quien la publicó. */
router.get('/:id/applications', requireAuth, asyncRoute(async (req, res) => {
  const posting = await findJobPostingById(req.params.id)
  if (!posting) {
    return res.status(404).json({ error: 'Oferta no encontrada.' })
  }
  if (posting.createdBy !== req.auth!.sub) {
    return res.status(403).json({ error: 'Solo quien publicó la oferta puede ver los postulantes.' })
  }

  const applications = await listApplicationsForPosting(posting.id)
  res.json({ applications })
}))

/** Aceptar o rechazar una postulación (solo el creador de la oferta). */
router.patch('/applications/:applicationId', requireAuth, asyncRoute(async (req, res) => {
  const { status } = req.body ?? {}
  if (status !== 'accepted' && status !== 'rejected') {
    return res.status(400).json({ error: "El estado debe ser 'accepted' o 'rejected'." })
  }

  const application = await findApplicationById(req.params.applicationId)
  if (!application) {
    return res.status(404).json({ error: 'Postulación no encontrada.' })
  }
  const posting = await findJobPostingById(application.postingId)
  if (!posting || posting.createdBy !== req.auth!.sub) {
    return res.status(403).json({ error: 'No tienes permiso sobre esta postulación.' })
  }

  await updateApplicationStatus(application.id, status)

  await createNotification(
    application.applicantId,
    'new_match',
    status === 'accepted' ? `¡Te aceptaron en "${posting.title}"!` : `Actualización sobre "${posting.title}"`,
    status === 'accepted'
      ? 'El reclutador aceptó tu postulación. Revisa los detalles en tu dashboard.'
      : 'El reclutador decidió no continuar con tu postulación esta vez. ¡Sigue intentando!',
  )

  res.json({ message: 'Estado de la postulación actualizado.' })
}))

/**
 * Registra la contratación de un freelancer y la responsiva de pago que el
 * reclutador aceptó (ventana emergente en el frontend). Esto NO sustituye
 * un contrato legal, pero deja trazabilidad de quién aceptó, cuándo, con
 * qué monto y con qué texto exacto, dentro de la plataforma.
 */
router.post('/hire', requireAuth, hireLimiter, asyncRoute(async (req, res) => {
  const { freelancerId, postingId, agreedAmount, agreementText } = req.body ?? {}

  if (typeof freelancerId !== 'string') {
    return res.status(400).json({ error: 'Falta el freelancer a contratar.' })
  }
  const amount = Number(agreedAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Ingresa un monto acordado válido.' })
  }
  if (typeof agreementText !== 'string' || agreementText.trim().length < 20) {
    return res.status(400).json({ error: 'Falta el texto de la responsiva aceptada.' })
  }

  const recruiter = await findUserById(req.auth!.sub)
  if (!recruiter || recruiter.role !== 'reclutador') {
    return res.status(403).json({ error: 'Solo las cuentas de reclutador pueden contratar.' })
  }

  const freelancer = await findUserById(freelancerId)
  if (!freelancer) {
    return res.status(404).json({ error: 'Freelancer no encontrado.' })
  }

  const agreement = await createHiringAgreement({
    recruiterId: recruiter.id,
    freelancerId: freelancer.id,
    postingId: typeof postingId === 'string' ? postingId : null,
    agreedAmount: amount,
    agreementText: agreementText.trim(),
    ipAddress: req.ip,
  })

  await logActivity(
    recruiter.id,
    'profile_updated',
    `Contrataste a ${freelancer.name} y firmaste la responsiva de pago por $${amount.toFixed(2)}.`,
    req.ip,
  )

  await createNotification(
    freelancer.id,
    'new_match',
    `¡${recruiter.name} te contrató!`,
    `Se acordó un pago de $${amount.toFixed(2)}. El reclutador firmó una responsiva comprometiéndose a pagar en tiempo y forma.`,
  )

  if (recruiter.notifySecurity) {
    try {
      await sendSecurityAlertEmail(recruiter.email, {
        name: recruiter.name,
        eventTitle: 'Firmaste una responsiva de pago',
        eventDescription: `Te comprometiste a pagar $${amount.toFixed(2)} a ${freelancer.name} en tiempo y forma por los servicios contratados.`,
        timestamp: new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
        ipAddress: req.ip,
      })
    } catch (err) {
      console.error('[jobPostings] No se pudo enviar la confirmación de responsiva:', err)
    }
  }

  res.status(201).json({ agreement })
}))

async function notifyMatchingUsers(posting: Awaited<ReturnType<typeof createJobPosting>>) {
  const matches = await findMatchingUsersForPosting(posting)

  for (const candidate of matches) {
    await createNotification(
      candidate.id,
      'new_match',
      `Nueva oferta: ${posting.title}`,
      `Presupuesto: $${posting.budgetPerHour.toFixed(2)}/hora. ${posting.description.slice(0, 140)}`,
    )
  }

  // Los correos se envían en paralelo pero cada fallo individual se captura
  // por separado, para que un correo roto no cancele el resto del lote.
  await Promise.all(
    matches.map((candidate) =>
      sendJobMatchEmail(candidate.email, {
        name: candidate.name,
        jobTitle: posting.title,
        jobDescription: posting.description,
        budgetPerHour: posting.budgetPerHour,
        dashboardUrl: `${CLIENT_URL}/dashboard`,
      }).catch((err) => {
        console.error(`[jobPostings] No se pudo notificar por correo a ${candidate.email}:`, err)
      }),
    ),
  )
}

export default router
