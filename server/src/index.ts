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

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});

const httpServer = http.createServer(app);
initRealtime(httpServer);
httpServer.listen(PORT, () => {
  console.log(`[server] TalentFlow API escuchando en http://localhost:${PORT}`);
});
