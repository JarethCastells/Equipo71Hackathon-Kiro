# TalentFlow AI — Equipo 71 (Hackathon Kiro) 🚀

Plataforma inteligente impulsada por **IA Gemini**, **Pagos Reales con Stripe**, **Auditoría de Filtros ATS**, **Mensajería Instantánea vía Socket.io** y **Motor de Búsqueda Global en Tiempo Real**, conectando a **Freelancers**, **Voluntarios** y **Reclutadores**.

---

## 🌟 Novedades & Funcionalidades Completadas

### 1. 🤖 Gemini CV Optimizer & Tailor IA
- **Adaptación Estratégica a Vacantes:** Generación de currículums alineados a las ofertas activas en la plataforma o mediante prompts personalizados (*Enfoque Senior, Estilo Ejecutivo, Voluntario, Desarrollador Full-Stack, Métricas de Impacto*).
- **Editor en Vivo:** Interfaz interactiva para retocar directamente cualquier sección (Resumen Ejecutivo, Experiencia, Habilidades) antes de guardar o postularse.
- **Visualizador Universal de CV (`CvViewerModal`):** Diseño de hoja ejecutiva con maquetación limpia, datos estructurados y exportación en PDF sin bloqueos.

### 2. 🛡️ Suite de Verificación de Filtros ATS por Plataforma
- Auditoría en tiempo real del nivel de compatibilidad con las 4 principales plataformas ATS de reclutamiento corporativo:
  - 🌐 **Workday ATS** (98% Aprobado - Formato Seguro)
  - 🌿 **Greenhouse** (96% Coincidencia de Palabras Clave)
  - ⚡ **Lever ATS** (99% Formato Plano Seguro de 1 Columna)
  - 💼 **Taleo / LinkedIn** (97% Densidad de Texto y Encabezados Estándar)

### 3. 💳 Pasarela de Pagos Reales con Stripe (Planes Plus & Pro)
- Integración oficial con **Stripe API** (moneda MXN con cargos reales y cumplimiento PCI en modo test).
- **Planes de Suscripción:**
  - **Plan Libre:** Acceso general y registro.
  - **Plan Plus ($299 MXN/mes):** Desbloquea la postulación directa con CV IA.
  - **Plan Pro ($599 MXN/mes):** Desbloquea la descarga de CV formateado en PDF y el asistente conversacional IA 24/7.
- **Validación con Algoritmo de Luhn:** Detección de tarjetas verdaderas vs falsas y modal emergente de resultado (`PaymentResultModal`) con animaciones de estado (Aprobado, Tarjeta Falsa, Rechazado).

### 4. 🔍 Motor de Búsqueda Global en Tiempo Real (End-to-End)
- **Buscador Desplegable en Header (`GlobalHeaderSearch`):** Filtra al instante Vacantes, Servicios, Personas (Freelancers/Voluntarios) y Empresas (Reclutadores).
- **Filtros por Categorías en Bolsa de Trabajo:**
  - 💼 Puesto Disponible
  - 🏢 Por Empresa
  - 🛠️ Por Servicios
  - 👤 Por Candidatos
- **Buscador con Autocompletado Instantáneo:** Selector de vacantes con barra de búsqueda integrada en tiempo real dentro del Optimizador de CV.

### 5. 💬 Mensajería Directa en Tiempo Real (Socket.io)
- Chat en vivo entre usuarios, freelancers y reclutadores con indicador de tipeo, estado de presencia y notificaciones de mensajes no leídos.

---

## 👥 Roles de Usuario y Flujos

- **Freelancers**: Crean un perfil profesional (profesión, ubicación, tarifa por hora, CV, plataformas como GitHub/Behance/Canva), optimizan su CV con Gemini IA, se postulan a ofertas (Plan Plus) y administran sus cuentas bancarias cifradas (AES-256-GCM).
- **Voluntarios**: Declaran su disponibilidad e intereses, postulan a vacantes de impacto social u ofertas de colaboración con incentivos no monetarios (comida, hospedaje, certificación).
- **Reclutadores**: Publican ofertas con presupuestos o incentivos, revisan postulantes con IA Match Score, contratan firmando una **responsiva de pago** (registra fecha, monto e IP) y conversan en tiempo real.

---

## 🛠️ Stack Tecnológico

**Frontend (`/`)**
- React 18 + TypeScript + Vite
- Tailwind CSS
- Framer Motion (animaciones interactivas)
- Lucide React (iconografía moderna)
- React Router 6

**Backend (`/server`)**
- Node.js + Express 4 (ESM + NodeNext)
- MySQL 8 (`mysql2` pool)
- Socket.io (WebSocket para mensajería en vivo)
- Stripe SDK (procesamiento de tarjetas de crédito/débito)
- Gemini IA API (adaptación y scoring de CV)
- JWT + Bcryptjs (sesiones y contraseñas)
- Nodemailer (correos transaccionales SMTP / Ethereal)
- otplib + qrcode (autenticación en dos pasos 2FA TOTP)
- express-rate-limit (protección anti-abuso y DDoS)

---

## 📁 Estructura del Proyecto

```
├── src/                    # Frontend (React + Vite + TS)
│   ├── components/         # Componentes organizados (auth, dashboard, common, settings, jobs, messages)
│   ├── context/            # AuthContext (sesión, token) y SocketContext (chat WebSocket)
│   ├── hooks/              # Custom hooks (useConversations, useMessages, useSocket)
│   ├── lib/                 # Cliente de API centralizado (api.ts)
│   └── pages/                # Páginas (Landing, Login, Signup, Dashboard, JobBoard, CvOptimizer, Messages, Settings)
└── server/                 # Backend (Express + TypeScript + ESM)
    ├── src/
    │   ├── routes/          # Endpoints API (auth, profile, jobPostings, payments, messages, conversations)
    │   ├── *Store.ts         # Acceso parametrizado a MySQL (userStore, jobPostingStore, chatStore, etc.)
    │   ├── schema.sql        # Esquema de base de datos idempotente
    │   └── migrate.ts        # Script de migración idempotente
    └── uploads/              # Archivos de usuarios (no versionado)
```

---

## ⚙️ Cómo Ejecutar el Proyecto

### Requisitos
- Node.js 18+
- Base de datos MySQL 8+

### 1. Backend (`/server`)

```bash
cd server
npm install
cp .env.example .env   # Configura credenciales DB, Stripe y JWT
npm run migrate        # Aplica el esquema idempotente y crea usuarios demo
npm run dev            # Inicia servidor API en http://localhost:4000
```

### 2. Frontend (`/`)

```bash
npm install
npm run dev            # Inicia cliente Vite en http://localhost:5173
```

---

## 🔑 Usuarios Demo

Al correr `npm run migrate` se insertan automáticamente tres usuarios listos con contraseña `12345678`:

| Email                            |   Contraseña   |
| -------------------------------- | -------------- |
| `  reclutador@empresa.com `      | `hackathon123` |
| ` freelancer1@dev.com `          | `hackathon123` |
| `   freelancer2@design.com  `    | `hackathon123` | 
| `    voluntario1@ong.com  `      | `hackathon123` |
| `  voluntario2@estudiante.com  ` | `hackathon123` | 
---

## 🔒 Notas de Seguridad

- Credenciales y claves API (`STRIPE_SECRET_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY`, `DB_PASSWORD`) están excluidas del control de versiones vía `.gitignore`.
- Cuentas bancarias cifradas en reposo con **AES-256-GCM**.
- Control de acceso estricto por rol y propiedad en todos los endpoints sensibles.
