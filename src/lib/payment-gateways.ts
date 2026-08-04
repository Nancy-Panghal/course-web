import { encryptSecret, decryptSecret } from '@/lib/creator-secrets'

export type GatewayProvider = 'cashfree' | 'razorpay' | 'stripe'
export type GatewayEnvironment = 'sandbox' | 'production'

export class GatewayVerificationError extends Error {
  constructor(message: string) {
    super(message)
  }
}

// ── Field specs — drives both the settings UI and server-side validation ──
export const PROVIDER_FIELDS: Record<
  GatewayProvider,
  { key: string; label: string; placeholder: string }[]
> = {
  cashfree: [
    { key: 'clientId', label: 'Client ID (x-client-id)', placeholder: 'CF...' },
    { key: 'clientSecret', label: 'Client Secret (x-client-secret)', placeholder: 'cfsk_...' },
  ],
  razorpay: [
    { key: 'keyId', label: 'Key ID', placeholder: 'rzp_live_...' },
    { key: 'keySecret', label: 'Key Secret', placeholder: '' },
  ],
  stripe: [
    { key: 'secretKey', label: 'Secret key', placeholder: 'sk_live_...' },
  ],
}

export const PROVIDER_LABELS: Record<GatewayProvider, string> = {
  cashfree: 'Cashfree',
  razorpay: 'Razorpay',
  stripe: 'Stripe',
}

function requireFields(provider: GatewayProvider, credentials: Record<string, string>) {
  for (const field of PROVIDER_FIELDS[provider]) {
    if (!credentials[field.key] || !credentials[field.key].trim()) {
      throw new GatewayVerificationError(`Please enter your ${field.label}.`)
    }
  }
}

// ── Per-provider live verification. Each throws GatewayVerificationError
// with a message safe to show the creator on auth failure. Any other
// failure (network, 5xx) throws a generic Error — caller treats that as
// "couldn't verify right now", NOT "your key is wrong".

async function verifyCashfree(credentials: Record<string, string>, environment: GatewayEnvironment) {
  const base = environment === 'sandbox' ? 'https://sandbox.cashfree.com' : 'https://api.cashfree.com'
  const res = await fetch(`${base}/pg/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': credentials.clientId,
      'x-client-secret': credentials.clientSecret,
      'x-api-version': '2023-08-01',
    },
    body: JSON.stringify({
      order_amount: 1.0,
      order_currency: 'INR',
      order_id: `kurso_verify_${Date.now()}`,
      customer_details: {
        customer_id: 'kurso_verification',
        customer_name: 'Kurso Verification',
        customer_email: 'verify@kurso.internal',
        customer_phone: '9999999999',
      },
    }),
  })
  if (res.status === 401 || res.status === 403) {
    throw new GatewayVerificationError('Cashfree rejected these credentials. Double-check your Client ID and Client Secret from the correct environment (test vs live).')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(`Cashfree verification failed unexpectedly: ${body?.message || res.status}`)
  }
}

async function verifyRazorpay(credentials: Record<string, string>) {
  const auth = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')
  const res = await fetch('https://api.razorpay.com/v1/payments?count=1', {
    headers: { Authorization: `Basic ${auth}` },
  })
  if (res.status === 401) {
    throw new GatewayVerificationError('Razorpay rejected these credentials. Double-check your Key ID and Key Secret.')
  }
  if (!res.ok) {
    throw new Error(`Razorpay verification failed unexpectedly: ${res.status}`)
  }
}

async function verifyStripe(credentials: Record<string, string>) {
  const res = await fetch('https://api.stripe.com/v1/balance', {
    headers: { Authorization: `Bearer ${credentials.secretKey}` },
  })
  if (res.status === 401) {
    throw new GatewayVerificationError('Stripe rejected this key. Double-check your Secret key — make sure you copied the secret key, not the publishable key.')
  }
  if (!res.ok) {
    throw new Error(`Stripe verification failed unexpectedly: ${res.status}`)
  }
}

export async function verifyGatewayCredentials(
  provider: GatewayProvider,
  credentials: Record<string, string>,
  environment: GatewayEnvironment
) {
  requireFields(provider, credentials)
  if (provider === 'cashfree') return verifyCashfree(credentials, environment)
  if (provider === 'razorpay') return verifyRazorpay(credentials)
  if (provider === 'stripe') return verifyStripe(credentials)
  throw new GatewayVerificationError('Unknown payment provider.')
}

export function encryptCredentials(credentials: Record<string, string>): string {
  return encryptSecret(JSON.stringify(credentials))
}

export function decryptCredentials(encrypted: string): Record<string, string> {
  return JSON.parse(decryptSecret(encrypted))
}
