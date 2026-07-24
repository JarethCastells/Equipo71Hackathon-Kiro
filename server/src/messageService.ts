/**
 * messageService.ts — Punto único de escritura para mensajes directos.
 *
 * postMessage() centraliza: validación, persistencia, notificación in-app
 * y envío de correo con throttling. Tanto el router REST como la capa
 * WebSocket llaman a esta función; ninguno duplica la lógica.
 *
 * Cumple Requisitos 4.1, 4.2, 4.3, 7.1, 7.2, 7.3, 7.4.
 */

import type { RowDataPacket } from 'mysql2';
import pool from './db.js';
import { createMessage } from './messageStore.js';
import { getMembership, setLastEmailAt } from './messageStore.js';
import { touchLastMessage } from './conversationStore.js';
import { createNotification } from './notificationStore.js';
import { sendNewMessageEmail } from './mailer.js';
import type { Message } from './types.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Longitud máxima del cuerpo de un mensaje (Requisito 4.3). */
const MAX_BODY_LENGTH = 2000;

/** Tiempo mínimo entre correos para un mismo receptor en una conversación (min). */
const EMAIL_COOLDOWN_MINUTES = 5;

// ─── Interfaz pública ────────────────────────────────────────────────────────

export interface PostMessageParams {
  conversationId: string;
  senderId: string;
  body: string;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  notify_new_matches: number;
}

/**
 * Devuelve id, nombre, email y preferencia de notificación de un usuario.
 * Devuelve null si el usuario no existe.
 */
async function getUserById(userId: string): Promise<UserRow | null> {
  const [rows] = await pool.query<UserRow[]>(
    'SELECT id, name, email, notify_new_matches FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * Recupera el ID del otro miembro de la conversación (receptor).
 * Devuelve null si la conversación no existe o el senderId no es miembro.
 */
async function getRecipientId(
  conversationId: string,
  senderId: string,
): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM conversation_members
     WHERE conversation_id = ? AND user_id != ?
     LIMIT 1`,
    [conversationId, senderId],
  );
  const row = rows[0] as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

/**
 * Evalúa si debe enviarse correo al receptor:
 * - Se considera siempre inactivo en esta tarea (sin lógica de presencia por socket).
 * - last_email_at debe ser null o haber pasado EMAIL_COOLDOWN_MINUTES.
 * - notify_new_matches del receptor debe estar activo.
 */
function shouldSendEmail(lastEmailAt: Date | null, notifyEnabled: boolean): boolean {
  if (!notifyEnabled) return false;
  if (lastEmailAt === null) return true;

  const minutesSinceLast =
    (Date.now() - new Date(lastEmailAt).getTime()) / 1000 / 60;
  return minutesSinceLast >= EMAIL_COOLDOWN_MINUTES;
}

// ─── postMessage ─────────────────────────────────────────────────────────────

/**
 * Valida, persiste y difunde efectos secundarios de un nuevo mensaje.
 *
 * @throws {Error} con mensaje en español si la validación falla.
 * @returns El mensaje público listo para difundir por WebSocket o REST.
 */
export async function postMessage(params: PostMessageParams): Promise<Message> {
  const { conversationId, senderId } = params;

  // ── 1. Validación del body (Requisito 4.3) ────────────────────────────────
  const body = params.body.trim();

  if (body.length === 0) {
    throw new Error('El cuerpo del mensaje no puede estar vacío.');
  }

  if (body.length > MAX_BODY_LENGTH) {
    throw new Error(
      `El mensaje no puede superar los ${MAX_BODY_LENGTH} caracteres.`,
    );
  }

  // ── 2. Persistir mensaje y actualizar conversación (Requisitos 4.1, 4.2) ──
  const message = await createMessage({ conversationId, senderId, body });
  await touchLastMessage(conversationId);

  // ── 3. Obtener el receptor ────────────────────────────────────────────────
  const recipientId = await getRecipientId(conversationId, senderId);

  if (recipientId === null) {
    // No hay receptor (conversación vacía o mal estado); el mensaje ya fue
    // persistido — se devuelve igualmente para no perder el envío.
    return message;
  }

  // ── 4. Notificación in-app (Requisito 7.1) ────────────────────────────────
  // Efecto secundario: no bloquea ni cancela si falla.
  const sender = await getUserById(senderId);
  const senderName = sender?.name ?? 'Alguien';
  const preview = body.length > 100 ? `${body.slice(0, 97)}…` : body;

  await createNotification(
    recipientId,
    'system',
    `Nuevo mensaje de ${senderName}`,
    preview,
  );

  // ── 5. Correo con throttling (Requisitos 7.2, 7.3, 7.4) ──────────────────
  try {
    const [recipientUser, membership] = await Promise.all([
      getUserById(recipientId),
      getMembership(conversationId, recipientId),
    ]);

    if (recipientUser && membership) {
      const notifyEnabled = Boolean(recipientUser.notify_new_matches);
      const lastEmailAt = membership.last_email_at
        ? new Date(membership.last_email_at)
        : null;

      if (shouldSendEmail(lastEmailAt, notifyEnabled)) {
        const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
        const conversationUrl = `${clientUrl}/dashboard/mensajes/${conversationId}`;

        await sendNewMessageEmail(recipientUser.email, {
          recipientName: recipientUser.name,
          senderName,
          preview,
          conversationUrl,
        });

        await setLastEmailAt(conversationId, recipientId, new Date());
      }
    }
  } catch (err) {
    // Requisito 7.3: los fallos de correo no cancelan el envío del mensaje.
    console.error('[messageService] Fallo al enviar correo de nuevo mensaje:', err);
  }

  return message;
}
