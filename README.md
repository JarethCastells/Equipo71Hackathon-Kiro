# TalentFlow AI

Proyecto para el Hackathon Kiro — Equipo 71.

TalentFlow AI es una plataforma que conecta **freelancers**, **voluntarios** y **reclutadores**
mediante emparejamiento inteligente por presupuesto, perfil y disponibilidad. Cada rol tiene una
experiencia y un conjunto de opciones distintos dentro de la misma aplicación:

- **Freelancers**: crean un perfil profesional (profesión, ubicación, tarifa por hora o por
  proyecto, CV, plataformas externas como GitHub/Behance/Canva/sitio web), se postulan a ofertas,
  reciben notificaciones de nuevas ofertas compatibles y administran sus cuentas bancarias para
  recibir pagos.
- **Voluntarios**: declaran su disponibilidad y áreas de interés, y pueden postularse a cualquier
  oferta (incluidas las dirigidas a freelancers) como personal adicional para ganar experiencia.
  Los reclutadores pueden ofrecer incentivos no monetarios (comida, pasajes, hospedaje) para hacer
  más atractiva una vacante de voluntariado.
- **Reclutadores**: publican ofertas con presupuesto o incentivos, revisan postulantes, y al
  contratar a un freelancer deben aceptar una **responsiva de pago** (ventana emergente) donde se
  comprometen a pagar en tiempo y forma; esa aceptación queda registrada con fecha, monto e IP.

## Estado del proyecto

El proyecto está en desarrollo activo para el hackathon. Hasta ahora se completó:

- ✅ Landing page pública con animación de fondo y feed de candidatos de ejemplo.
- ✅ Registro con verificación de correo obligatoria y login (incluye 2FA opcional).
- ✅ Envío de correos reales vía SMTP (bienvenida, cambio de correo, alertas de seguridad, avisos
  de ofertas), con fallback automático a Ethereal en desarrollo.
- ✅ Base de datos MySQL real conectada y migrada (hospedada en Neubox).
- ✅ Dashboard y menú de Ajustes completamente diferenciados por rol (freelancer / voluntario /
  reclutador), cada uno con sus propios campos, estadísticas y acciones.
- ✅ Perfil profesional por rol: profesión, ubicación (con selector de país), tarifa, CV,
  plataformas externas conectables (GitHub, Behance, Canva, sitio web, etc.), disponibilidad
  (voluntarios).
- ✅ Cuentas bancarias cifradas en reposo para freelancers.
- ✅ Tablero de ofertas: publicación, postulación, revisión de postulantes y contratación con
  responsiva de pago firmada (queda registrada con monto, fecha e IP).
- ✅ Protecciones de seguridad: rate limiting anti-abuso, contraseñas con bcrypt, JWT, control de
  acceso por rol en endpoints sensibles (por ejemplo, un reclutador no puede postularse a
  ofertas).

Pendiente / por definir:

- ⏳ Sistema de mensajería directa entre usuarios (la sección "Mensajes" existe en el menú pero
  aún no tiene funcionalidad).
- ⏳ Pagos reales integrados con un proveedor (por ahora la responsiva es solo un registro de
  compromiso dentro de la plataforma, no procesa pagos).
- ⏳ Matching automático con IA real entre ofertas y perfiles (hoy el filtrado es por rol,
  presupuesto y coincidencias explícitas, sin un modelo de IA todavía).
- ⏳ Pruebas automatizadas (unitarias/e2e). La verificación hasta ahora se ha hecho de forma
  manual contra la base de datos real.

## Funcionalidades principales

- **Landing page** con animación de fondo, storytelling del producto y feed de candidatos con
  filtro por presupuesto.
- **Autenticación completa**: registro con verificación de correo obligatoria (evita cuentas
  falsas/spam), inicio de sesión, y verificación en dos pasos (2FA) opcional vía app tipo Google
  Authenticator.
- **Correo transaccional real** vía SMTP (Nodemailer) con plantillas HTML para bienvenida,
  cambio de correo, alertas de seguridad y avisos de nuevas ofertas compatibles. En desarrollo,
  sin credenciales SMTP configuradas, cae automáticamente a una cuenta de prueba Ethereal con
  vista previa del correo.
- **Dashboard diferenciado por rol**: cada rol ve estadísticas, secciones y acciones relevantes
  únicamente para su tipo de cuenta (un reclutador nunca ve la opción de postularse; un voluntario
  nunca ve campos de tarifa).
- **Ajustes de cuenta**: foto de perfil, biografía, cambio de contraseña y correo (con
  confirmación por enlace), activación de 2FA, cuentas bancarias (cifradas en reposo con
  AES-256-GCM), preferencias de notificaciones y bitácora de actividad de la cuenta.
