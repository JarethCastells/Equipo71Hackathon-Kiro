import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Cifrado simétrico (AES-256-GCM) para datos sensibles en reposo, como el
 * número de cuenta bancaria. GCM incluye autenticación integrada (detecta
 * si el valor cifrado fue manipulado) y requiere un IV distinto por cada
 * cifrado, que aquí se genera al azar y se guarda junto con el texto.
 *
 * La clave se deriva de ENCRYPTION_KEY (variable de entorno) con SHA-256
 * para obtener siempre 32 bytes exactos, sin importar la longitud del
 * secreto original que se haya configurado.
 */
function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) {
    throw new Error(
      'Falta ENCRYPTION_KEY en el entorno. Es obligatoria para cifrar datos bancarios sensibles.',
    )
  }
  return createHash('sha256').update(secret).digest()
}

const ALGORITHM = 'aes-256-gcm'

export function encryptSecret(plainText: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf-8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Empaquetado: iv.authTag.ciphertext, todo en base64, separado por ".".
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.')
}

export function decryptSecret(packed: string): string {
  const key = getKey()
  const [ivB64, authTagB64, dataB64] = packed.split('.')
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Formato de dato cifrado inválido.')
  }

  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf-8')
}
