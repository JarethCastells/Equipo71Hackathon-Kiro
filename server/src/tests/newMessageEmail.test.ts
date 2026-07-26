/**
 * Pruebas para la plantilla de nuevo mensaje y el helper de envío.
 * Requisito 7.2
 */
import { describe, expect, it, vi } from 'vitest';
import { renderNewMessageEmail } from '../emailTemplates.js';

// ─── renderNewMessageEmail ────────────────────────────────────────────────────

describe('renderNewMessageEmail', () => {
  const baseData = {
    recipientName: 'Ana García',
    senderName: 'Carlos López',
    preview: 'Hola, ¿puedes revisar el contrato?',
    conversationUrl: 'https://talentflow.ai/dashboard/mensajes/conv-123',
  };

  it('devuelve subject, html y text', () => {
    const result = renderNewMessageEmail(baseData);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  it('el subject menciona el nombre del remitente', () => {
    const { subject } = renderNewMessageEmail(baseData);
    expect(subject).toContain('Carlos López');
  });

  it('el html incluye el nombre del receptor', () => {
    const { html } = renderNewMessageEmail(baseData);
    expect(html).toContain('Ana García');
  });

  it('el html incluye el nombre del remitente', () => {
    const { html } = renderNewMessageEmail(baseData);
    expect(html).toContain('Carlos López');
  });

  it('el html incluye la vista previa del mensaje', () => {
    const { html } = renderNewMessageEmail(baseData);
    expect(html).toContain('¿puedes revisar el contrato?');
  });

  it('el html incluye la URL de la conversación', () => {
    const { html } = renderNewMessageEmail(baseData);
    expect(html).toContain(baseData.conversationUrl);
  });

  it('el text incluye el nombre del remitente, la vista previa y la URL', () => {
    const { text } = renderNewMessageEmail(baseData);
    expect(text).toContain('Carlos López');
    expect(text).toContain('¿puedes revisar el contrato?');
    expect(text).toContain(baseData.conversationUrl);
  });

  it('escapa caracteres HTML peligrosos en el nombre del remitente', () => {
    const { html } = renderNewMessageEmail({
      ...baseData,
      senderName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapa caracteres HTML peligrosos en la vista previa', () => {
    const { html } = renderNewMessageEmail({
      ...baseData,
      preview: '<img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('el html es una página HTML completa (tiene doctype y html)', () => {
    const { html } = renderNewMessageEmail(baseData);
    expect(html.toLowerCase()).toContain('<!doctype html>');
    expect(html.toLowerCase()).toContain('<html');
  });
});

// ─── sendNewMessageEmail usa dispatch (preview Ethereal) ─────────────────────

// sendNewMessageEmail delega en dispatch → getTransporter → sendMail. Sin
// SMTP configurado, getTransporter cae a Ethereal, que crea una cuenta de
// prueba REAL por red (nodemailer.createTestAccount()). Depender de esa
// llamada de red real hace el test lento y frágil (falla por timeout en
// entornos con red restringida/sandbox), así que se mockea nodemailer
// completo para probar solo la lógica propia de mailer.ts sin red real.
vi.mock('nodemailer', () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' });
  return {
    default: {
      createTestAccount: vi.fn().mockResolvedValue({
        user: 'test-user',
        pass: 'test-pass',
        smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
      }),
      createTransport: vi.fn().mockReturnValue({ sendMail }),
      getTestMessageUrl: vi.fn().mockReturnValue('https://ethereal.email/message/preview-id'),
    },
  };
});

describe('sendNewMessageEmail', () => {
  it('llama a sendMail y devuelve un objeto con previewUrl en modo Ethereal', async () => {
    const { sendNewMessageEmail } = await import('../mailer.js');

    const result = await sendNewMessageEmail('recipient@example.com', {
      recipientName: 'Ana García',
      senderName: 'Carlos López',
      preview: 'Hola, ¿puedes revisar el contrato?',
      conversationUrl: 'https://talentflow.ai/dashboard/mensajes/conv-123',
    });

    expect(result).toHaveProperty('previewUrl', 'https://ethereal.email/message/preview-id');
  });
});
