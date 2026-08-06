import { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from '@/lib/payment-gateways'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export class CheckoutOrderError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

export type CreatorGateway = {
  provider: 'cashfree' | 'razorpay' | 'stripe'
  environment: 'sandbox' | 'production'
  credentials: Record<string, string>
}

// A creator can have multiple connected providers, but a single checkout
// uses ONE of them: their default, or their only verified one. Letting
// students pick between the creator's several gateways is a later
// refinement, not needed for launch.
// Refunds must go back through the SAME provider the original payment
// used — never "whichever gateway is default now" (a creator could have
// switched providers since). Look up by provider explicitly.
export async function getCreatorGatewayByProvider(creatorId: string, provider: 'cashfree' | 'razorpay' | 'stripe'): Promise<CreatorGateway | null> {
  const { data, error } = await supabase
    .from('creator_payment_gateways')
    .select('provider, environment, credentials_encrypted')
    .eq('creator_id', creatorId)
    .eq('provider', provider)
    .eq('status', 'verified')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    provider: data.provider,
    environment: data.environment,
    credentials: decryptCredentials(data.credentials_encrypted),
  }
}

export async function getCreatorCheckoutGateway(creatorId: string): Promise<CreatorGateway | null> {
  const { data, error } = await supabase
    .from('creator_payment_gateways')
    .select('provider, environment, credentials_encrypted')
    .eq('creator_id', creatorId)
    .eq('status', 'verified')
    .order('is_default', { ascending: false })
    .limit(1)

  if (error) throw error
  const row = data?.[0]
  if (!row) return null

  return {
    provider: row.provider,
    environment: row.environment,
    credentials: decryptCredentials(row.credentials_encrypted),
  }
}

export type CheckoutResult =
  | { provider: 'cashfree'; orderId: string; paymentSessionId: string; mode: 'sandbox' | 'production' }
  | { provider: 'razorpay'; orderId: string; keyId: string; amountPaise: number; currency: string }
  | { provider: 'stripe'; checkoutUrl: string }

export async function createCheckoutOrder(params: {
  gateway: CreatorGateway
  transactionId: string
  amount: number // in rupees
  description: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  returnUrl: string // where the student lands after paying (Cashfree/Stripe redirect)
}): Promise<CheckoutResult> {
  const { gateway, transactionId, amount, description, customerName, customerEmail, customerPhone, returnUrl } = params

  if (gateway.provider === 'cashfree') {
    const base = gateway.environment === 'sandbox' ? 'https://sandbox.cashfree.com' : 'https://api.cashfree.com'
    const res = await fetch(`${base}/pg/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': gateway.credentials.clientId,
        'x-client-secret': gateway.credentials.clientSecret,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify({
        order_id: transactionId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: transactionId,
          customer_name: customerName || 'Student',
          customer_email: customerEmail || 'student@kurso.internal',
          customer_phone: customerPhone?.replace(/\D/g, '').slice(-10) || '9999999999',
        },
        order_meta: {
          return_url: returnUrl,
          notify_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/cashfree`,
        },
        order_note: description,
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new CheckoutOrderError(json?.message || 'Could not start Cashfree checkout.')
    return { provider: 'cashfree', orderId: json.order_id, paymentSessionId: json.payment_session_id, mode: gateway.environment }
  }

  if (gateway.provider === 'razorpay') {
    const auth = Buffer.from(`${gateway.credentials.keyId}:${gateway.credentials.keySecret}`).toString('base64')
    const amountPaise = Math.round(amount * 100)
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: transactionId,
        notes: { description },
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new CheckoutOrderError(json?.error?.description || 'Could not start Razorpay checkout.')
    return { provider: 'razorpay', orderId: json.id, keyId: gateway.credentials.keyId, amountPaise, currency: 'INR' }
  }

  if (gateway.provider === 'stripe') {
    const amountPaise = Math.round(amount * 100)
    const body = new URLSearchParams({
      mode: 'payment',
      'line_items[0][price_data][currency]': 'inr',
      'line_items[0][price_data][product_data][name]': description,
      'line_items[0][price_data][unit_amount]': String(amountPaise),
      'line_items[0][quantity]': '1',
      success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}status=success`,
      cancel_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}status=cancelled`,
      client_reference_id: transactionId,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    })
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${gateway.credentials.secretKey}`,
      },
      body,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new CheckoutOrderError(json?.error?.message || 'Could not start Stripe checkout.')
    return { provider: 'stripe', checkoutUrl: json.url }
  }

  throw new CheckoutOrderError('Unsupported payment provider.', 400)
}
