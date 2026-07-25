import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'talentflow_local',
}

// ─── Cifrado de cuentas bancarias ───────────────────────────────────────────
function deriveKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) throw new Error('Falta ENCRYPTION_KEY en el entorno.')
  return crypto.createHash('sha256').update(secret).digest()
}

function encrypt(plainText: string): string {
  const key = deriveKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.')
}

// ─── Seed ────────────────────────────────────────────────────────────────────

export async function runSeed() {
  console.log('🌱 TalentFlow AI — Seed completo v0.2')
  console.log(`📡 ${DB.host}:${DB.port}/${DB.database}`)

  const conn = await mysql.createConnection(DB)

  try {
    const hash = await bcrypt.hash('hackathon123', 10)

    // ── IDs predecibles para referencias cruzadas ──────────────────────────
    const R = crypto.randomUUID
    const ids = {
      recruiter: R(), freelancer1: R(), freelancer2: R(),
      volunteer1: R(), volunteer2: R(),
      posting1: R(), posting2: R(), posting3: R(),
      app1: R(), app2: R(), app3: R(), app4: R(),
      agreement1: R(), bank1: R(), bank2: R(), payment1: R(),
      photo1: R(), photo2: R(), photo3: R(), post1: R(),
    }

    // ── 1. Limpieza total ─────────────────────────────────────────────────
    console.log('🧹 Limpiando tablas...')
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of [
      'chat_messages', 'payments', 'hiring_agreements', 'job_applications',
      'job_postings', 'user_photos', 'user_posts', 'bank_accounts',
      'notifications', 'activity_log', 'user_platforms', 'users',
    ]) {
      await conn.execute(`TRUNCATE TABLE ${table}`)
    }
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1')

    // ── 2. Usuarios ───────────────────────────────────────────────────────
    console.log('👤 Creando usuarios...')

    // Todas las columnas unificadas para los 5 usuarios.
    // Orden: id, name, email, password_hash, role,
    //   plan, profession, location, bio, interests, rate_type, rate_amount,
    //   availability, notify_new_matches, notify_security,
    //   notify_messages_email, notify_messages_phone, phone_number
    const U = (id: string, vals: any[]) =>
      conn.execute(
        `INSERT INTO users (id, name, email, password_hash, role,
          email_verified, onboarding_completed,
          plan, profession, location, bio, interests,
          rate_type, rate_amount, availability,
          notify_new_matches, notify_security,
          notify_messages_email, notify_messages_phone, phone_number)
         VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ...vals],
      )

    // Reclutador (sin rate_type/rate_amount/availability → NULL)
    await U(ids.recruiter, ['InnovateTech Labs', 'reclutador@empresa.com', hash, 'reclutador',
      'pro', 'Startup Tecnológica', 'México',
      'Empresa de desarrollo de productos digitales e IA.', 'IA, startups, innovación',
      null, null, null,
      1, 1, 1, 0, '+52 55 1234 5678'])

    // Freelancer 1 — Carlos Mendoza
    await U(ids.freelancer1, ['Carlos Mendoza', 'freelancer1@dev.com', hash, 'freelancer',
      'plus', 'Desarrollador Fullstack', 'Bolivia',
      '4 años en React, Node.js y MySQL. Especialista en optimización de backends.',
      'React, Node.js, TypeScript, PostgreSQL',
      'hourly', 25.00, null,
      1, 1, 1, 1, '+591 777 12345'])

    // Freelancer 2 — Elena Rostova
    await U(ids.freelancer2, ['Elena Rostova', 'freelancer2@design.com', hash, 'freelancer',
      'plus', 'Diseñadora UX/UI', 'Colombia',
      'Sistemas de diseño responsivos y prototipado ágil en Figma.',
      'Figma, UI kits, design systems, branding',
      'hourly', 30.00, null,
      1, 1, 1, 0, '+57 300 987 6543'])

    // Voluntario 1 — Mateo Ríos
    await U(ids.volunteer1, ['Mateo Ríos', 'voluntario1@ong.com', hash, 'voluntario',
      'libre', 'Estudiante de Sistemas', 'Argentina',
      'Ganando experiencia en proyectos sociales de tecnología.',
      'Python, Django, educación tech',
      null, null, 'Fines de semana (10 hrs/sem)',
      1, 1, 1, 0, null])

    // Voluntario 2 — Sofia Castro
    await U(ids.volunteer2, ['Sofia Castro', 'voluntario2@estudiante.com', hash, 'voluntario',
      'libre', 'Community Manager', 'Chile',
      'Gestión de redes sociales para proyectos comunitarios.',
      'Instagram, TikTok, Canva, copywriting',
      null, null, 'Tardes',
      1, 1, 0, 0, null])

    // ── 3. Ofertas de trabajo ─────────────────────────────────────────────
    console.log('💼 Creando ofertas...')
    const JP = (id: string, title: string, desc: string, budget: number, role: string, skills: string, perks: string | null) =>
      conn.execute(
        `INSERT INTO job_postings (id, created_by, title, description, budget_per_hour, role_target, skills, perks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ids.recruiter, title, desc, budget, role, skills, perks],
      )

    await JP(ids.posting1,
      'Desarrollador Frontend React + Tailwind',
      'Maquetar interfaz principal y dashboard en 2 semanas. Buscamos alguien con experiencia en componentes reutilizables y diseño responsive.',
      35.00, 'freelancer', 'React, Tailwind CSS, TypeScript, Framer Motion', null)

    await JP(ids.posting2,
      'Diseño de Identidad Visual para Campaña Social',
      'Apoyo voluntario para diseñar banners, material de difusión y kit de redes para ONG educativa.',
      0.00, 'voluntario', 'Figma, Ilustración, Branding',
      'Certificado de participación, Alimentación y viáticos cubiertos')

    await JP(ids.posting3,
      'Integración de API y Pasarela de Pagos',
      'Backend dev con experiencia en Node.js y MySQL para conectar pasarela transaccional (Stripe). Proyecto de 3 semanas.',
      40.00, 'freelancer', 'Node.js, Express, MySQL, Stripe, REST APIs', null)

    // ── 4. Postulaciones ──────────────────────────────────────────────────
    console.log('📝 Creando postulaciones...')
    const JA = (id: string, postingId: string, applicantId: string, message: string, status: string) =>
      conn.execute(
        `INSERT INTO job_applications (id, posting_id, applicant_id, message, status) VALUES (?, ?, ?, ?, ?)`,
        [id, postingId, applicantId, message, status],
      )

    // Carlos → React+Tailwind (pending) + API Pagos (accepted)
    await JA(ids.app1, ids.posting1, ids.freelancer1,
      'Tengo 4 años justo con ese stack. Adjunto mi portafolio de dashboards React.', 'pending')
    await JA(ids.app2, ids.posting3, ids.freelancer1,
      'Integré Stripe en 3 proyectos. Puedo empezar de inmediato.', 'accepted')

    // Elena → React+Tailwind (pending) + Campaña Social (rejected)
    await JA(ids.app3, ids.posting1, ids.freelancer2,
      'Soy diseñadora UX/UI con experiencia en design systems. Puedo asegurar consistencia visual.', 'pending')
    await JA(ids.app4, ids.posting2, ids.freelancer2,
      'Me encantaría apoyar esta causa. Tengo experiencia en branding para ONGs.', 'rejected')

    // ── 5. Cuentas bancarias ──────────────────────────────────────────────
    console.log('🏦 Creando cuentas bancarias...')
    await conn.execute(
      `INSERT INTO bank_accounts (id, user_id, bank_name, holder_name, account_number_encrypted, account_last4, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ids.bank1, ids.freelancer1, 'BBVA', 'Carlos Mendoza', encrypt('012345678901234567'), '4567', 1])
    await conn.execute(
      `INSERT INTO bank_accounts (id, user_id, bank_name, holder_name, account_number_encrypted, account_last4, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ids.bank2, ids.freelancer2, 'Bancolombia', 'Elena Rostova', encrypt('987654321098765432'), '5432', 1])

    // ── 6. Responsiva de contratación ─────────────────────────────────────
    console.log('📄 Firmando responsiva...')
    await conn.execute(
      `INSERT INTO hiring_agreements (id, recruiter_id, freelancer_id, posting_id, agreed_amount, agreement_text, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ids.agreement1, ids.recruiter, ids.freelancer1, ids.posting3, 20000.00,
        'InnovateTech Labs se compromete a pagar $20,000 MXN a Carlos Mendoza por la integración de la pasarela de pagos en un plazo máximo de 3 semanas.',
        '127.0.0.1'])

    // ── 7. Pago ───────────────────────────────────────────────────────────
    console.log('💳 Procesando pago...')
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ')
    await conn.execute(
      `INSERT INTO payments (id, agreement_id, recruiter_id, freelancer_id, amount, currency, provider, provider_payment_id, status, destination_bank_name, destination_account_last4, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ids.payment1, ids.agreement1, ids.recruiter, ids.freelancer1,
        20000.00, 'MXN', 'stripe', 'pi_3NqX8kLkd9fH2s', 'succeeded',
        'BBVA', '4567', yesterday])

    // ── 8. Chat ───────────────────────────────────────────────────────────
    console.log('💬 Enviando mensajes...')
    const now = new Date()
    const ago = (m: number) => new Date(now.getTime() - m * 60_000).toISOString().slice(0, 19).replace('T', ' ')
    const CM = (sender: string, receiver: string, msg: string, readAt: string | null, createdAt: string) =>
      conn.execute(
        `INSERT INTO chat_messages (id, sender_id, receiver_id, message, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [R(), sender, receiver, msg, readAt, createdAt],
      )

    // Reclutador ↔ Carlos (conversación activa)
    await CM(ids.recruiter, ids.freelancer1,
      '¡Hola Carlos! Vi tu perfil y tu experiencia con Stripe es justo lo que necesitamos. ¿Cuándo podrías empezar?',
      ago(55), ago(60))
    await CM(ids.freelancer1, ids.recruiter,
      '¡Hola! Gracias por contactarme. Puedo empezar el lunes sin problema. Ya hice integraciones similares con Stripe y MercadoPago.',
      ago(20), ago(30))
    await CM(ids.recruiter, ids.freelancer1,
      'Excelente. Te acabo de enviar la responsiva y el primer pago ya está procesado. ¡Bienvenido al equipo!',
      ago(10), ago(15))
    await CM(ids.freelancer1, ids.recruiter,
      '¡Perfecto! Ya vi el pago reflejado. Empiezo el lunes con el diseño de la arquitectura de la API.',
      null, ago(5))

    // Reclutador ↔ Elena (mensaje pendiente de leer)
    await CM(ids.recruiter, ids.freelancer2,
      'Hola Elena, tu portafolio de UI es impresionante. Aunque para esta oferta de frontend elegimos a otro candidato, me gustaría tenerte en cuenta para el diseño del próximo sprint. ¿Te interesaría?',
      null, ago(2))

    // ── 9. Galería de fotos ───────────────────────────────────────────────
    console.log('🖼️ Creando galería...')
    await conn.execute(
      `INSERT INTO user_photos (id, user_id, photo_url, caption) VALUES (?, ?, ?, ?)`,
      [ids.photo1, ids.freelancer1,
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600',
        'Dashboard de analytics con React y D3.js'])
    await conn.execute(
      `INSERT INTO user_photos (id, user_id, photo_url, caption) VALUES (?, ?, ?, ?)`,
      [ids.photo2, ids.freelancer1,
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600',
        'Integración de pagos con Stripe — Proyecto E-Commerce'])
    await conn.execute(
      `INSERT INTO user_photos (id, user_id, photo_url, caption) VALUES (?, ?, ?, ?)`,
      [ids.photo3, ids.freelancer1,
        'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600',
        'Code review de arquitectura de microservicios'])

    // ── 10. Mini-blog ─────────────────────────────────────────────────────
    console.log('📝 Creando publicación...')
    await conn.execute(
      `INSERT INTO user_posts (id, user_id, title, content, image_url) VALUES (?, ?, ?, ?, ?)`,
      [ids.post1, ids.freelancer1,
        '5 lecciones que aprendí integrando pasarelas de pago en 2026',
        'Después de integrar Stripe, MercadoPago y Conekta en distintos proyectos, estas son las 5 cosas que todo backend dev debería saber:\n\n1. **Siempre usá webhooks para confirmar pagos**, nunca confíes solo en la respuesta del frontend.\n2. **Idempotencia**: cada intento de pago debe tener un idempotency key único.\n3. **Manejo de errores**: el 90% de los fallos vienen de timeouts o declined cards, no de bugs.\n4. **Modo test primero**: todas las pasarelas tienen sandbox. USALO.\n5. **La UX del checkout importa**: 3 campos extras = 20% de abandono.',
        'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600'])

    // ── Resumen ───────────────────────────────────────────────────────────
    console.log('')
    console.log('═══════════════════════════════════════════════════════')
    console.log('🎉 ¡Seed ejecutado exitosamente!')
    console.log('')
    console.log('🔑 Credenciales (todas las cuentas):')
    console.log('   Contraseña: hackathon123')
    console.log('')
    console.log('👤 Usuarios:')
    console.log('   reclutador@empresa.com       — InnovateTech Labs (Pro)')
    console.log('   freelancer1@dev.com           — Carlos Mendoza, Fullstack (Plus)')
    console.log('   freelancer2@design.com        — Elena Rostova, UX/UI (Plus)')
    console.log('   voluntario1@ong.com           — Mateo Ríos, Estudiante (Libre)')
    console.log('   voluntario2@estudiante.com    — Sofia Castro, CM (Libre)')
    console.log('')
    console.log('📊 Datos:')
    console.log('   3 ofertas | 4 postulaciones | 1 contrato | 1 pago Stripe')
    console.log('   5 mensajes (1 conversación activa + 1 sin leer)')
    console.log('   2 cuentas bancarias | 3 fotos portafolio | 1 blog post')
    console.log('═══════════════════════════════════════════════════════')
  } catch (err) {
    console.error('❌ Error:', err)
  } finally {
    await conn.end()
    process.exit(0)
  }
}

runSeed()
