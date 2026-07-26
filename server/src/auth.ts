import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

// Se carga aquí (y no solo en index.ts) porque en ESM los módulos importados
// se inicializan antes de que se ejecute el cuerpo de index.ts. realtime.ts
// importa este módulo ANTES que db.ts (que es el único otro lugar que llama
// dotenv.config()), así que sin esto JWT_SECRET se leería vacío incluso con
// un .env válido: mismo problema documentado en db.ts, aplicado aquí también.
dotenv.config();

/**
 * Resuelve el secreto usado para firmar/verificar JWT.
 *
 * - Si JWT_SECRET está definido en el entorno, se usa tal cual.
 * - En producción, si falta, se lanza un error duro: firmar tokens de
 *   sesión con un secreto público y hardcodeado (como antes) permite que
 *   cualquiera que lea el código fuente forje tokens válidos para
 *   cualquier usuario.
 * - Fuera de producción (dev/test sin .env configurado), se genera un
 *   secreto aleatorio único para esa ejecución del proceso: la app sigue
 *   funcionando, pero las sesiones se invalidan al reiniciar el servidor
 *   y el secreto nunca queda expuesto en el código.
 */
function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.trim().length > 0) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Falta JWT_SECRET en el entorno. Es obligatorio en producción: sin él, cualquiera que lea el código fuente podría forjar tokens de sesión válidos para cualquier usuario.',
    );
  }

  console.warn(
    '[auth] JWT_SECRET no está configurado. Usando un secreto aleatorio válido solo para esta ejecución ' +
      '(las sesiones existentes se invalidarán al reiniciar el servidor). Define JWT_SECRET en server/.env antes de producción.',
  );
  return randomBytes(32).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();
const TOKEN_TTL = '7d';
const PENDING_2FA_TTL = '5m';

export interface AuthPayload {
  sub: string;
  email: string;
}

export interface Pending2FAPayload {
  sub: string;
  purpose: '2fa-pending';
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/**
 * Token de corta duración (5 min) emitido tras validar correo+contraseña
 * cuando la cuenta tiene 2FA activado. NO sirve como sesión: solo autoriza
 * el siguiente paso (enviar el código TOTP a /api/auth/verify-login).
 */
export function signPending2FAToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: '2fa-pending' }, JWT_SECRET, {
    expiresIn: PENDING_2FA_TTL,
  });
}

export function verifyPending2FAToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Pending2FAPayload;
    if (payload.purpose !== '2fa-pending') return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  auth?: AuthPayload;
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const token = header.slice('Bearer '.length);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
    return;
  }

  req.auth = payload;
  next();
}
