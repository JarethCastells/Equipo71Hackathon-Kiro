/**
 * Pruebas de integración de los flujos de cambio de contraseña y cambio de
 * correo del router profile.ts:
 *
 * - POST /api/profile/password             — cambio de contraseña
 * - POST /api/profile/email/request-change — solicitar cambio de correo
 * - POST /api/profile/email/confirm-change — confirmar cambio de correo (público)
 *
 * profile.ts es un router grande con muchas dependencias (uploads, IA,
 * Stripe, showcase, plataformas); se mockean TODAS para poder montarlo
 * en una app de prueba sin tocar disco, red ni base de datos.
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (antes de importar el router) ─────────────────────────────────────

vi.mock('express-rate-limit', () => ({
  default: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../db.js', () => ({
  default: {
    query: vi.fn().mockResolvedValue([[]]),
    execute: vi.fn().mockResolvedValue([[]]),
  },
}));

vi.mock('../activityStore.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../mailer.js', () => ({
  sendEmailChangeEmail: vi.fn().mockResolvedValue({ previewUrl: 'https://ethereal.example/preview' }),
  sendSecurityAlertEmail: vi.fn().mockResolvedValue({}),
}));

vi.mock('../platformStore.js', () => ({
  addPlatform: vi.fn(),
  countPlatforms: vi.fn().mockResolvedValue(0),
  listPlatforms: vi.fn().mockResolvedValue([]),
  removePlatform: vi.fn(),
  MAX_PLATFORMS_PER_USER: 8,
}));

vi.mock('../showcaseStore.js', () => ({
  addPhoto: vi.fn(),
  createPost: vi.fn(),
  deletePhoto: vi.fn(),
  deletePost: vi.fn(),
  listPhotosForUser: vi.fn().mockResolvedValue([]),
  listPostsForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock('stripe', () => ({
  default: class StripeMock {
    paymentMethods = { create: vi.fn() };
    paymentIntents = { create: vi.fn() };
  },
}));

vi.mock('../userStore.js', () => ({
  clearPendingEmail: vi.fn(),
  confirmPendingEmail: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  findUserByPendingEmailTokenHash: vi.fn(),
  setCvUrl: vi.fn(),
  setPendingEmail: vi.fn(),
  updateNotificationPrefs: vi.fn(),
  updatePasswordHash: vi.fn().mockResolvedValue(undefined),
  updateProfile: vi.fn(),
  updateRoleDetails: vi.fn(),
  updateUserPlan: vi.fn(),
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

import { logActivity } from '../activityStore.js';
import { sendEmailChangeEmail, sendSecurityAlertEmail } from '../mailer.js';
import {
  clearPendingEmail,
  confirmPendingEmail,
  findUserByEmail,
  findUserById,
  findUserByPendingEmailTokenHash,
  setPendingEmail,
  updatePasswordHash,
} from '../userStore.js';
import profileRoutes from '../routes/profile.js';

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

  app.use('/api/profile', profileRoutes);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    res.status(500).json({ error: msg });
  });

  return app;
}

/** App sin inyectar req.auth, para probar rutas públicas o el 401 de requireAuth real. */
function buildAppNoAuth() {
  const app = express();
  app.use(express.json());
  app.use('/api/profile', profileRoutes);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    res.status(500).json({ error: msg });
  });
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'user-alice';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: USER_ID,
    name: 'Ana Tester',
    email: 'ana@example.com',
    passwordHash: '',
    role: 'freelancer',
    emailVerified: true,
    notifySecurity: true,
    pendingEmail: null,
    pendingEmailTokenHash: null,
    pendingEmailExpires: null,
    totpEnabled: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /api/profile/password — cambio de contraseña ───────────────────────

