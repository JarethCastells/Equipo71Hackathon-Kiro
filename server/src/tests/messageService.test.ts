/**
 * Pruebas unitarias de messageService.ts
 *
 * Cubre:
 * - Un fallo de correo no rompe el envío del mensaje (Requisito 7.3)
 * - El cooldown omite correos repetidos: si last_email_at es reciente no envía
 *   correo (Requisito 7.2)
 * - Validación del body: vacío y exceso de longitud (Requisito 4.3)
 *
 * Estrategia: se inyectan mocks de los módulos de dependencia (messageStore,
 * conversationStore, notificationStore y mailer) usando vi.mock para aislar
 * completamente la lógica del servicio de la BD y del SMTP.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks de módulos ─────────────────────────────────────────────────────────

// Hay que mockear ANTES de importar el módulo bajo test (Vitest hoisting)
vi.mock('../messageStore.js', () => ({
  createMessage: vi.fn(),
  getMembership: vi.fn(),
  setLastEmailAt: vi.fn(),
}));

vi.mock('../conversationStore.js', () => ({
  touchLastMessage: vi.fn(),
}));

vi.mock('../notificationStore.js', () => ({
  createNotification: vi.fn(),
}));

vi.mock('../mailer.js', () => ({
  sendNewMessageEmail: vi.fn(),
}));

// Mock de pool (db.js) — sólo necesitamos el método query
vi.mock('../db.js', () => ({
  default: {
    query: vi.fn(),
  },
}));

// ─── Imports tras los mocks ───────────────────────────────────────────────────

import { touchLastMessage } from '../conversationStore.js';
import pool from '../db.js';
import { sendNewMessageEmail } from '../mailer.js';
import { postMessage } from '../messageService.js';
import { createMessage, getMembership, setLastEmailAt } from '../messageStore.js';
import { createNotification } from '../notificationStore.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMessage(
  overrides: Partial<import('../types.js').Message> = {},
): import('../types.js').Message {
  return {
    id: 'msg-001',
    conversationId: 'conv-001',
    senderId: 'user-sender',
    body: 'Hola mundo',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMembership(
  overrides: Partial<{
    last_email_at: Date | null;
    last_read_at: Date | null;
  }> = {},
) {
  return {
    id: 'member-001',
    conversation_id: 'conv-001',
    user_id: 'user-recipient',
    last_read_at: overrides.last_read_at ?? null,
    last_email_at: overrides.last_email_at ?? null,
    joined_at: new Date('2024-01-01T00:00:00Z'),
    constructor: { name: 'RowDataPacket' },
  };
}

/** Configura los mocks del pool para simular sender y recipient en BD. */
function setupPoolMocks(
  options: {
    recipientId?: string | null;
    senderName?: string;
    recipientEmail?: string;
    notifyEnabled?: boolean;
  } = {},
) {
  const {
    recipientId = 'user-recipient',
    senderName = 'Alice Demo',
    recipientEmail = 'recipient@example.com',
    notifyEnabled = true,
  } = options;

  const poolMock = pool as unknown as { query: ReturnType<typeof vi.fn> };

  // El pool.query es llamado 3 veces en el flujo completo:
  // 1. getRecipientId → devuelve recipientId
  // 2. getUserById(senderId) → devuelve info del emisor
  // 3. (dentro del try) getUserById(recipientId) y getMembership son llamadas de módulo
  //    pero pool.query directamente se usa para getRecipientId y getUserById
  let callCount = 0;
  poolMock.query.mockImplementation(async () => {
    callCount++;
    if (callCount === 1) {
      // getRecipientId
      if (recipientId === null) return [[]];
      return [[{ user_id: recipientId }]];
    }
    if (callCount === 2) {
      // getUserById(senderId)
      return [
        [
          {
            id: 'user-sender',
            name: senderName,
            email: 'sender@example.com',
            notify_new_matches: 1,
          },
        ],
      ];
    }
    if (callCount === 3) {
      // getUserById(recipientId) — dentro del try del correo
      return [
        [
          {
            id: recipientId,
            name: 'Bob Demo',
            email: recipientEmail,
            notify_new_matches: notifyEnabled ? 1 : 0,
          },
        ],
      ];
    }
    return [[]];
  });
}

// ─── beforeEach: limpiar mocks ────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Defaults: createMessage y touchLastMessage siempre OK
  (createMessage as ReturnType<typeof vi.fn>).mockResolvedValue(makeMessage());
  (touchLastMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (createNotification as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (setLastEmailAt as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (sendNewMessageEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ previewUrl: undefined });
});

// ─── Validación del body ─────────────────────────────────────────────────────

describe('postMessage – validación del body', () => {
  it('rechaza body vacío con error en español', async () => {
    await expect(
      postMessage({ conversationId: 'conv-001', senderId: 'user-001', body: '' }),
    ).rejects.toThrow('vacío');
  });

  it('rechaza body solo espacios (trim → vacío) con error en español', async () => {
    await expect(
      postMessage({ conversationId: 'conv-001', senderId: 'user-001', body: '   ' }),
    ).rejects.toThrow('vacío');
  });

  it('rechaza body que excede 2000 caracteres con error en español', async () => {
    const longBody = 'a'.repeat(2001);
    await expect(
      postMessage({ conversationId: 'conv-001', senderId: 'user-001', body: longBody }),
    ).rejects.toThrow('2000');
  });

  it('acepta body de exactamente 2000 caracteres', async () => {
    setupPoolMocks({ recipientId: null }); // sin receptor para simplificar
    const exactBody = 'a'.repeat(2000);
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      postMessage({ conversationId: 'conv-001', senderId: 'user-001', body: exactBody }),
    ).resolves.toBeDefined();
  });

  it('no persiste nada cuando el body es inválido', async () => {
    await expect(
      postMessage({ conversationId: 'conv-001', senderId: 'user-001', body: '' }),
    ).rejects.toThrow();

    expect(createMessage).not.toHaveBeenCalled();
    expect(touchLastMessage).not.toHaveBeenCalled();
  });
});

