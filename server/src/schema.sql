-- Esquema de base de datos para TalentFlow AI (MySQL 8.0)
-- Ejecutar con: npm run migrate (idempotente: se puede correr varias veces sin error)

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('freelancer', 'voluntario', 'reclutador') NOT NULL DEFAULT 'freelancer',

  -- Verificación de correo
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_token_hash CHAR(64) NULL,
  verification_token_expires DATETIME NULL,

  -- Perfil
  avatar_url VARCHAR(255) NULL,
  bio VARCHAR(500) NULL,

  -- Plan de suscripción
  plan ENUM('libre', 'plus', 'pro') NOT NULL DEFAULT 'libre',

  -- Cambio de correo pendiente
  pending_email VARCHAR(190) NULL,
  pending_email_token_hash CHAR(64) NULL,
  pending_email_expires DATETIME NULL,

  -- Doble autenticación (TOTP)
  totp_secret VARCHAR(64) NULL,
  totp_enabled TINYINT(1) NOT NULL DEFAULT 0,

  -- Preferencias de notificaciones
  notify_new_matches TINYINT(1) NOT NULL DEFAULT 1,
  notify_security TINYINT(1) NOT NULL DEFAULT 1,
  notify_messages_email TINYINT(1) NOT NULL DEFAULT 1,
  notify_messages_phone TINYINT(1) NOT NULL DEFAULT 0,
  phone_number VARCHAR(30) NULL,

  -- Onboarding y datos de perfil
  onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
  profession VARCHAR(120) NULL,
  location VARCHAR(160) NULL,
  interests VARCHAR(300) NULL,

  -- Solo freelancers: tarifa y CV
  rate_type ENUM('hourly', 'project') NULL,
  rate_amount DECIMAL(10,2) NULL,
  cv_url VARCHAR(255) NULL,

  -- Solo voluntarios: disponibilidad
  availability VARCHAR(160) NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Las siguientes ALTER TABLE cubren bases de datos creadas ANTES de añadir
-- estas columnas. Son idempotentes: no fallan si la columna ya existe.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_hash CHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires DATETIME NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan ENUM('libre', 'plus', 'pro') NOT NULL DEFAULT 'libre';
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(190) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_token_hash CHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_expires DATETIME NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_new_matches TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_security TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_messages_email TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_messages_phone TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession VARCHAR(120) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(160) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests VARCHAR(300) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rate_type ENUM('hourly', 'project') NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rate_amount DECIMAL(10,2) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cv_url VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability VARCHAR(160) NULL;

