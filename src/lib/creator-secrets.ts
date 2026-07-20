import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.CREATOR_SECRETS_KEY
  if (!raw) throw new Error('CREATOR_SECRETS_KEY is not configured')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('CREATOR_SECRETS_KEY must decode to exactly 32 bytes (base64)')
  return key
}

export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

export function decryptSecret(encoded: string): string {
  const key = getKey()
  const raw = Buffer.from(encoded, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const ciphertext = raw.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}