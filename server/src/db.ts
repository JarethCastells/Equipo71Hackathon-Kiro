import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

// Se carga aquí (y no solo en index.ts) porque en ESM los módulos importados
// se inicializan antes de que se ejecute el cuerpo de index.ts. Sin esto,
// el pool se crearía con process.env vacío y siempre caería a "localhost".
dotenv.config()

/**
 * Pool de conexión a MySQL (hosting Neubox / teotek.com.mx).
 *
 * Notas para conectar contra un MySQL remoto de cPanel/Neubox:
 * 1. En el panel de "Remote MySQL / Acceso remoto a bases de datos" debes
 *    autorizar la IP pública desde la que corre este servidor Node
 *    (no la IP de quien visita la web, sino la del servidor que ejecuta
 *    esta API). Si el backend corre en el mismo hosting que la base de
 *    datos, normalmente no necesitas esto y basta con DB_HOST=localhost.
 * 2. El nombre de usuario y de base de datos en cPanel suelen llevar el
 *    prefijo de la cuenta, ej: "teotekco_appuser" y "teotekco_talentflow".
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // Necesario en muchos hostings compartidos que exigen TLS para conexiones remotas.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
})


export async function testConnection(): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.ping()
  } finally {
    conn.release()
  }
}

export default pool
