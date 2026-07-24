## Qué es

Plataforma que conecta 3 roles (`freelancer` | `voluntario` | `reclutador`) vía un tablero de
ofertas con notificaciones por rol. Freelancers/voluntarios se postulan; reclutadores publican y
contratan firmando una "responsiva de pago" (registra monto, fecha, IP).

## Stack

- **Frontend** (`/`): React 18 + TS + Vite, Tailwind, Framer Motion, React Router 6, lucide-react.
- **Backend** (`/server`): Node ESM + Express 4 + TS, MySQL 8 vía `mysql2` (**sin ORM**), JWT +
  bcryptjs, nodemailer, otplib+qrcode (2FA TOTP), multer, express-rate-limit, dotenv, tsx.

## Arquitectura

```
React SPA (:5173)  →  fetch JSON + Bearer JWT  →  Express API (:4000)
                                                  routes/* → *Store.ts → pool mysql2 → MySQL 8
```

- Front: sesión global en `AuthContext`; **todo acceso al backend pasa por `src/lib/api.ts`**
  (cliente único, tipos, header Authorization desde `localStorage['talentflow_token']`).
- Back por capas: `routes/*` (validación, auth, rate limit, orquestación) → `*Store.ts` (SQL
  parametrizado, mapeo `snake_case`↔`camelCase`). Utilidades: `auth.ts`, `crypto.ts`,
  `mailer.ts`+`emailTemplates.ts`, `db.ts`.

## Layout

- `src/pages/` (Landing, Login, Signup, Verify, VerifyEmailChange, Dashboard, JobBoard, Settings)
- `src/components/{auth,common,dashboard,jobs,onboarding,settings}/` + componentes de landing
- `src/{context,lib,data,types.ts}`
- `server/src/{index.ts,db.ts,auth.ts,crypto.ts,mailer.ts,emailTemplates.ts,migrate.ts,schema.sql,types.ts}`
- `server/src/routes/` y `server/src/*Store.ts` (user, jobPosting, jobApplication, hiringAgreement,
  bankAccount, platform, notification, activity)

## Convenciones (obligatorias)

- Dominio en **español** (UI, errores, roles); identificadores en inglés.
- **ESM + NodeNext**: imports internos del backend usan extensión `.js` aunque el archivo sea `.ts`.
- BD `snake_case` ↔ JS `camelCase`; cada Store tiene `interface XxxRow extends RowDataPacket` y
  `mapRow()`.
- **Nunca exponer campos sensibles**: usar `toPublicUser()` / `toPublicBankAccount()` (`types.ts`).
- **Todo handler async del backend va envuelto en `asyncRoute()`** (Express 4 no captura rechazos).
- **SQL siempre parametrizado**; IDs `CHAR(36)` con `randomUUID()`.
- Estilos: solo Tailwind, tema oscuro (`bg-ink-*`, `text-accent-*`, `border-white/10`,
  `bg-white/[0.03]`, `rounded-2xl`). Tokens en `tailwind.config.js`. Iconos: `lucide-react`.
- Validar en servidor; mensajes de error al usuario en español; rate limit en endpoints sensibles.

## Auth y autorización

- Registro → **verificación de correo obligatoria** (token: se guarda hash SHA-256, TTL 24h); el
  JWT (TTL 7d, payload `{sub,email}`) se emite **al verificar**, no al registrar.
- Login: bcrypt; si no verificado → 403 `emailNotVerified`; si 2FA activo → `pendingToken` (5 min)
  y luego `POST /api/auth/verify-login` con código TOTP.
- `requireAuth` (en `auth.ts`) exige `Authorization: Bearer` y adjunta `req.auth`.
- Autorización **por rol y por propiedad**, dentro de cada handler (no hay middleware de roles):
  reclutadores no se postulan; solo el dueño ve/gestiona postulantes; solo reclutadores contratan;
  recursos propios filtran por `user_id = req.auth.sub`.

## Notificaciones y correos

- Notificaciones in-app (tabla `notifications`, tipos `new_match|security|system`) vía
  `createNotification()`; el `NotificationsBell` (DashboardLayout) hace polling cada 30s.
- Correo con nodemailer (`mailer.ts`): usa SMTP si hay credenciales, si no cae a **Ethereal**
  (preview en consola). Correos: verificación, cambio de correo, alerta de seguridad, oferta
  compatible. Los fallos de correo nunca cancelan la operación principal.

## Base de datos

- MySQL 8 InnoDB. Esquema idempotente en `server/src/schema.sql`; aplicar con `npm run migrate`.
- Tablas: `users`, `user_platforms` (máx 8), `bank_accounts` (número cifrado AES-256-GCM, máx 5),
  `activity_log`, `notifications`, `job_postings`, `job_applications` (UNIQUE posting+applicant),
  `hiring_agreements`. FKs `ON DELETE CASCADE` (salvo `hiring_agreements.posting_id` → SET NULL).
- `server/data/users.json` NO es fuente de datos; la fuente es MySQL.

## APIs (base `VITE_API_URL`, default `:4000`). Detalle y tipos en `src/lib/api.ts`.

- `/api/auth`: signup, verify, resend-verification, login, verify-login, me
- `/api/profile`: avatar, profile, password, email/request-change, email/confirm-change,
  notifications/prefs, role-details, platforms, cv
- `/api/2fa`: setup, enable, disable
- `/api/bank-accounts`, `/api/activity`, `/api/notifications`, `/api/job-postings` (apply,
  applications, my-applications, my-agreements, hire)

## Cómo extender

- **Nuevo módulo/entidad**: tabla en `schema.sql` → tipo + `toPublicX()` en `types.ts` → `xStore.ts`
  → `routes/x.ts` (con `asyncRoute`, `requireAuth`, validación, rate limit, autorización) → montar
  en `index.ts` → funciones en `src/lib/api.ts` → UI.
- **Nueva pantalla**: página en `src/pages/`, ruta en `App.tsx` (envolver en `ProtectedRoute` si es
  privada), dentro de `DashboardLayout` si es del dashboard; item de menú en `getNavItems()`;
  datos vía `src/lib/api.ts` y `useAuth()`.
- **Nuevo endpoint**: handler en el router adecuado siguiendo el patrón anterior; registrar
  eventos con `logActivity()`.
- **Migraciones**: no hay sistema versionado ni rollback. Editar `schema.sql` de forma idempotente
  y correr `npm run migrate` (ignora errores de "ya existe").

## NO tocar- `docker-compose.yml`: MySQL 8 local.

- `.env` (raíz y server): credenciales reales, en `.gitignore`; no versionar ni imprimir valores.
- `ENCRYPTION_KEY` (cambiarla vuelve ilegibles las cuentas bancarias) y el formato de empaquetado
  de `crypto.ts` (`iv.authTag.ciphertext` base64).
- `JWT_SECRET` (invalida sesiones).
- Extensión `.js` en imports del backend (NodeNext).
- `server/src/uploads/` (archivos de usuarios).

## Variables de entorno

- Front `/.env`: `VITE_API_URL`.
- Server `/server/.env`: `PORT`, `JWT_SECRET`, `CLIENT_URL`, `ENCRYPTION_KEY`,
  `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SSL`,
  `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM` (vacías → Ethereal).

## Scripts

- Front: `npm run dev` (:5173), `build`, `preview`, `lint`.
- Server: `npm run dev` (:4000, tsx watch), `build`, `start`, `migrate`.
