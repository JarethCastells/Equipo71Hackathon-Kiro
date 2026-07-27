# TalentFlow AI — Product Requirements Document

> **Plataforma de emparejamiento laboral con inteligencia artificial**  
> Hackathon — Julio 2026

---

## 1. Visión

Conectar tres tipos de talento — **freelancers**, **voluntarios** y **reclutadores** — en un solo tablero inteligente donde las oportunidades encuentran a las personas correctas mediante IA, transparencia contractual y comunicación directa.

---

## 2. Usuarios

| Rol | Necesidad principal |
|---|---|
| **Freelancer** | Mostrar portafolio, recibir pagos, negociar tarifas |
| **Voluntario** | Encontrar causas, acumular experiencia, certificaciones |
| **Reclutador** | Publicar ofertas, rankear candidatos con IA, contratar con responsiva firmada |

---

## 3. Funcionalidades Core

### 3.1 Autenticación y Seguridad
- Registro con verificación de correo obligatoria (token SHA-256, TTL 24h)
- Login con JWT (TTL 7d) + bcrypt
- 2FA opcional vía TOTP (otplib + qrcode)
- Cifrado AES-256-GCM para cuentas bancarias en reposo
- Rate limiting en endpoints sensibles (login, 2FA, checkout, IA)
- Rotación de secretos (`JWT_SECRET`, `ENCRYPTION_KEY`)

### 3.2 Dashboard por Rol
- **Reclutador**: ofertas publicadas, contratos activos, pagos procesados, estadísticas
- **Freelancer**: postulaciones enviadas, contratos firmados, pagos recibidos, tarifa configurable (por hora/proyecto)
- **Voluntario**: oportunidades disponibles, disponibilidad horaria

### 3.3 Job Board
- Publicación de ofertas con presupuesto, skills requeridos, perks y rol destino
- Postulación con mensaje personalizado
- Edición y eliminación de ofertas propias
- Filtros por rol, skills y presupuesto
- Búsqueda global con autocompletado

### 3.4 AI Matching (Gemini)
- Scoring inteligente de candidatos por compatibilidad (0-100%)
- Análisis contextual: skills, bio, disponibilidad, presupuesto
- Fallback heurístico sin API key (keyword matching + stopwords ES/EN)
- Chat IA para reclutadores: preguntas sobre candidatos en lenguaje natural
- Cadena de modelos con reintento automático

### 3.5 Responsiva de Pago
- Firma digital de compromiso (IP + timestamp)
- Registro de monto acordado
- Checkout multi-proveedor (Stripe, MercadoPago, Conekta)
  - Contratación: simulado (reemplazar por Stripe Connect post-hackathon)
  - Upgrade de plan: **Stripe real** (`stripe.paymentIntents.create()`, $10 MXN)
- Destino de pago: cuenta bancaria cifrada del freelancer
- Notificación in-app y correo

### 3.6 Mensajería Directa
- Chat en tiempo real con Socket.IO
- Conversaciones individuales entre reclutador y talento
- Indicadores de lectura
- AI Copilot: análisis de conversación y sugerencias estratégicas con Gemini
- Preferencias de notificación (email, teléfono)

### 3.7 Perfil Profesional
- Datos personales, bio, skills, ubicación
- Galería de portafolio (user_photos)
- Mini-blog de publicaciones (user_posts)
- Plataformas externas: GitHub, Behance, Canva, web personal
- CV público con datos consolidados

### 3.8 Onboarding
- Modal de primer inicio con campos específicos por rol
- Selección de país, ciudad, intereses
- Configuración de tarifa (freelancer) o disponibilidad (voluntario)

### 3.9 Notificaciones
- In-app: campanita con polling cada 30s
- Correo transaccional: verificación, cambio de email, alertas de seguridad, nuevo mensaje, pago recibido
- SMTP con fallback a Ethereal para desarrollo

### 3.10 Planes de Suscripción
- Tres tiers: Libre, Plus, Pro
- Control de acceso a consultas Gemini por plan
- UI de upgrade con checkout simulado

---

