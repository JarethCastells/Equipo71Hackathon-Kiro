import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import pool from './db.js';

/**
 * Seed de usuarios de demostración — uno por cada rol.
 *
 * Credenciales de acceso (todos los usuarios):
 *   Contraseña: Demo1234!
 *
 * Usuarios:
 *   ana.freelancer@demo.com    → rol: freelancer
 *   carlos.voluntario@demo.com → rol: voluntario
 *   maria.reclutadora@demo.com → rol: reclutador
 *
 * Idempotente: omite usuarios cuyo correo ya exista en la BD.
 */

interface SeedUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'freelancer' | 'voluntario' | 'reclutador';
  bio: string;
  profession: string;
  location: string;
  interests: string;
  rateType?: 'hourly' | 'project';
  rateAmount?: number;
  availability?: string;
}

const password = '12345678';
const SEED_USERS: SeedUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Ana Freelancer',
    email: 'ana.freelancer@demo.com',
    password: password,
    role: 'freelancer',
    bio: 'Desarrolladora frontend con 5 años de experiencia en React y TypeScript.',
    profession: 'Desarrolladora Frontend',
    location: 'Ciudad de México, México',
    interests: 'React, TypeScript, UI/UX, Diseño web',
    rateType: 'hourly',
    rateAmount: 35.0,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Carlos Voluntario',
    email: 'carlos.voluntario@demo.com',
    password: password,
    role: 'voluntario',
    bio: 'Apasionado por causas sociales y el impacto comunitario a través de la tecnología.',
    profession: 'Diseñador UX',
    location: 'Guadalajara, México',
    interests: 'Diseño, Educación, Medio ambiente, Comunidades',
    availability: 'Fines de semana y tardes entre semana',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'María Reclutadora',
    email: 'maria.reclutadora@demo.com',
    password: password,
    role: 'reclutador',
    bio: 'Talent acquisition specialist con enfoque en equipos de tecnología y startups.',
    profession: 'Talent Acquisition Specialist',
    location: 'Monterrey, México',
    interests: 'Recursos humanos, Startups, Tecnología, Innovación',
  },
];

export async function runSeed(): Promise<void> {
  console.log('[seed] Iniciando seed de usuarios de demostración...');

  for (const user of SEED_USERS) {
    // Verificar si ya existe por correo (idempotencia)
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [
      user.email,
    ]);

    if (rows.length > 0) {
      console.log(`[seed] Ya existe, omitiendo: ${user.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 10);

    await pool.query(
      `INSERT INTO users (
        id, name, email, password_hash, role,
        email_verified,
        bio, profession, location, interests,
        rate_type, rate_amount,
        availability,
        onboarding_completed,
        created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        user.id,
        user.name,
        user.email,
        passwordHash,
        user.role,
        user.bio,
        user.profession,
        user.location,
        user.interests,
        user.rateType ?? null,
        user.rateAmount ?? null,
        user.availability ?? null,
      ],
    );

    console.log(`[seed] ✓ ${user.name} (${user.role}) — ${user.email}`);
  }

  console.log('[seed] Seed completado.');
}
