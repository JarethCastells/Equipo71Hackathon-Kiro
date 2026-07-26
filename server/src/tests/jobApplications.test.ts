/**
 * Pruebas de integración del flujo de postulación a ofertas de trabajo,
 * dentro del router jobPostings.ts:
 *
 * - POST  /api/job-postings/:id/apply             — postularse a una oferta
 * - GET   /api/job-postings/:id/applications       — ver postulantes (solo owner)
 * - GET   /api/job-postings/my-applications        — mis postulaciones
 * - PATCH /api/job-postings/applications/:id       — aceptar/rechazar postulación
 *
 * Estrategia: se mockean jobApplicationStore, jobPostingStore, userStore,
 * notificationStore, activityStore, hiringAgreementStore, aiMatcher, mailer,
 * db.js y auth.js — igual que en conversations.test.ts — para aislar el
 * router sin necesitar una base de datos real.
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (antes de importar el router) ─────────────────────────────────────

vi.mock('express-rate-limit', () => ({
  default: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../jobApplicationStore.js', () => ({
  createApplication: vi.fn(),
  hasApplied: vi.fn(),
  listApplicationsByApplicant: vi.fn(),
  listApplicationsForPosting: vi.fn(),
  findApplicationById: vi.fn(),
  updateApplicationStatus: vi.fn(),
}));

vi.mock('../jobPostingStore.js', () => ({
  createJobPosting: vi.fn(),
  deleteJobPosting: vi.fn(),
  findJobPostingById: vi.fn(),
  findMatchingUsersForPosting: vi.fn().mockResolvedValue([]),
  listJobPostings: vi.fn(),
  updateJobPosting: vi.fn(),
}));

vi.mock('../userStore.js', () => ({
  findUserById: vi.fn(),
}));

vi.mock('../notificationStore.js', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../activityStore.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../hiringAgreementStore.js', () => ({
  createHiringAgreement: vi.fn(),
  listAgreementsForRecruiter: vi.fn(),
}));

vi.mock('../mailer.js', () => ({
  sendJobMatchEmail: vi.fn().mockResolvedValue({}),
  sendSecurityAlertEmail: vi.fn().mockResolvedValue({}),
}));

vi.mock('../aiMatcher.js', () => ({
  scoreApplicants: vi.fn(),
  askAboutApplicants: vi.fn(),
}));

vi.mock('../db.js', () => ({
  default: {
    query: vi.fn().mockResolvedValue([[]]),
    execute: vi.fn().mockResolvedValue([[]]),
  },
}));

vi.mock('../auth.js', () => ({
  requireAuth: (
    req: Request & { auth?: { sub: string; email: string } },
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.auth) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    next();
  },
}));

// ─── Imports tras los mocks ───────────────────────────────────────────────────

import {
  createApplication,
  findApplicationById,
  hasApplied,
  listApplicationsByApplicant,
  listApplicationsForPosting,
  updateApplicationStatus,
} from '../jobApplicationStore.js';
import { findJobPostingById } from '../jobPostingStore.js';
import { createNotification } from '../notificationStore.js';
import { findUserById } from '../userStore.js';
import jobPostingRoutes from '../routes/jobPostings.js';

// ─── App de test ──────────────────────────────────────────────────────────────

function buildApp(userId = 'user-alice') {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { auth?: { sub: string; email: string } }).auth = {
      sub: userId,
      email: `${userId}@test.com`,
    };
    next();
  });

  app.use('/api/job-postings', jobPostingRoutes);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    res.status(500).json({ error: msg });
  });

  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const POSTING_ID = 'posting-001';
const RECRUITER_ID = 'user-recruiter';
const APPLICANT_ID = 'user-alice';
const OTHER_APPLICANT_ID = 'user-bob';

const POSTING = {
  id: POSTING_ID,
  createdBy: RECRUITER_ID,
  title: 'Desarrollador Backend',
  description: 'Vacante de prueba',
  budgetPerHour: 20,
  roleTarget: 'freelancer',
  skills: 'Node.js',
  perks: null,
  createdAt: new Date().toISOString(),
  updatedAt: null,
};

const APPLICATION = {
  id: 'app-001',
  postingId: POSTING_ID,
  applicantId: APPLICANT_ID,
  message: 'Me interesa esta oferta.',
  status: 'pending' as const,
  createdAt: new Date().toISOString(),
};

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: APPLICANT_ID,
    name: 'Alice Freelancer',
    email: 'alice@test.com',
    role: 'freelancer',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  (findJobPostingById as ReturnType<typeof vi.fn>).mockResolvedValue(POSTING);
  (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
  (hasApplied as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  (createApplication as ReturnType<typeof vi.fn>).mockResolvedValue(APPLICATION);
  (listApplicationsForPosting as ReturnType<typeof vi.fn>).mockResolvedValue([APPLICATION]);
  (listApplicationsByApplicant as ReturnType<typeof vi.fn>).mockResolvedValue([
    { ...APPLICATION, postingTitle: POSTING.title },
  ]);
  (findApplicationById as ReturnType<typeof vi.fn>).mockResolvedValue(APPLICATION);
  (updateApplicationStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

// ─── POST /api/job-postings/:id/apply ─────────────────────────────────────────

describe('POST /api/job-postings/:id/apply — postularse a una oferta', () => {
  it('crea la postulación y devuelve 201', async () => {
    const app = buildApp(APPLICANT_ID);
    const res = await supertest(app)
      .post(`/api/job-postings/${POSTING_ID}/apply`)
      .send({ message: 'Me interesa esta oferta.' });

    expect(res.status).toBe(201);
    expect(res.body.application).toBeDefined();
    expect(createApplication).toHaveBeenCalledWith({
      postingId: POSTING_ID,
      applicantId: APPLICANT_ID,
      message: 'Me interesa esta oferta.',
    });
  });

  it('notifica al creador de la oferta tras postularse', async () => {
    const app = buildApp(APPLICANT_ID);
    await supertest(app).post(`/api/job-postings/${POSTING_ID}/apply`).send({});

    expect(createNotification).toHaveBeenCalledWith(
      RECRUITER_ID,
      'new_match',
      expect.stringContaining(POSTING.title),
      expect.any(String),
    );
  });

  it('devuelve 403 si el usuario autenticado es un reclutador', async () => {
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ id: RECRUITER_ID, role: 'reclutador' }),
    );

    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app).post(`/api/job-postings/${POSTING_ID}/apply`).send({});

    expect(res.status).toBe(403);
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la oferta no existe', async () => {
    (findJobPostingById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildApp(APPLICANT_ID);
    const res = await supertest(app).post(`/api/job-postings/${POSTING_ID}/apply`).send({});

    expect(res.status).toBe(404);
  });

  it('devuelve 400 si el usuario intenta postularse a su propia oferta', async () => {
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ id: RECRUITER_ID, role: 'freelancer' }),
    );

    const app = buildApp(RECRUITER_ID); // mismo id que POSTING.createdBy
    const res = await supertest(app).post(`/api/job-postings/${POSTING_ID}/apply`).send({});

    expect(res.status).toBe(400);
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('devuelve 409 si el usuario ya se postuló antes a esa oferta (unicidad)', async () => {
    (hasApplied as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const app = buildApp(APPLICANT_ID);
    const res = await supertest(app).post(`/api/job-postings/${POSTING_ID}/apply`).send({});

    expect(res.status).toBe(409);
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el mensaje supera 500 caracteres', async () => {
    const app = buildApp(APPLICANT_ID);
    const res = await supertest(app)
      .post(`/api/job-postings/${POSTING_ID}/apply`)
      .send({ message: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('permite postularse a un voluntario', async () => {
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ id: 'user-vol', role: 'voluntario' }),
    );

    const app = buildApp('user-vol');
    const res = await supertest(app).post(`/api/job-postings/${POSTING_ID}/apply`).send({});

    expect(res.status).toBe(201);
  });
});

// ─── GET /api/job-postings/:id/applications ──────────────────────────────────

describe('GET /api/job-postings/:id/applications — ver postulantes', () => {
  it('devuelve 200 con la lista de postulantes para el creador de la oferta', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app).get(`/api/job-postings/${POSTING_ID}/applications`);

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
  });

  it('devuelve 403 si quien consulta NO es el creador de la oferta', async () => {
    const app = buildApp(OTHER_APPLICANT_ID);
    const res = await supertest(app).get(`/api/job-postings/${POSTING_ID}/applications`);

    expect(res.status).toBe(403);
    expect(listApplicationsForPosting).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la oferta no existe', async () => {
    (findJobPostingById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app).get(`/api/job-postings/${POSTING_ID}/applications`);

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/job-postings/my-applications ───────────────────────────────────

describe('GET /api/job-postings/my-applications — mis postulaciones', () => {
  it('devuelve 200 con las postulaciones del usuario autenticado', async () => {
    const app = buildApp(APPLICANT_ID);
    const res = await supertest(app).get('/api/job-postings/my-applications');

    expect(res.status).toBe(200);
    expect(listApplicationsByApplicant).toHaveBeenCalledWith(APPLICANT_ID);
    expect(res.body.applications[0].postingTitle).toBe(POSTING.title);
  });
});

// ─── PATCH /api/job-postings/applications/:applicationId ────────────────────

describe('PATCH /api/job-postings/applications/:applicationId — aceptar/rechazar', () => {
  it('acepta una postulación cuando lo hace el creador de la oferta', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app)
      .patch(`/api/job-postings/applications/${APPLICATION.id}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(200);
    expect(updateApplicationStatus).toHaveBeenCalledWith(APPLICATION.id, 'accepted');
  });

  it('notifica al postulante cuando su postulación es aceptada', async () => {
    const app = buildApp(RECRUITER_ID);
    await supertest(app)
      .patch(`/api/job-postings/applications/${APPLICATION.id}`)
      .send({ status: 'accepted' });

    expect(createNotification).toHaveBeenCalledWith(
      APPLICANT_ID,
      'new_match',
      expect.stringContaining('aceptaron'),
      expect.any(String),
    );
  });

  it('rechaza una postulación cuando lo hace el creador de la oferta', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app)
      .patch(`/api/job-postings/applications/${APPLICATION.id}`)
      .send({ status: 'rejected' });

    expect(res.status).toBe(200);
    expect(updateApplicationStatus).toHaveBeenCalledWith(APPLICATION.id, 'rejected');
  });

  it('devuelve 403 si quien intenta cambiar el estado NO es el creador de la oferta', async () => {
    const app = buildApp(OTHER_APPLICANT_ID);
    const res = await supertest(app)
      .patch(`/api/job-postings/applications/${APPLICATION.id}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(403);
    expect(updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el estado enviado no es "accepted" ni "rejected"', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app)
      .patch(`/api/job-postings/applications/${APPLICATION.id}`)
      .send({ status: 'pending' });

    expect(res.status).toBe(400);
    expect(updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la postulación no existe', async () => {
    (findApplicationById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app)
      .patch(`/api/job-postings/applications/no-existe`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(404);
  });
});

// ─── Flujo completo: postularse → ver postulantes → aceptar ──────────────────

describe('Flujo completo de postulación', () => {
  it('un freelancer se postula, el reclutador ve la postulación y la acepta', async () => {
    const applicantApp = buildApp(APPLICANT_ID);
    const recruiterApp = buildApp(RECRUITER_ID);

    // 1. El freelancer se postula
    const applyRes = await supertest(applicantApp)
      .post(`/api/job-postings/${POSTING_ID}/apply`)
      .send({ message: 'Tengo experiencia relevante.' });
    expect(applyRes.status).toBe(201);

    // 2. El reclutador ve la lista de postulantes
    const listRes = await supertest(recruiterApp).get(`/api/job-postings/${POSTING_ID}/applications`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.applications).toHaveLength(1);

    // 3. El reclutador acepta la postulación
    const acceptRes = await supertest(recruiterApp)
      .patch(`/api/job-postings/applications/${APPLICATION.id}`)
      .send({ status: 'accepted' });
    expect(acceptRes.status).toBe(200);
    expect(updateApplicationStatus).toHaveBeenCalledWith(APPLICATION.id, 'accepted');
  });

  it('un freelancer no puede postularse dos veces a la misma oferta', async () => {
    const app = buildApp(APPLICANT_ID);

    // Primera postulación: éxito
    const first = await supertest(app).post(`/api/job-postings/${POSTING_ID}/apply`).send({});
    expect(first.status).toBe(201);

    // Segunda postulación: la BD/store ya reportaría hasApplied=true
    (hasApplied as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const second = await supertest(app).post(`/api/job-postings/${POSTING_ID}/apply`).send({});
    expect(second.status).toBe(409);
  });
});
