import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { existsSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initRealtime } from './realtime.js';
import activityRoutes from './routes/activity.js';
import authRoutes from './routes/auth.js';
import bankAccountRoutes from './routes/bankAccounts.js';
import conversationRoutes from './routes/conversations.js';
import jobPostingRoutes from './routes/jobPostings.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import paymentRoutes from './routes/payments.js';
import profileRoutes from './routes/profile.js';
import twoFactorRoutes from './routes/twoFactor.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'avatars');
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * "trust proxy" le dice a Express que confíe en el header X-Forwarded-For
 * para calcular req.ip. Es necesario cuando el servidor corre detrás de un
 * proxy/load balancer real (Railway, Render, Vercel, nginx, Cloudflare...),
 * porque sin esto req.ip siempre sería la IP interna del proxy, NO la del
 * visitante real. Eso rompe silenciosamente dos cosas que dependen de
 * req.ip: el rate limiting por IP (express-rate-limit) y la IP registrada
 * en hiring_agreements/activity_log para trazabilidad.
 *
 * OJO: activarlo a ciegas (`app.set('trust proxy', true)`) cuando NO hay un
 * proxy real delante es igual de peligroso, porque X-Forwarded-For es un
 * header que cualquier cliente puede falsificar directamente — un atacante
 * podría poner un valor arbitrario y saltarse el rate limiting por IP.
 *
 * Por eso el número de "hops" de proxy confiables se configura de forma
 * explícita vía TRUST_PROXY (ej. "1" para un solo proxy como Railway/Render,
 * "2" si hay CDN + load balancer encadenados). Por defecto se asume que NO
 * hay proxy (0 = no confiar en X-Forwarded-For), que es lo seguro para
 * correr localmente o con acceso directo a internet.
 */
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY ?? 0);
if (TRUST_PROXY_HOPS > 0) {
  app.set('trust proxy', TRUST_PROXY_HOPS);
}

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/job-postings', jobPostingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware de errores centralizado: evita que un fallo async no controlado
// (p. ej. la conexión a MySQL caída) tumbe todo el proceso del servidor.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[server] Error no controlado:', err);

    const code = (err as { code?: string })?.code;
    const isDbUnavailable =
      code === 'ECONNREFUSED' ||
      code === 'PROTOCOL_CONNECTION_LOST' ||
      code === 'ER_ACCESS_DENIED_ERROR';

    res.status(500).json({
      error: isDbUnavailable
        ? 'No se pudo conectar con la base de datos. Verifica la configuración de conexión (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME) y, si el servidor corre fuera del hosting, que la IP esté autorizada en Remote MySQL.'
        : 'Ocurrió un error inesperado en el servidor.',
    });
  },
);

// SPA fallback: cualquier ruta que no sea /api/ sirve index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
})

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});

const httpServer = http.createServer(app);
initRealtime(httpServer);
httpServer.listen(PORT, () => {
  console.log(`[server] TalentFlow API escuchando en http://localhost:${PORT}`);
});
