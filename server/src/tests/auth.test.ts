/**
 * Pruebas de integración del router auth.ts
 *
 * Cubre el flujo crítico completo de autenticación:
 * - POST /api/auth/signup     — registro (Req: cuenta creada, sin JWT hasta verificar)
 * - POST /api/auth/verify     — verificación de correo (idempotente, expiración)
 * - POST /api/auth/resend-verification — reenvío (respuesta genérica anti-enumeración)
 * - POST /api/auth/login      — login (credenciales inválidas genéricas, email no verificado, 2FA)
 * - POST /api/auth/verify-login — segundo factor TOTP
 * - GET  /api/auth/me         — perfil del usuario autenticado
 *
 * Estrategia: se mockean userStore, mailer, activityStore y otplib para
 * aislar el router. bcryptjs y jsonwebtoken se usan reales (son rápidos y
 * son justamente lo que queremos validar end-to-end en el flujo de auth).
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (antes de importar el router) ─────────────────────────────────────

// Los limiters de auth.ts se instancian una sola vez a nivel de módulo (al
// importar el router) y comparten estado por IP entre TODOS los tests de
// este archivo, ya que supertest siempre pega desde 127.0.0.1. Sin este
// mock, tests posteriores empiezan a recibir 429 aunque no sea eso lo que
// se está probando. El comportamiento real del rate limit se cubre aparte.
vi.mock('express-rate-limit', () => ({
  default: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../userStore.js', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  findUserByVerificationTokenHash: vi.fn(),
  markEmailVerified: vi.fn(),
  setVerificationToken: vi.fn(),
}));

vi.mock('../mailer.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ previewUrl: 'https://ethereal.example/preview' }),
}));

vi.mock('../activityStore.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// otplib real es determinista dado un secreto+tiempo, pero para no acoplar
// el test al reloj se mockea `authenticator.check`.
vi.mock('otplib', () => ({
  authenticator: {
    options: {},
    check: vi.fn(),
  },
}));

import { authenticator } from 'otplib';
import { logActivity } from '../activityStore.js';
import { sendVerificationEmail } from '../mailer.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByVerificationTokenHash,
  markEmailVerified,
  setVerificationToken,
} from '../userStore.js';
import authRoutes from '../routes/auth.js';

// ─── App de test ──────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    res.status(500).json({ error: msg });
  });

  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-001',
    name: 'Ana Tester',
    email: 'ana@example.com',
    passwordHash: '',
    role: 'freelancer',
    emailVerified: false,
    verificationTokenHash: 'abc123hash',
    verificationTokenExpires: new Date(Date.now() + 60_000).toISOString(),
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  it('crea la cuenta y devuelve 201 sin emitir JWT', async () => {
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createUser as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ id: 'user-new', email: 'nuevo@example.com' }),
    );

    const app = buildApp();
    const res = await supertest(app).post('/api/auth/signup').send({
      name: 'Nuevo Usuario',
      email: 'nuevo@example.com',
      password: 'password123',
      role: 'freelancer',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(res.body.emailSent).toBe(true);
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('registra el evento account_created en el log de actividad', async () => {
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createUser as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser({ id: 'user-new' }));

    const app = buildApp();
    await supertest(app).post('/api/auth/signup').send({
      name: 'Nuevo Usuario',
      email: 'nuevo@example.com',
      password: 'password123',
    });

    expect(logActivity).toHaveBeenCalledWith('user-new', 'account_created', expect.any(String), expect.anything());
  });

  it('usa el rol "freelancer" por defecto si el rol es inválido', async () => {
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createUser as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());

    const app = buildApp();
    await supertest(app).post('/api/auth/signup').send({
      name: 'Nuevo Usuario',
      email: 'nuevo@example.com',
      password: 'password123',
      role: 'admin-inexistente',
    });

    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'freelancer' }));
  });

  it('devuelve 400 si el nombre es muy corto', async () => {
    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/signup')
      .send({ name: 'A', email: 'a@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el correo no es válido', async () => {
    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/signup')
      .send({ name: 'Ana', email: 'no-es-un-correo', password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('devuelve 400 si la contraseña tiene menos de 8 caracteres', async () => {
    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/signup')
      .send({ name: 'Ana', email: 'ana@example.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('devuelve 409 si el correo ya está registrado', async () => {
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/signup')
      .send({ name: 'Ana', email: 'ana@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('la cuenta se crea aunque el envío de correo falle, marcando emailSent:false', async () => {
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createUser as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser({ id: 'user-new' }));
    (sendVerificationEmail as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('SMTP caído'));

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/signup')
      .send({ name: 'Ana', email: 'ana@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.emailSent).toBe(false);
  });
});

// ─── POST /api/auth/verify ────────────────────────────────────────────────────

describe('POST /api/auth/verify', () => {
  const RAW_TOKEN = 'a'.repeat(64); // >= 10 chars, simula randomBytes(32).toString('hex')

  it('verifica la cuenta y devuelve un JWT de sesión', async () => {
    const user = makeUser({ emailVerified: false });
    (findUserByVerificationTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const app = buildApp();
    const res = await supertest(app).post('/api/auth/verify').send({ token: RAW_TOKEN });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.emailVerified).toBe(true);
    expect(markEmailVerified).toHaveBeenCalledWith(user.id);
  });

  it('es idempotente: verificar una cuenta ya verificada devuelve 200 con alreadyVerified', async () => {
    const user = makeUser({ emailVerified: true });
    (findUserByVerificationTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const app = buildApp();
    const res = await supertest(app).post('/api/auth/verify').send({ token: RAW_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body.alreadyVerified).toBe(true);
    expect(markEmailVerified).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el token no existe en BD', async () => {
    (findUserByVerificationTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildApp();
    const res = await supertest(app).post('/api/auth/verify').send({ token: RAW_TOKEN });

    expect(res.status).toBe(400);
  });

  it('devuelve 400 con expired:true si el token ya expiró', async () => {
    const user = makeUser({
      emailVerified: false,
      verificationTokenExpires: new Date(Date.now() - 60_000).toISOString(),
    });
    (findUserByVerificationTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const app = buildApp();
    const res = await supertest(app).post('/api/auth/verify').send({ token: RAW_TOKEN });

    expect(res.status).toBe(400);
    expect(res.body.expired).toBe(true);
    expect(markEmailVerified).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el token es demasiado corto', async () => {
    const app = buildApp();
    const res = await supertest(app).post('/api/auth/verify').send({ token: 'abc' });

    expect(res.status).toBe(400);
    expect(findUserByVerificationTokenHash).not.toHaveBeenCalled();
  });
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────

describe('POST /api/auth/resend-verification — anti user-enumeration', () => {
  it('devuelve el mismo mensaje genérico si la cuenta no existe', async () => {
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'no-existe@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/si existe una cuenta/i);
    expect(setVerificationToken).not.toHaveBeenCalled();
  });

  it('devuelve el mismo mensaje genérico si la cuenta ya está verificada', async () => {
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser({ emailVerified: true }));

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'ana@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/si existe una cuenta/i);
    expect(setVerificationToken).not.toHaveBeenCalled();
  });

  it('genera un nuevo token y reenvía el correo si la cuenta existe y no está verificada', async () => {
    const user = makeUser({ emailVerified: false });
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'ana@example.com' });

    expect(res.status).toBe(200);
    expect(setVerificationToken).toHaveBeenCalledWith(user.id, expect.any(String), expect.any(Date));
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('devuelve 400 si el correo no es válido', async () => {
    const app = buildApp();
    const res = await supertest(app).post('/api/auth/resend-verification').send({ email: 'invalido' });

    expect(res.status).toBe(400);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('devuelve 401 genérico si el usuario no existe (sin filtrar la causa)', async () => {
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe@example.com', password: 'cualquiera123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenciales inválidas/i);
  });

  it('devuelve 401 genérico si la contraseña es incorrecta (mismo mensaje que usuario inexistente)', async () => {
    const bcrypt = await import('bcryptjs');
    const realHash = await bcrypt.default.hash('password-correcta', 10);
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: realHash, emailVerified: true }),
    );

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'password-incorrecta' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/credenciales inválidas/i);
  });

  it('devuelve 403 con emailNotVerified:true si la cuenta no verificó su correo', async () => {
    const bcrypt = await import('bcryptjs');
    const realHash = await bcrypt.default.hash('password123', 10);
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: realHash, emailVerified: false }),
    );

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.emailNotVerified).toBe(true);
  });

  it('devuelve un JWT de sesión con credenciales correctas y correo verificado (sin 2FA)', async () => {
    const bcrypt = await import('bcryptjs');
    const realHash = await bcrypt.default.hash('password123', 10);
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: realHash, emailVerified: true, totpEnabled: false }),
    );

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('ana@example.com');
    expect(res.body.requiresTwoFactor).toBeUndefined();
  });

  it('con 2FA activado, devuelve pendingToken en vez de JWT de sesión', async () => {
    const bcrypt = await import('bcryptjs');
    const realHash = await bcrypt.default.hash('password123', 10);
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ passwordHash: realHash, emailVerified: true, totpEnabled: true, totpSecret: 'SECRET123' }),
    );

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.requiresTwoFactor).toBe(true);
    expect(typeof res.body.pendingToken).toBe('string');
    expect(res.body.token).toBeUndefined();
  });

  it('devuelve 400 si falta el correo o la contraseña', async () => {
    const app = buildApp();
    const res = await supertest(app).post('/api/auth/login').send({ email: 'ana@example.com' });

    expect(res.status).toBe(400);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });
});

// ─── POST /api/auth/verify-login (segundo factor) ────────────────────────────

describe('POST /api/auth/verify-login', () => {
  it('con código TOTP correcto, emite el JWT de sesión definitivo', async () => {
    const user = makeUser({ totpEnabled: true, totpSecret: 'SECRET123', emailVerified: true });
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(user);
    (authenticator.check as ReturnType<typeof vi.fn>).mockReturnValue(true);

    // Generamos un pendingToken real firmando con la misma función que usa el router de login
    const { signPending2FAToken } = await import('../auth.js');
    const pendingToken = signPending2FAToken(user.id);

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/verify-login')
      .send({ pendingToken, code: '123456' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(logActivity).toHaveBeenCalledWith(user.id, 'login', expect.any(String), expect.anything());
  });

  it('con código TOTP incorrecto, devuelve 401 y registra login_failed_2fa', async () => {
    const user = makeUser({ totpEnabled: true, totpSecret: 'SECRET123', emailVerified: true });
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(user);
    (authenticator.check as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { signPending2FAToken } = await import('../auth.js');
    const pendingToken = signPending2FAToken(user.id);

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/verify-login')
      .send({ pendingToken, code: '000000' });

    expect(res.status).toBe(401);
    expect(logActivity).toHaveBeenCalledWith(user.id, 'login_failed_2fa', expect.any(String), expect.anything());
  });

  it('devuelve 401 si el pendingToken es inválido o expiró', async () => {
    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/verify-login')
      .send({ pendingToken: 'token-invalido-o-viejo', code: '123456' });

    expect(res.status).toBe(401);
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el usuario ya no tiene 2FA activado (se desactivó entre login y verify-login)', async () => {
    const user = makeUser({ totpEnabled: false, totpSecret: null });
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const { signPending2FAToken } = await import('../auth.js');
    const pendingToken = signPending2FAToken(user.id);

    const app = buildApp();
    const res = await supertest(app)
      .post('/api/auth/verify-login')
      .send({ pendingToken, code: '123456' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('devuelve 401 sin header Authorization', async () => {
    const app = buildApp();
    const res = await supertest(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('devuelve el usuario público con un JWT válido', async () => {
    const user = makeUser();
    (findUserById as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const { signToken } = await import('../auth.js');
    const token = signToken({ sub: user.id, email: user.email });

    const app = buildApp();
    const res = await supertest(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('devuelve 401 con un JWT inválido', async () => {
    const app = buildApp();
    const res = await supertest(app).get('/api/auth/me').set('Authorization', 'Bearer token-basura');

    expect(res.status).toBe(401);
  });
});

// ─── Flujo completo: signup → verify → login ─────────────────────────────────

describe('Flujo completo: signup → verify → login', () => {
  it('registra, verifica y luego permite iniciar sesión con las mismas credenciales', async () => {
    const app = buildApp();
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash('password123', 10);

    // 1. Signup: la cuenta no existe todavía
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const createdUser = makeUser({
      id: 'user-flow',
      email: 'flow@example.com',
      passwordHash,
      emailVerified: false,
    });
    (createUser as ReturnType<typeof vi.fn>).mockResolvedValue(createdUser);

    const signupRes = await supertest(app).post('/api/auth/signup').send({
      name: 'Flujo Completo',
      email: 'flow@example.com',
      password: 'password123',
    });
    expect(signupRes.status).toBe(201);
    expect(signupRes.body.token).toBeUndefined();

    // 2. Verify: el token llega por "correo" (simulado) y se usa para activar la cuenta
    (findUserByVerificationTokenHash as ReturnType<typeof vi.fn>).mockResolvedValue(createdUser);
    const verifyRes = await supertest(app)
      .post('/api/auth/verify')
      .send({ token: 'b'.repeat(64) });
    expect(verifyRes.status).toBe(200);
    expect(typeof verifyRes.body.token).toBe('string');
    expect(markEmailVerified).toHaveBeenCalledWith('user-flow');

    // 3. Login: ahora la cuenta ya está verificada en BD
    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...createdUser,
      emailVerified: true,
    });
    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'flow@example.com', password: 'password123' });

    expect(loginRes.status).toBe(200);
    expect(typeof loginRes.body.token).toBe('string');
    expect(loginRes.body.user.email).toBe('flow@example.com');
  });

  it('el login falla con 403 si se intenta iniciar sesión ANTES de verificar el correo', async () => {
    const app = buildApp();
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash('password123', 10);

    (findUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ email: 'sinverificar@example.com', passwordHash, emailVerified: false }),
    );

    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'sinverificar@example.com', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.emailNotVerified).toBe(true);
  });
});
