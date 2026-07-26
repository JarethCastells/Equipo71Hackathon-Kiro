/**
 * Pruebas de integración del flujo de contratación con responsiva firmada,
 * dentro del router jobPostings.ts:
 *
 * - POST /api/job-postings/hire         — contratar y firmar la responsiva
 * - GET  /api/job-postings/my-agreements — responsivas firmadas por el reclutador
 *
 * Cubre las reglas de negocio: solo reclutadores pueden contratar, el
 * freelancer debe existir, se registra IP y se notifica al freelancer y
 * (si aplica) se envía alerta de seguridad al reclutador.
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

import { createHiringAgreement, listAgreementsForRecruiter } from '../hiringAgreementStore.js';
import { createNotification } from '../notificationStore.js';
import { sendSecurityAlertEmail } from '../mailer.js';
import { logActivity } from '../activityStore.js';
import { findUserById } from '../userStore.js';
import jobPostingRoutes from '../routes/jobPostings.js';

// ─── App de test ──────────────────────────────────────────────────────────────

function buildApp(userId = 'user-recruiter') {
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

const RECRUITER_ID = 'user-recruiter';
const FREELANCER_ID = 'user-freelancer';
const POSTING_ID = 'posting-001';

const RECRUITER = {
  id: RECRUITER_ID,
  name: 'InnovateTech Labs',
  email: 'recruiter@test.com',
  role: 'reclutador',
  notifySecurity: true,
};

const FREELANCER = {
  id: FREELANCER_ID,
  name: 'Carlos Freelancer',
  email: 'carlos@test.com',
  role: 'freelancer',
  notifySecurity: true,
};

const AGREEMENT = {
  id: 'agreement-001',
  recruiterId: RECRUITER_ID,
  freelancerId: FREELANCER_ID,
  postingId: POSTING_ID,
  agreedAmount: 20000,
  agreementText: 'InnovateTech Labs se compromete a pagar $20,000 MXN por el servicio contratado.',
  acceptedAt: new Date().toISOString(),
  ipAddress: '127.0.0.1',
};

function findUserByIdImpl(id: string) {
  if (id === RECRUITER_ID) return RECRUITER;
  if (id === FREELANCER_ID) return FREELANCER;
  return undefined;
}

beforeEach(() => {
  vi.clearAllMocks();

  (findUserById as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => findUserByIdImpl(id));
  (createHiringAgreement as ReturnType<typeof vi.fn>).mockResolvedValue(AGREEMENT);
  (listAgreementsForRecruiter as ReturnType<typeof vi.fn>).mockResolvedValue([
    { ...AGREEMENT, freelancerName: FREELANCER.name, postingTitle: 'Desarrollador Backend' },
  ]);
});

// ─── POST /api/job-postings/hire ──────────────────────────────────────────────

describe('POST /api/job-postings/hire — contratar con responsiva firmada', () => {
  const validBody = {
    freelancerId: FREELANCER_ID,
    postingId: POSTING_ID,
    agreedAmount: 20000,
    agreementText: 'InnovateTech Labs se compromete a pagar $20,000 MXN por el servicio contratado.',
  };

  it('crea la responsiva y devuelve 201 cuando el solicitante es reclutador', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app).post('/api/job-postings/hire').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.agreement).toBeDefined();
    expect(createHiringAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        recruiterId: RECRUITER_ID,
        freelancerId: FREELANCER_ID,
        postingId: POSTING_ID,
        agreedAmount: 20000,
      }),
    );
  });

  it('registra la IP del solicitante en la responsiva (trazabilidad)', async () => {
    const app = buildApp(RECRUITER_ID);
    await supertest(app).post('/api/job-postings/hire').send(validBody);

    const callArg = (createHiringAgreement as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg).toHaveProperty('ipAddress');
  });

  it('notifica al freelancer contratado', async () => {
    const app = buildApp(RECRUITER_ID);
    await supertest(app).post('/api/job-postings/hire').send(validBody);

    expect(createNotification).toHaveBeenCalledWith(
      FREELANCER_ID,
      'new_match',
      expect.stringContaining(RECRUITER.name),
      expect.any(String),
    );
  });

  it('registra la actividad del reclutador al firmar la responsiva', async () => {
    const app = buildApp(RECRUITER_ID);
    await supertest(app).post('/api/job-postings/hire').send(validBody);

    expect(logActivity).toHaveBeenCalledWith(
      RECRUITER_ID,
      'profile_updated',
      expect.stringContaining('responsiva'),
      expect.anything(),
    );
  });

  it('envía alerta de seguridad al reclutador si tiene notifySecurity activado', async () => {
    const app = buildApp(RECRUITER_ID);
    await supertest(app).post('/api/job-postings/hire').send(validBody);

    expect(sendSecurityAlertEmail).toHaveBeenCalledWith(
      RECRUITER.email,
      expect.objectContaining({ eventTitle: expect.stringContaining('responsiva') }),
    );
  });

  it('NO envía alerta de seguridad si el reclutador desactivó notifySecurity', async () => {
    (findUserById as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
      if (id === RECRUITER_ID) return { ...RECRUITER, notifySecurity: false };
      if (id === FREELANCER_ID) return FREELANCER;
      return undefined;
    });

    const app = buildApp(RECRUITER_ID);
    await supertest(app).post('/api/job-postings/hire').send(validBody);

    expect(sendSecurityAlertEmail).not.toHaveBeenCalled();
  });

  it('devuelve 403 si el solicitante NO es una cuenta de reclutador', async () => {
    const app = buildApp(FREELANCER_ID); // freelancer intentando contratar
    const res = await supertest(app).post('/api/job-postings/hire').send(validBody);

    expect(res.status).toBe(403);
    expect(createHiringAgreement).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el freelancer a contratar no existe', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app)
      .post('/api/job-postings/hire')
      .send({ ...validBody, freelancerId: 'no-existe' });

    expect(res.status).toBe(404);
    expect(createHiringAgreement).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el monto acordado no es un número positivo', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app)
      .post('/api/job-postings/hire')
      .send({ ...validBody, agreedAmount: -100 });

    expect(res.status).toBe(400);
    expect(createHiringAgreement).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el texto de la responsiva es muy corto (<20 caracteres)', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app)
      .post('/api/job-postings/hire')
      .send({ ...validBody, agreementText: 'Muy corto' });

    expect(res.status).toBe(400);
    expect(createHiringAgreement).not.toHaveBeenCalled();
  });

  it('devuelve 400 si falta el freelancerId', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app)
      .post('/api/job-postings/hire')
      .send({ ...validBody, freelancerId: undefined });

    expect(res.status).toBe(400);
  });

  it('acepta postingId nulo/ausente (contratación fuera de una oferta publicada)', async () => {
    const app = buildApp(RECRUITER_ID);
    const { postingId, ...bodyWithoutPosting } = validBody;
    const res = await supertest(app).post('/api/job-postings/hire').send(bodyWithoutPosting);

    expect(res.status).toBe(201);
    expect(createHiringAgreement).toHaveBeenCalledWith(
      expect.objectContaining({ postingId: null }),
    );
  });
});

// ─── GET /api/job-postings/my-agreements ─────────────────────────────────────

describe('GET /api/job-postings/my-agreements — responsivas firmadas', () => {
  it('devuelve 200 con las responsivas del reclutador autenticado', async () => {
    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app).get('/api/job-postings/my-agreements');

    expect(res.status).toBe(200);
    expect(listAgreementsForRecruiter).toHaveBeenCalledWith(RECRUITER_ID);
    expect(res.body.agreements).toHaveLength(1);
    expect(res.body.agreements[0].freelancerName).toBe(FREELANCER.name);
  });

  it('devuelve lista vacía si el reclutador no ha contratado a nadie', async () => {
    (listAgreementsForRecruiter as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const app = buildApp(RECRUITER_ID);
    const res = await supertest(app).get('/api/job-postings/my-agreements');

    expect(res.status).toBe(200);
    expect(res.body.agreements).toHaveLength(0);
  });
});

// ─── Flujo completo: contratar → consultar responsivas ──────────────────────

describe('Flujo completo de contratación', () => {
  it('el reclutador contrata al freelancer y luego ve la responsiva en su lista', async () => {
    const app = buildApp(RECRUITER_ID);

    const hireRes = await supertest(app).post('/api/job-postings/hire').send({
      freelancerId: FREELANCER_ID,
      postingId: POSTING_ID,
      agreedAmount: 20000,
      agreementText: 'InnovateTech Labs se compromete a pagar $20,000 MXN por el servicio contratado.',
    });
    expect(hireRes.status).toBe(201);
    expect(hireRes.body.agreement.id).toBe(AGREEMENT.id);

    const listRes = await supertest(app).get('/api/job-postings/my-agreements');
    expect(listRes.status).toBe(200);
    expect(listRes.body.agreements[0].id).toBe(AGREEMENT.id);
  });
});
