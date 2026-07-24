import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret';
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