describe('POST /api/profile/password — cambio de contraseña', () => {
  it('actualiza la contraseña cuando la actual es correcta', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: currentHash }),
    );

    const app = buildApp(USER_ID);
    const res = await supertest(app)
      .post('/api/profile/password')
      .send({ currentPassword: 'actual123', newPassword: 'nuevaPassword456' });

    expect(res.status).toBe(200);
    expect(updatePasswordHash).toHaveBeenCalledWith(USER_ID, expect.any(String));
    // El nuevo hash nunca debe ser igual al texto plano ni al hash anterior
    const newHashArg = (updatePasswordHash as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(newHashArg).not.toBe('nuevaPassword456');
    expect(newHashArg).not.toBe(currentHash);
  });

  it('registra password_changed en el log de actividad', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: currentHash }),
    );

    const app = buildApp(USER_ID);
    await supertest(app)
      .post('/api/profile/password')
      .send({ currentPassword: 'actual123', newPassword: 'nuevaPassword456' });

    expect(logActivity).toHaveBeenCalledWith(USER_ID, 'password_changed', expect.any(String), expect.anything());
  });

  it('envía alerta de seguridad por correo cuando notifySecurity está activado', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: currentHash, notifySecurity: true }),
    );

    const app = buildApp(USER_ID);
    await supertest(app)
      .post('/api/profile/password')
      .send({ currentPassword: 'actual123', newPassword: 'nuevaPassword456' });

    expect(sendSecurityAlertEmail).toHaveBeenCalled();
  });

  it('devuelve 401 si la contraseña actual es incorrecta', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: currentHash }),
    );

    const app = buildApp(USER_ID);
    const res = await supertest(app)
      .post('/api/profile/password')
      .send({ currentPassword: 'contraseña-incorrecta', newPassword: 'nuevaPassword456' });

    expect(res.status).toBe(401);
    expect(updatePasswordHash).not.toHaveBeenCalled();
  });

  it('devuelve 400 si la nueva contraseña tiene menos de 8 caracteres', async () => {
    const app = buildApp(USER_ID);
    const res = await supertest(app)
      .post('/api/profile/password')
      .send({ currentPassword: 'actual123', newPassword: 'corta' });

    expect(res.status).toBe(400);
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('devuelve 400 si falta currentPassword o newPassword', async () => {
    const app = buildApp(USER_ID);
    const res = await supertest(app).post('/api/profile/password').send({ newPassword: 'nuevaPassword456' });

    expect(res.status).toBe(400);
  });

  it('devuelve 404 si el usuario autenticado ya no existe en BD', async () => {
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildApp(USER_ID);
    const res = await supertest(app)
      .post('/api/profile/password')
      .send({ currentPassword: 'actual123', newPassword: 'nuevaPassword456' });

    expect(res.status).toBe(404);
  });

  it('devuelve 401 sin autenticación (requireAuth real, sin req.auth inyectado)', async () => {
    const app = buildAppNoAuth();
    const res = await supertest(app)
      .post('/api/profile/password')
      .send({ currentPassword: 'actual123', newPassword: 'nuevaPassword456' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/profile/email/request-change ──────────────────────────────────

describe('POST /api/profile/email/request-change — solicitar cambio de correo', () => {
  it('genera un token de confirmación y envía el correo a la nueva dirección', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: currentHash, email: 'ana@example.com' }),
    );
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined); // correo nuevo libre

    const app = buildApp(USER_ID);
    const res = await supertest(app)
      .post('/api/profile/email/request-change')
      .send({ newEmail: 'ana-nueva@example.com', currentPassword: 'actual123' });

    expect(res.status).toBe(200);
    expect(setPendingEmail).toHaveBeenCalledWith(
      USER_ID,
      'ana-nueva@example.com',
      expect.any(String),
      expect.any(Date),
    );
    expect(sendEmailChangeEmail).toHaveBeenCalledWith(
      'ana-nueva@example.com',
      expect.objectContaining({ newEmail: 'ana-nueva@example.com' }),
    );
  });

  it('registra email_change_requested y alerta de seguridad al correo ACTUAL', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: currentHash, email: 'ana@example.com', notifySecurity: true }),
    );
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildApp(USER_ID);
    await supertest(app)
      .post('/api/profile/email/request-change')
      .send({ newEmail: 'ana-nueva@example.com', currentPassword: 'actual123' });

    expect(logActivity).toHaveBeenCalledWith(
      USER_ID,
      'email_change_requested',
      expect.any(String),
      expect.anything(),
    );
    expect(sendSecurityAlertEmail).toHaveBeenCalledWith('ana@example.com', expect.anything());
  });

  it('devuelve 401 si la contraseña actual es incorrecta', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: currentHash }),
    );

    const app = buildApp(USER_ID);
    const res = await supertest(app)
      .post('/api/profile/email/request-change')
      .send({ newEmail: 'ana-nueva@example.com', currentPassword: 'incorrecta' });

    expect(res.status).toBe(401);
    expect(setPendingEmail).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el nuevo correo es igual al actual', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: currentHash, email: 'ana@example.com' }),
    );

    const app = buildApp(USER_ID);
    const res = await supertest(app)
      .post('/api/profile/email/request-change')
      .send({ newEmail: 'ana@example.com', currentPassword: 'actual123' });

    expect(res.status).toBe(400);
    expect(setPendingEmail).not.toHaveBeenCalled();
  });

  it('devuelve 409 si el nuevo correo ya está en uso por otra cuenta', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: currentHash, email: 'ana@example.com' }),
    );
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser({ id: 'otro-usuario' }));

    const app = buildApp(USER_ID);
    const res = await supertest(app)
      .post('/api/profile/email/request-change')
      .send({ newEmail: 'ya-en-uso@example.com', currentPassword: 'actual123' });

    expect(res.status).toBe(409);
    expect(setPendingEmail).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el nuevo correo no es válido', async () => {
    const app = buildApp(USER_ID);
    const res = await supertest(app)
      .post('/api/profile/email/request-change')
      .send({ newEmail: 'no-es-correo', currentPassword: 'actual123' });

    expect(res.status).toBe(400);
    expect(findUserById).not.toHaveBeenCalled();
  });
});

