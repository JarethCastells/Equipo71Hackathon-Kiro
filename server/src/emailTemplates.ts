export interface VerificationEmailData {
  name: string;
  role: 'freelancer' | 'voluntario' | 'reclutador';
  verifyUrl: string;
}

export interface SecurityAlertEmailData {
  name: string;
  eventTitle: string;
  eventDescription: string;
  timestamp: string;
  ipAddress?: string | null;
}

export interface EmailChangeEmailData {
  name: string;
  newEmail: string;
  confirmUrl: string;
}

export interface JobMatchEmailData {
  name: string;
  jobTitle: string;
  jobDescription: string;
  budgetPerHour: number;
  dashboardUrl: string;
}

export interface NewMessageEmailData {
  recipientName: string;
  senderName: string;
  preview: string;
  conversationUrl: string;
}

const ROLE_COPY: Record<VerificationEmailData['role'], { headline: string; body: string }> = {
  freelancer: {
    headline: 'Tu perfil freelance está a un clic de activarse',
    body: 'Confirma tu correo para completar tu portafolio y que la IA empiece a emparejarte con proyectos dentro de tu presupuesto ideal.',
  },
  voluntario: {
    headline: 'Gracias por sumarte como voluntario/a',
    body: 'Confirma tu correo para contarnos tus habilidades y disponibilidad, y que la IA te conecte con organizaciones que necesitan tu ayuda.',
  },
  reclutador: {
    headline: 'Ya casi puedes encontrar talento con IA',
    body: 'Confirma tu correo para definir el presupuesto de tu primer proyecto y mostrarte, en segundos, a los freelancers y voluntarios ideales.',
  },
};

/**
 * Envoltorio HTML compartido por todas las plantillas: header con degradado
 * de marca + tarjeta oscura + footer. Usa estilos inline y estructura de
 * tabla para máxima compatibilidad con clientes de correo (Outlook, Gmail,
 * Apple Mail no soportan bien CSS moderno ni hojas de estilo externas).
 */