// ─── Fallo de correo no rompe el envío ───────────────────────────────────────

describe('postMessage – fallo de correo no cancela el envío (Requisito 7.3)', () => {
  it('devuelve el mensaje aunque sendNewMessageEmail lance un error', async () => {
    setupPoolMocks();

    const membership = makeMembership({ last_email_at: null });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(membership);

    // sendNewMessageEmail lanza un error de red
    (sendNewMessageEmail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('SMTP connection refused'),
    );

    const expectedMessage = makeMessage({ body: 'Mensaje de prueba' });
    (createMessage as ReturnType<typeof vi.fn>).mockResolvedValue(expectedMessage);

    const result = await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Mensaje de prueba',
    });

    // El mensaje sí se devuelve a pesar del fallo de correo
    expect(result).toEqual(expectedMessage);
  });

  it('el mensaje fue persistido aunque el correo fallara', async () => {
    setupPoolMocks();

    const membership = makeMembership({ last_email_at: null });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(membership);

    (sendNewMessageEmail as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Timeout'));

    await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Test',
    });

    expect(createMessage).toHaveBeenCalledOnce();
    expect(touchLastMessage).toHaveBeenCalledWith('conv-001');
  });

  it('la notificación in-app se crea aunque el correo falle', async () => {
    setupPoolMocks();

    const membership = makeMembership({ last_email_at: null });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(membership);

    (sendNewMessageEmail as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Error de red'));

    await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Hola',
    });

    expect(createNotification).toHaveBeenCalled();
  });
});

// ─── Cooldown de correo ───────────────────────────────────────────────────────

describe('postMessage – cooldown omite correos repetidos (Requisito 7.2)', () => {
  it('no envía correo si last_email_at es reciente (< 5 minutos)', async () => {
    setupPoolMocks();

    // Correo enviado hace 3 minutos → dentro del cooldown
    const recentEmailAt = new Date(Date.now() - 3 * 60 * 1000);
    const membership = makeMembership({ last_email_at: recentEmailAt });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(membership);

    await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Segundo mensaje',
    });

    expect(sendNewMessageEmail).not.toHaveBeenCalled();
  });

  it('no actualiza setLastEmailAt si no se envió correo por cooldown', async () => {
    setupPoolMocks();

    const recentEmailAt = new Date(Date.now() - 2 * 60 * 1000);
    const membership = makeMembership({ last_email_at: recentEmailAt });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(membership);

    await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Test cooldown',
    });

    expect(setLastEmailAt).not.toHaveBeenCalled();
  });

  it('sí envía correo si last_email_at es null (primer correo)', async () => {
    setupPoolMocks();

    const membership = makeMembership({ last_email_at: null });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(membership);

    await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Primer mensaje',
    });

    expect(sendNewMessageEmail).toHaveBeenCalledOnce();
    expect(setLastEmailAt).toHaveBeenCalledOnce();
  });

  it('sí envía correo si last_email_at expiró (>= 5 minutos)', async () => {
    setupPoolMocks();

    // Correo enviado hace 10 minutos → fuera del cooldown
    const oldEmailAt = new Date(Date.now() - 10 * 60 * 1000);
    const membership = makeMembership({ last_email_at: oldEmailAt });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(membership);

    await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Mensaje tras cooldown',
    });

    expect(sendNewMessageEmail).toHaveBeenCalledOnce();
    expect(setLastEmailAt).toHaveBeenCalledOnce();
  });

  it('no envía correo si el receptor tiene notify_new_matches desactivado', async () => {
    setupPoolMocks({ notifyEnabled: false });

    const membership = makeMembership({ last_email_at: null });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(membership);

    await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Mensaje sin notificación',
    });

    expect(sendNewMessageEmail).not.toHaveBeenCalled();
  });
});

// ─── Flujo principal ─────────────────────────────────────────────────────────

describe('postMessage – flujo principal', () => {
  it('devuelve el mensaje público persistido', async () => {
    setupPoolMocks({ recipientId: null });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const expected = makeMessage({ body: 'Mi mensaje' });
    (createMessage as ReturnType<typeof vi.fn>).mockResolvedValue(expected);

    const result = await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Mi mensaje',
    });

    expect(result).toEqual(expected);
  });

  it('llama a touchLastMessage con el conversationId correcto', async () => {
    setupPoolMocks({ recipientId: null });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await postMessage({
      conversationId: 'conv-test-123',
      senderId: 'user-sender',
      body: 'Hola',
    });

    expect(touchLastMessage).toHaveBeenCalledWith('conv-test-123');
  });

  it('crea notificación in-app para el receptor', async () => {
    setupPoolMocks();

    const membership = makeMembership({ last_email_at: null });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(membership);

    await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: 'Hola receptor',
    });

    expect(createNotification).toHaveBeenCalledWith(
      'user-recipient',
      'system',
      expect.stringContaining('Nuevo mensaje'),
      expect.any(String),
    );
  });

  it('aplica trim al body antes de persistir', async () => {
    setupPoolMocks({ recipientId: null });
    (getMembership as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await postMessage({
      conversationId: 'conv-001',
      senderId: 'user-sender',
      body: '  Hola con espacios  ',
    });

    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Hola con espacios' }),
    );
  });
});
