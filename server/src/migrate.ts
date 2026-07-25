import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RETRY_ATTEMPTS = 20;
const RETRY_DELAY_MS = 3000;

/**
 * Espera a que MySQL esté listo para aceptar conexiones.
 * Reintenta hasta RETRY_ATTEMPTS veces con RETRY_DELAY_MS de espera entre intentos.
 */
async function waitForDB(): Promise<void> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      console.log('[migrate] Conexión a MySQL establecida.');
      return;
    } catch (err) {
      const code = (err as { code?: string }).code;
      console.log(
        `[migrate] MySQL no disponible aún (intento ${attempt}/${RETRY_ATTEMPTS}, código: ${code ?? 'desconocido'}). Reintentando en ${RETRY_DELAY_MS / 1000}s...`,
      );
      if (attempt === RETRY_ATTEMPTS) {
        throw new Error(
          `[migrate] No se pudo conectar a MySQL después de ${RETRY_ATTEMPTS} intentos.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

/**
 * Ejecuta server/src/schema.sql contra la base de datos configurada en .env.
 * Uso: npm run migrate
 */
async function migrate(): Promise<void> {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  // Quita las líneas de comentario ("-- ...") ANTES de dividir por ";".
  const sqlWithoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = sqlWithoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(
    `[migrate] Conectando a ${process.env.DB_HOST}:${process.env.DB_PORT ?? 3306}/${process.env.DB_NAME}...`,
  );

  // Esperar a que MySQL esté listo antes de ejecutar statements
  await waitForDB();

  // Códigos de error que significan "esto ya existe" (idempotencia). Se
  // ignoran para poder correr este script varias veces sin fallar, ya que
  // no todas las versiones de MariaDB/MySQL soportan "IF NOT EXISTS" en
  // CREATE INDEX (a diferencia de CREATE TABLE/ADD COLUMN, que sí).
  const IGNORABLE_CODES = new Set([
    'ER_DUP_KEYNAME',
    'ER_DUP_FIELDNAME',
    'ER_TABLE_EXISTS_ERROR',
    'ER_FK_DUP_NAME',
  ]);

  for (const statement of statements) {
    console.log(`[migrate] Ejecutando:\n${statement}\n`);
    try {
      await pool.query(statement);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code && IGNORABLE_CODES.has(code)) {
        console.log(`[migrate] (omitido, ya existía: ${code})`);
        continue;
      }
      throw err;
    }
  }

  console.log('[migrate] Migración completada con éxito.');

  await pool.end();
}

migrate().catch((err) => {
  console.error('[migrate] Error al migrar la base de datos:', err);
  process.exit(1);
});