function renderShell(title: string, bodyHtml: string, footerNote: string): string {
  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#05060a; font-family:'Segoe UI', Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#05060a; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:linear-gradient(135deg,#0a0d14,#11151f); border-radius:20px; overflow:hidden; border:1px solid rgba(255,255,255,0.08);">
            <tr>
              <td style="padding:36px 40px 24px 40px; background:linear-gradient(120deg,#0ea5e9,#8b5cf6); text-align:center;">
                <div style="display:inline-block; width:48px; height:48px; border-radius:14px; background:rgba(255,255,255,0.18); line-height:48px; font-size:22px; color:#ffffff; font-weight:bold;">✦</div>
                <h1 style="margin:16px 0 0; font-size:22px; color:#ffffff; font-weight:800;">TalentFlow AI</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 8px 40px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 32px 40px; text-align:center;">
                <p style="margin:0; font-size:12px; color:#5b6472;">${footerNote}</p>
                <p style="margin:6px 0 0; font-size:12px; color:#5b6472;">
                  © ${new Date().getFullYear()} TalentFlow AI. Todos los derechos reservados.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

/**
 * Bienvenida + verificación de correo. El botón principal es el único
 * camino para activar la cuenta: sin hacer clic aquí, el usuario no puede
 * iniciar sesión ni acceder al dashboard (evita registros automatizados).
 */
export function renderVerificationEmail(data: VerificationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const copy = ROLE_COPY[data.role];
  const subject = `Confirma tu correo para activar tu cuenta en TalentFlow AI`;

  const body = `
    <p style="margin:0 0 8px; font-size:13px; letter-spacing:0.06em; text-transform:uppercase; color:#7dd3fc; font-weight:600;">
      Un último paso para empezar
    </p>
    <h2 style="margin:0 0 16px; font-size:24px; line-height:1.3; color:#f4f5f7; font-weight:700;">
      Hola ${escapeHtml(data.name)}, ${escapeHtml(copy.headline)}
    </h2>
    <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#b6bdc9;">
      ${escapeHtml(copy.body)} Por tu seguridad, necesitamos confirmar que esta cuenta
      te pertenece antes de darte acceso al dashboard.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="border-radius:999px; background:linear-gradient(120deg,#0ea5e9,#8b5cf6);">
          <a href="${data.verifyUrl}" style="display:inline-block; padding:14px 28px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:999px;">
            Verificar mi correo y entrar →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 28px; font-size:12px; line-height:1.6; color:#5b6472;">
      Este enlace es válido por 24 horas. Si no creaste esta cuenta, puedes ignorar
      este correo con seguridad; tu dirección no quedará activada.
    </p>
    <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:20px; margin-top:8px;">
      <p style="margin:0 0 10px; font-size:13px; font-weight:600; color:#f4f5f7;">Al confirmar tu cuenta podrás:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr><td style="padding:6px 0; font-size:13px; color:#b6bdc9;">✅ &nbsp;Recibir matches de IA ajustados a tu presupuesto</td></tr>
        <tr><td style="padding:6px 0; font-size:13px; color:#b6bdc9;">✅ &nbsp;Revisar perfiles verificados en segundos</td></tr>
        <tr><td style="padding:6px 0; font-size:13px; color:#b6bdc9;">✅ &nbsp;Chatear y cerrar acuerdos sin fricción</td></tr>
      </table>
    </div>
  `;

  const html = renderShell(
    subject,
    body,
    'Recibiste este correo porque alguien creó una cuenta en TalentFlow AI con esta dirección.',
  );
  const text = `Hola ${data.name},\n\n${copy.headline}.\n${copy.body}\n\nConfirma tu correo para activar tu cuenta (válido 24h): ${data.verifyUrl}\n\nSi no creaste esta cuenta, ignora este correo.\n\n— El equipo de TalentFlow AI`;

  return { subject, html, text };
}

/**
 * Alerta de seguridad: se envía cuando ocurre un evento sensible en la
 * cuenta (cambio de contraseña, activación/desactivación de 2FA, nueva
 * cuenta bancaria, etc.). Sirve para que el usuario detecte accesos o
 * cambios que no reconozca.
 */
export function renderSecurityAlertEmail(data: SecurityAlertEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Alerta de seguridad: ${data.eventTitle}`;

  const body = `
    <p style="margin:0 0 8px; font-size:13px; letter-spacing:0.06em; text-transform:uppercase; color:#fb923c; font-weight:600;">
      Alerta de seguridad
    </p>
    <h2 style="margin:0 0 16px; font-size:22px; line-height:1.3; color:#f4f5f7; font-weight:700;">
      Hola ${escapeHtml(data.name)}, detectamos: ${escapeHtml(data.eventTitle)}
    </h2>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#b6bdc9;">
      ${escapeHtml(data.eventDescription)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 24px; background:rgba(255,255,255,0.04); border-radius:12px;">
      <tr>
        <td style="padding:14px 18px; font-size:13px; color:#b6bdc9;">
          <strong style="color:#f4f5f7;">Fecha:</strong> ${escapeHtml(data.timestamp)}<br/>
          ${data.ipAddress ? `<strong style="color:#f4f5f7;">Dirección IP:</strong> ${escapeHtml(data.ipAddress)}` : ''}
        </td>
      </tr>
    </table>
    <p style="margin:0; font-size:13px; line-height:1.6; color:#5b6472;">
      Si tú realizaste esta acción, no necesitas hacer nada más. Si no la reconoces,
      cambia tu contraseña de inmediato y activa la verificación en dos pasos desde
      Ajustes → Seguridad.
    </p>
  `;

  const html = renderShell(
    subject,
    body,
    'Recibiste este correo porque ocurrió un evento de seguridad en tu cuenta de TalentFlow AI.',
  );
  const text = `Hola ${data.name},\n\nDetectamos: ${data.eventTitle}\n${data.eventDescription}\n\nFecha: ${data.timestamp}${data.ipAddress ? `\nIP: ${data.ipAddress}` : ''}\n\nSi no reconoces esta acción, cambia tu contraseña de inmediato.\n\n— El equipo de TalentFlow AI`;

  return { subject, html, text };
}

/**
 * Confirmación de cambio de correo: se envía a la dirección NUEVA (no a la
 * anterior) para probar que el usuario tiene acceso a ella antes de que el
 * cambio se aplique de verdad.
 */
export function renderEmailChangeEmail(data: EmailChangeEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'Confirma tu nuevo correo en TalentFlow AI';

  const body = `
    <p style="margin:0 0 8px; font-size:13px; letter-spacing:0.06em; text-transform:uppercase; color:#7dd3fc; font-weight:600;">
      Cambio de correo solicitado
    </p>
    <h2 style="margin:0 0 16px; font-size:22px; line-height:1.3; color:#f4f5f7; font-weight:700;">
      Hola ${escapeHtml(data.name)}, confirma que este es tu nuevo correo
    </h2>
    <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#b6bdc9;">
      Solicitaste cambiar el correo de tu cuenta a <strong style="color:#f4f5f7;">${escapeHtml(data.newEmail)}</strong>.
      Confirma haciendo clic en el botón para que el cambio se aplique.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="border-radius:999px; background:linear-gradient(120deg,#0ea5e9,#8b5cf6);">
          <a href="${data.confirmUrl}" style="display:inline-block; padding:14px 28px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:999px;">
            Confirmar mi nuevo correo →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0; font-size:12px; line-height:1.6; color:#5b6472;">
      Este enlace es válido por 24 horas. Si no solicitaste este cambio, ignora este
      correo: tu dirección actual seguirá siendo la misma.
    </p>
  `;

  const html = renderShell(
    subject,
    body,
    'Recibiste este correo porque alguien solicitó cambiar el correo de una cuenta de TalentFlow AI a esta dirección.',
  );
  const text = `Hola ${data.name},\n\nSolicitaste cambiar tu correo a ${data.newEmail}.\nConfirma aquí (válido 24h): ${data.confirmUrl}\n\nSi no fuiste tú, ignora este correo.\n\n— El equipo de TalentFlow AI`;

  return { subject, html, text };
}

/**
 * Aviso de nueva oferta compatible con el perfil del destinatario. Es el
 * correo que dispara el motor de "avísame si hay ofertas que se ajusten".
 */
export function renderJobMatchEmail(data: JobMatchEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Nueva oferta para ti: ${data.jobTitle}`;

  const body = `
    <p style="margin:0 0 8px; font-size:13px; letter-spacing:0.06em; text-transform:uppercase; color:#34d399; font-weight:600;">
      Nueva coincidencia de IA
    </p>
    <h2 style="margin:0 0 16px; font-size:22px; line-height:1.3; color:#f4f5f7; font-weight:700;">
      Hola ${escapeHtml(data.name)}, encontramos una oferta para ti
    </h2>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 20px; background:rgba(255,255,255,0.04); border-radius:12px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 6px; font-size:16px; font-weight:700; color:#f4f5f7;">${escapeHtml(data.jobTitle)}</p>
          <p style="margin:0 0 10px; font-size:13px; line-height:1.6; color:#b6bdc9;">${escapeHtml(data.jobDescription)}</p>
          <p style="margin:0; font-size:13px; font-weight:600; color:#34d399;">Presupuesto: $${data.budgetPerHour.toFixed(2)}/hora</p>
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        <td style="border-radius:999px; background:linear-gradient(120deg,#0ea5e9,#8b5cf6);">
          <a href="${data.dashboardUrl}" style="display:inline-block; padding:14px 28px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:999px;">
            Ver oferta en mi dashboard →
          </a>
        </td>
      </tr>
    </table>
  `;

  const html = renderShell(
    subject,
    body,
    'Recibiste este correo porque activaste las notificaciones de nuevas ofertas en TalentFlow AI. Puedes desactivarlas desde Ajustes → Notificaciones.',
  );
  const text = `Hola ${data.name},\n\nNueva oferta para ti: ${data.jobTitle}\n${data.jobDescription}\nPresupuesto: $${data.budgetPerHour.toFixed(2)}/hora\n\nVer en tu dashboard: ${data.dashboardUrl}\n\n— El equipo de TalentFlow AI`;

  return { subject, html, text };
}

/**
 * Aviso de nuevo mensaje no leído. Se envía al receptor cuando está
 * inactivo en esa conversación, ha pasado el periodo de enfriamiento y
 * sus preferencias lo permiten (Requisito 7.2).
 */
export function renderNewMessageEmail(data: NewMessageEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${escapeHtml(data.senderName)} te ha enviado un mensaje en TalentFlow AI`;

  const body = `
    <p style="margin:0 0 8px; font-size:13px; letter-spacing:0.06em; text-transform:uppercase; color:#7dd3fc; font-weight:600;">
      Nuevo mensaje
    </p>
    <h2 style="margin:0 0 16px; font-size:22px; line-height:1.3; color:#f4f5f7; font-weight:700;">
      Hola ${escapeHtml(data.recipientName)}, tienes un mensaje nuevo
    </h2>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#b6bdc9;">
      <strong style="color:#f4f5f7;">${escapeHtml(data.senderName)}</strong> te ha escrito:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 24px; background:rgba(255,255,255,0.04); border-radius:12px;">
      <tr>
        <td style="padding:16px 18px; font-size:14px; line-height:1.6; color:#b6bdc9; font-style:italic;">
          "${escapeHtml(data.preview)}"
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="border-radius:999px; background:linear-gradient(120deg,#0ea5e9,#8b5cf6);">
          <a href="${data.conversationUrl}" style="display:inline-block; padding:14px 28px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:999px;">
            Ver conversación →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0; font-size:12px; line-height:1.6; color:#5b6472;">
      Puedes desactivar estas notificaciones desde Ajustes → Notificaciones.
    </p>
  `;

  const html = renderShell(
    subject,
    body,
    'Recibiste este correo porque tienes notificaciones de mensajes activas en TalentFlow AI.',
  );
  const text = `Hola ${data.recipientName},\n\n${data.senderName} te ha enviado un mensaje:\n\n"${data.preview}"\n\nVer conversación: ${data.conversationUrl}\n\nPuedes desactivar estas notificaciones desde Ajustes → Notificaciones.\n\n— El equipo de TalentFlow AI`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