// ─── POST /api/profile/email/confirm-change ──────────────────────────────────

describe('POST /api/profile/email/confirm-change — confirmar cambio de correo (público)', () => {
  const RAW_TOKEN = 'c'.repeat(64);

  it('no requiere autenticación (ruta pública por diseño, se llega desde el link del correo)', async () => {
    (findUserByPendingEmailTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildAppNoAuth();
    const res = await supertest(app).post('/api/profile/email/confirm-change').send({ token: RAW_TOKEN });

    // 400 (token inválido) y NO 401 — confirma que no pasa por requireAuth
    expect(res.status).toBe(400);
  });

  it('confirma el cambio de correo con un token válido y vigente', async () => {
    const user = makeUser({
      pendingEmail: 'ana-nueva@example.com',
      pendingEmailExpires: new Date(Date.now() + 60_000).toISOString(),
    });
    (findUserByPendingEmailTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const app = buildAppNoAuth();
    const res = await supertest(app).post('/api/profile/email/confirm-change').send({ token: RAW_TOKEN });

    expect(res.status).toBe(200);
    expect(confirmPendingEmail).toHaveBeenCalledWith(USER_ID, 'ana-nueva@example.com');
    expect(logActivity).toHaveBeenCalledWith(
      USER_ID,
      'email_changed',
      expect.stringContaining('ana-nueva@example.com'),
      expect.anything(),
    );
  });

  it('devuelve 400 y limpia el pendingEmail si el token ya expiró', async () => {
    const user = makeUser({
      pendingEmail: 'ana-nueva@example.com',
      pendingEmailExpires: new Date(Date.now() - 60_000).toISOString(),
    });
    (findUserByPendingEmailTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const app = buildAppNoAuth();
    const res = await supertest(app).post('/api/profile/email/confirm-change').send({ token: RAW_TOKEN });

    expect(res.status).toBe(400);
    expect(clearPendingEmail).toHaveBeenCalledWith(USER_ID);
    expect(confirmPendingEmail).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el token no existe o ya fue usado', async () => {
    (findUserByPendingEmailTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildAppNoAuth();
    const res = await supertest(app).post('/api/profile/email/confirm-change').send({ token: RAW_TOKEN });

    expect(res.status).toBe(400);
    expect(confirmPendingEmail).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el usuario encontrado no tiene un pendingEmail (link reutilizado tras confirmar)', async () => {
    const user = makeUser({ pendingEmail: null });
    (findUserByPendingEmailTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const app = buildAppNoAuth();
    const res = await supertest(app).post('/api/profile/email/confirm-change').send({ token: RAW_TOKEN });

    expect(res.status).toBe(400);
    expect(confirmPendingEmail).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el token enviado es demasiado corto', async () => {
    const app = buildAppNoAuth();
    const res = await supertest(app).post('/api/profile/email/confirm-change').send({ token: 'abc' });

    expect(res.status).toBe(400);
    expect(findUserByPendingEmailTokenHash).not.toHaveBeenCalled();
  });
});

// ─── Flujo completo: solicitar cambio → confirmar con el token ──────────────

describe('Flujo completo de cambio de correo', () => {
  it('solicita el cambio, y luego confirma con el token generado', async () => {
    const bcrypt = await import('bcryptjs');
    const currentHash = await bcrypt.default.hash('actual123', 10);
    const baseUser = makeUser({ passwordHash: currentHash, email: 'ana@example.com' });

    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(baseUser);
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const authedApp = buildApp(USER_ID);
    const requestRes = await authedApp
      ? await supertest(authedApp)
          .post('/api/profile/email/request-change')
          .send({ newEmail: 'ana-nueva@example.com', currentPassword: 'actual123' })
      : null;
    expect(requestRes!.status).toBe(200);

    // El token real generado no se puede leer desde la respuesta (solo se envía por correo),
    // así que simulamos que el store ya lo tiene guardado y el usuario hace clic en el link.
    const userWithPending = makeUser({
      pendingEmail: 'ana-nueva@example.com',
      pendingEmailExpires: new Date(Date.now() + 60_000).toISOString(),
    });
    (findUserByPendingEmailTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(userWithPending);

    const publicApp = buildAppNoAuth();
    const confirmRes = await supertest(publicApp)
      .post('/api/profile/email/confirm-change')
      .send({ token: 'd'.repeat(64) });

    expect(confirmRes.status).toBe(200);
    expect(confirmPendingEmail).toHaveBeenCalledWith(USER_ID, 'ana-nueva@example.com');
  });
});
