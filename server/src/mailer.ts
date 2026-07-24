import nodemailer, { type Transporter } from 'nodemailer';
import {
  renderEmailChangeEmail,
  renderJobMatchEmail,
  renderNewMessageEmail,
  renderSecurityAlertEmail,
  renderVerificationEmail,
  type EmailChangeEmailData,
  type JobMatchEmailData,
  type NewMessageEmailData,
  type SecurityAlertEmailData,
  type VerificationEmailData,
} from './emailTemplates.js';

let transporterPromise: Promise<Transporter> | null = null;
let usingEthereal = false;

/**
 * Crea (una sola vez, memoizado) el transporter de Nodemailer.
 * - Si hay credenciales SMTP en el entorno, las usa (proveedor real).
 * - Si no, crea automáticamente una cuenta de prueba en Ethereal para que
 *   el flujo de "correo de bienvenida" funcione end-to-end en desarrollo
 *   sin necesidad de credenciales reales. Los correos no se entregan de
 *   verdad, pero se puede previsualizar el HTML mediante una URL en consola.
 */
async function getTransporter(): Promise<Transporter> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT ?? 587),
        secure: Number(SMTP_PORT ?? 587) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    }

    usingEthereal = true;
    const testAccount = await nodemailer.createTestAccount();
    console.warn(
      '[mailer] No se encontró configuración SMTP. Usando cuenta de prueba Ethereal.\n' +
        '[mailer] Los correos no llegan a bandejas reales; se mostrará una URL de vista previa por cada envío.',
    );
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  })();

  return transporterPromise;
}

async function dispatch(
  to: string,
  rendered: { subject: string; html: string; text: string },
  logLabel: string,
): Promise<{ previewUrl?: string }> {
  const transporter = await getTransporter();
  const from = process.env.SMTP_FROM || '"TalentFlow AI" <no-reply@talentflow.ai>';

  const info = await transporter.sendMail({
    from,
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  if (usingEthereal) {
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      console.log(`[mailer] Vista previa (${logLabel}): ${previewUrl}`);
    }
    return { previewUrl };
  }

  return {};
}

export async function sendVerificationEmail(
  to: string,
  data: VerificationEmailData,
): Promise<{ previewUrl?: string }> {
  return dispatch(to, renderVerificationEmail(data), 'verificación de correo');
}

export async function sendSecurityAlertEmail(
  to: string,
  data: SecurityAlertEmailData,
): Promise<{ previewUrl?: string }> {
  return dispatch(to, renderSecurityAlertEmail(data), 'alerta de seguridad');
}

export async function sendEmailChangeEmail(
  to: string,
  data: EmailChangeEmailData,
): Promise<{ previewUrl?: string }> {
  return dispatch(to, renderEmailChangeEmail(data), 'confirmación de cambio de correo');
}

export async function sendJobMatchEmail(
  to: string,
  data: JobMatchEmailData,
): Promise<{ previewUrl?: string }> {
  return dispatch(to, renderJobMatchEmail(data), 'nueva oferta compatible');
}

export async function sendNewMessageEmail(
  to: string,
  data: NewMessageEmailData,
): Promise<{ previewUrl?: string }> {
  return dispatch(to, renderNewMessageEmail(data), 'nuevo mensaje');
}