## 4. Stack Técnico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 18 + TypeScript, Vite 5, Tailwind CSS, Framer Motion, React Router 6, Lucide React |
| **Backend** | Node.js + Express 4 + TypeScript (ESM), Socket.IO |
| **Base de datos** | MySQL 8 / MariaDB (mysql2 sin ORM) |
| **IA** | Google Gemini (generative-ai SDK) |
| **Auth** | JWT + bcryptjs + otplib (2FA TOTP) |
| **Correo** | Nodemailer (SMTP + Ethereal fallback) |
| **Despliegue** | Railway (backend + frontend monoplataforma) |
| **Testing** | Vitest, Supertest (backend), Playwright (E2E) |

---

## 5. Base de Datos

### Tablas principales (12)
`users`, `bank_accounts`, `user_platforms`, `user_photos`, `user_posts`, `job_postings`, `job_applications`, `hiring_agreements`, `payments`, `conversations`, `messages`, `conversation_members`

### Principios
- IDs `CHAR(36)` con `randomUUID()`
- SQL siempre parametrizado
- `snake_case` ↔ `camelCase` vía `mapRow()`
- Cifrado en reposo para datos sensibles (cuentas bancarias)
- Migraciones idempotentes (`CREATE IF NOT EXISTS` + `ALTER ADD COLUMN IF NOT EXISTS`)

---

## 6. API Endpoints

| Módulo | Endpoints |
|---|---|
| **Auth** | signup, verify, resend-verification, login, verify-login, me |
| **Profile** | avatar, profile, password, email/change, notifications/prefs, role-details, platforms, cv |
| **2FA** | setup, enable, disable |
| **Bank Accounts** | CRUD (máx 5 por usuario, número cifrado) |
| **Job Postings** | CRUD + apply, applications, my-applications, my-agreements, hire, ranked-applicants, ask-ai, global-search |
| **Payments** | checkout |
| **Messages** | conversations (legacy + WebSocket), send, thread, analyze-ai, notification-settings |
| **Activity** | list (bitácora de eventos) |
| **Notifications** | list, mark-read, mark-all-read |

---

## 7. Seguridad

- JWT con expiración de 7 días
- Contraseñas hasheadas con bcrypt (10 rondas)
- 2FA TOTP opcional
- Rate limiting granular por endpoint
- Cifrado AES-256-GCM para cuentas bancarias
- SQL parametrizado (sin inyección)
- Validación en servidor de todos los inputs
- `trust proxy` configurado para producción
- Rotación de secretos antes de producción

---

## 8. No Funcional

- **Idioma**: UI en español, identificadores en inglés
- **Tema**: dark mode (`ink-950`, `accent-*`, `violet-*`)
- **Responsive**: móvil, tablet, desktop
- **Accesibilidad**: labels, roles ARIA, focus states, contraste
- **Rendimiento**: lazy loading de páginas, chunks < 500 KB
- **Disponibilidad**: Railway con health checks

---

## 9. Próximos Pasos (post-hackathon)

- [ ] Migrar BD a Railway MySQL (eliminar dependencia de IPs de Neubox)
- [ ] Integrar pasarela de pagos real (Stripe Connect)
- [ ] Mejorar AI matching con embeddings de skills
- [ ] Mensajería grupal y canales por proyecto
- [ ] Panel de administración
- [ ] CI/CD con GitHub Actions
- [ ] Monorepo con tipos compartidos (`@talentflow/types`)

---

## 10. Equipo

| Persona | Responsabilidad |
|---|---|
| **1** | Mensajería directa (backend + frontend, Socket.IO) |
| **2** | Matching con IA real (Gemini, scoring) |
| **3** | Pagos reales (Stripe/MercadoPago/Conekta) |
| **4** | QA, pruebas automatizadas, hardening de seguridad |
| **5** | Pulido UX/UI, deploy, presentación, PRD |

---

> **Versión**: 0.2 — Julio 2026  
> **Repositorio**: `JarethCastells/Equipo71Hackathon-Kiro`  
> **Producción**: `https://talentflow-api-production.up.railway.app`