-- Plataformas externas conectadas por el usuario (GitHub, Behance, etc.)
CREATE TABLE IF NOT EXISTS user_platforms (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  platform_name VARCHAR(60) NOT NULL,
  url VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_platforms_user (user_id),
  CONSTRAINT fk_user_platforms_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cuentas bancarias (número cifrado con AES-256-GCM)
CREATE TABLE IF NOT EXISTS bank_accounts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  bank_name VARCHAR(120) NOT NULL,
  holder_name VARCHAR(120) NOT NULL,
  account_number_encrypted TEXT NOT NULL,
  account_last4 CHAR(4) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bank_accounts_user (user_id),
  CONSTRAINT fk_bank_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bitácora de eventos de la cuenta (actividad reciente)
CREATE TABLE IF NOT EXISTS activity_log (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  description VARCHAR(255) NOT NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_log_user_created (user_id, created_at DESC),
  CONSTRAINT fk_activity_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notificaciones dentro de la app (campanita del dashboard)
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(500) NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user_created (user_id, created_at DESC),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ofertas de proyecto publicadas por reclutadores
CREATE TABLE IF NOT EXISTS job_postings (
  id CHAR(36) PRIMARY KEY,
  created_by CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  budget_per_hour DECIMAL(10,2) NOT NULL,
  role_target ENUM('freelancer', 'voluntario', 'reclutador') NOT NULL DEFAULT 'freelancer',
  skills VARCHAR(500) NULL,
  perks VARCHAR(300) NULL,
  updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_job_postings_created (created_at DESC),
  CONSTRAINT fk_job_postings_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS perks VARCHAR(300) NULL;
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS updated_at DATETIME NULL;

-- Postulaciones a ofertas
CREATE TABLE IF NOT EXISTS job_applications (
  id CHAR(36) PRIMARY KEY,
  posting_id CHAR(36) NOT NULL,
  applicant_id CHAR(36) NOT NULL,
  message VARCHAR(500) NULL,
  status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_job_applications_posting (posting_id),
  INDEX idx_job_applications_applicant (applicant_id),
  CONSTRAINT fk_job_applications_posting FOREIGN KEY (posting_id) REFERENCES job_postings(id) ON DELETE CASCADE,
  CONSTRAINT fk_job_applications_applicant FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_job_applications_unique UNIQUE (posting_id, applicant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Responsiva legal de contratación
CREATE TABLE IF NOT EXISTS hiring_agreements (
  id CHAR(36) PRIMARY KEY,
  recruiter_id CHAR(36) NOT NULL,
  freelancer_id CHAR(36) NOT NULL,
  posting_id CHAR(36) NULL,
  agreed_amount DECIMAL(10,2) NOT NULL,
  agreement_text VARCHAR(1000) NOT NULL,
  accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64) NULL,
  INDEX idx_hiring_agreements_recruiter (recruiter_id),
  INDEX idx_hiring_agreements_freelancer (freelancer_id),
  CONSTRAINT fk_hiring_agreements_recruiter FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_hiring_agreements_freelancer FOREIGN KEY (freelancer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_hiring_agreements_posting FOREIGN KEY (posting_id) REFERENCES job_postings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registros de pago/payout asociados a responsivas firmadas.
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  agreement_id CHAR(36) NOT NULL,
  recruiter_id CHAR(36) NOT NULL,
  freelancer_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'MXN',
  provider VARCHAR(30) NOT NULL DEFAULT 'stripe',
  provider_payment_id VARCHAR(120) NULL,
  status ENUM('pending', 'succeeded', 'failed') NOT NULL DEFAULT 'pending',
  destination_bank_name VARCHAR(120) NULL,
  destination_account_last4 CHAR(4) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  INDEX idx_payments_agreement (agreement_id),
  INDEX idx_payments_recruiter (recruiter_id),
  INDEX idx_payments_freelancer (freelancer_id),
  CONSTRAINT fk_payments_agreement FOREIGN KEY (agreement_id) REFERENCES hiring_agreements(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_recruiter FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_freelancer FOREIGN KEY (freelancer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Galería de fotos de presentación y portafolio del usuario.
CREATE TABLE IF NOT EXISTS user_photos (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  photo_url VARCHAR(255) NOT NULL,
  caption VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_photos_user (user_id),
  CONSTRAINT fk_user_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mini-Blog de publicaciones y novedades del usuario.
CREATE TABLE IF NOT EXISTS user_posts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL,
  image_url VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_posts_user (user_id, created_at DESC),
  CONSTRAINT fk_user_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Mensajería directa (sistema nuevo con Socket.IO)
-- ─────────────────────────────────────────────────────────────────────────────

-- Conversaciones (directas o grupales)
-- dm_key = min(user_id) + ':' + max(user_id) garantiza unicidad del par DM
CREATE TABLE IF NOT EXISTS conversations (
  id               CHAR(36)     NOT NULL PRIMARY KEY,
  created_by       CHAR(36)     NOT NULL,
  is_group         TINYINT(1)   NOT NULL DEFAULT 0,
  title            VARCHAR(120) NULL,
  dm_key           CHAR(73)     NULL,
  last_message_at  DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conversations_dm_key (dm_key),
  CONSTRAINT fk_conversations_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Miembros de cada conversación
CREATE TABLE IF NOT EXISTS conversation_members (
  id               CHAR(36)  NOT NULL PRIMARY KEY,
  conversation_id  CHAR(36)  NOT NULL,
  user_id          CHAR(36)  NOT NULL,
  last_read_at     DATETIME  NULL,
  last_email_at    DATETIME  NULL,
  joined_at        DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conversation_members_pair (conversation_id, user_id),
  INDEX idx_conversation_members_user (user_id),
  CONSTRAINT fk_conv_members_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_members_user         FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mensajes individuales dentro de una conversación
CREATE TABLE IF NOT EXISTS messages (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  conversation_id  CHAR(36)      NOT NULL,
  sender_id        CHAR(36)      NOT NULL,
  body             VARCHAR(2000) NOT NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_pagination (conversation_id, created_at DESC, id),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender       FOREIGN KEY (sender_id)       REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migraciones incrementales (seguras para BD ya existentes)
-- ─────────────────────────────────────────────────────────────────────────────

-- payments: columnas añadidas después del esquema inicial
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'MXN';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(30) NOT NULL DEFAULT 'stripe';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(120) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS destination_bank_name VARCHAR(120) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS destination_account_last4 CHAR(4) NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at DATETIME NULL;