- **Tablero de ofertas**: publicación, postulación, revisión de postulantes y contratación con
  responsiva firmada.
- **Seguridad**: rate limiting por IP en endpoints sensibles (registro, login, verificación,
  postulaciones, contrataciones) para mitigar abuso/DDoS, contraseñas con bcrypt, JWT para
  sesiones, y datos bancarios cifrados en la base de datos.

## Stack tecnológico

**Frontend** (`/`)

- React 18 + TypeScript + Vite
- Tailwind CSS
- Framer Motion (animaciones)
- React Router

**Backend** (`/server`)

- Node.js + Express + TypeScript
- MySQL (mysql2) — hospedado en Neubox
- JWT (jsonwebtoken) + bcryptjs para autenticación
- Nodemailer para correo transaccional
- otplib + qrcode para verificación en dos pasos (TOTP)
- multer para subida de archivos (avatar, CV)
- express-rate-limit para protección anti-abuso

## Estructura del proyecto

```
├── src/                    # Frontend (React + Vite)
│   ├── components/         # Componentes de UI organizados por área (auth, dashboard, settings, jobs, onboarding)
│   ├── context/            # AuthContext (sesión, token, usuario actual)
│   ├── data/                # Datos estáticos (países, candidatos de ejemplo)
│   ├── lib/                 # Cliente de la API del backend
│   └── pages/                # Páginas/rutas de la aplicación
└── server/                 # Backend (Express + TypeScript)
    ├── src/
    │   ├── routes/          # Endpoints de la API (auth, perfil, 2FA, ofertas, notificaciones, etc.)
    │   ├── *Store.ts         # Acceso a datos por entidad (usuarios, ofertas, notificaciones, etc.)
    │   ├── schema.sql        # Esquema de base de datos (idempotente)
    │   └── migrate.ts        # Script para aplicar el esquema a la base de datos
    └── uploads/              # Archivos subidos por usuarios (avatares, CVs) — no versionado
```

## Cómo ejecutar el proyecto

### Requisitos

- Node.js 18+
- Una base de datos MySQL accesible

### 1. Backend

```bash
cd server
npm install
cp .env.example .env   # completa las variables (ver más abajo)
npm run migrate        # crea/actualiza las tablas necesarias
npm run dev            # levanta la API en http://localhost:4000
```

Variables de entorno relevantes (`server/.env`):

| Variable                                                            | Descripción                                                                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PORT`                                                              | Puerto de la API (por defecto 4000)                                                                                                                                      |
| `JWT_SECRET`                                                        | Secreto para firmar sesiones (JWT)                                                                                                                                       |
| `CLIENT_URL`                                                        | URL del frontend, usada en enlaces de correo y CORS                                                                                                                      |
| `ENCRYPTION_KEY`                                                    | Clave para cifrar datos bancarios en reposo (AES-256-GCM)                                                                                                                |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`       | Conexión a MySQL                                                                                                                                                         |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Proveedor SMTP para correo real. Si se dejan vacías, se usa una cuenta de prueba Ethereal automáticamente (no envía correos reales, pero genera un link de vista previa) |

### 2. Frontend

```bash
npm install
npm run dev             # levanta la app en http://localhost:5173
```

Variable de entorno del frontend (`.env` en la raíz):

| Variable       | Descripción                                                |
| -------------- | ---------------------------------------------------------- |
| `VITE_API_URL` | URL base del backend (por defecto `http://localhost:4000`) |

## Usuarios de demostración

Al correr `npm run migrate` se insertan tres usuarios listos para usar, uno por cada rol. Todos comparten la misma contraseña:

| Nombre            | Email                        | Contraseña | Rol        |
| ----------------- | ---------------------------- | ---------- | ---------- |
| Ana Freelancer    | `ana.freelancer@demo.com`    | `12345678` | freelancer |
| Carlos Voluntario | `carlos.voluntario@demo.com` | `12345678` | voluntario |
| María Reclutadora | `maria.reclutadora@demo.com` | `12345678` | reclutador |

Todos tienen el correo verificado y el onboarding completado, por lo que puedes iniciar sesión directamente sin pasos adicionales.

> El seed es idempotente: si los usuarios ya existen en la BD, el script los omite sin error. Puedes correr `npm run migrate` cuantas veces quieras.

## Notas de seguridad

- Nunca subas los archivos `.env` (ya están excluidos vía `.gitignore`); contienen credenciales
  reales de base de datos, SMTP y las claves de firma/cifrado.
- Los números de cuenta bancaria se almacenan cifrados; solo se expone públicamente el último
  fragmento de 4 dígitos.
- Antes de un despliegue real en producción: rota todos los secretos usados durante el
  desarrollo, configura HTTPS, y revisa los límites de `express-rate-limit` según el tráfico
  esperado.
