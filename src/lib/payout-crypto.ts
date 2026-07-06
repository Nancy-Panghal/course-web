import crypto from 'crypto'

// AES-256-GCM for data that must be RECOVERABLE — unlike PAN, which we only
// ever mask. The full bank account number needs to be recoverable because
// you (admin) need the real value to send a manual payout until Route is live.
//
// Requires PAYOUT_ENCRYPTION_KEY in env: a 64-character hex string (32 bytes).
// Generate one locally with: openssl rand -hex 32
// Add it to Vercel env vars — never commit it, never reuse it elsewhere.

function getKey(): Buffer {
  const hex = process.env.PAYOUT_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'PAYOUT_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

export function encryptSecret(plainText: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptSecret(stored: string): string {
  const key = getKey()
  const [ivHex, authTagHex, dataHex] = stored.split(':')
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed encrypted value')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}