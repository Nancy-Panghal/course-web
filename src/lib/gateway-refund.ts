import { CreatorGateway } from '@/lib/gateway-checkout'

export class RefundExecutionError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export type RefundTarget = {
  provider: 'cashfree' | 'razorpay' | 'stripe'
  providerOrderId: string | null   // Cashfree's order_id
  providerPaymentId: string | null // Razorpay's payment id / Stripe's payment_intent id
}

export async function executeGatewayRefund(params: {
  gateway: CreatorGateway
  target: RefundTarget
  amount: number // rupees
  refundId: string // OUR refunds.id — used as the provider's idempotency/refund reference
  reason?: string
}): Promise<{ providerRefundId: string }> {
  const { gateway, target, amount, refundId, reason } = params

  if (gateway.provider === 'cashfree') {
    if (!target.providerOrderId) throw new RefundExecutionError('Missing Cashfree order id on this payment — cannot refund.')
    const base = gateway.environment === 'sandbox' ? 'https://sandbox.cashfree.com' : 'https://api.cashfree.com'
    const res = await fetch(`${base}/pg/orders/${target.providerOrderId}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': gateway.credentials.clientId,
        'x-client-secret': gateway.credentials.clientSecret,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify({
        refund_amount: amount,
        refund_id: refundId, // Cashfree dedupes on this — safe to retry
        refund_note: reason || 'Refund issued by creator via Kurso',
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new RefundExecutionError(json?.message || `Cashfree refund failed (${res.status})`)
    return { providerRefundId: json.refund_id || json.cf_refund_id || refundId }
  }

  if (gateway.provider === 'razorpay') {
    if (!target.providerPaymentId) throw new RefundExecutionError('Missing Razorpay payment id on this payment — cannot refund.')
    const auth = Buffer.from(`${gateway.credentials.keyId}:${gateway.credentials.keySecret}`).toString('base64')
    const res = await fetch(`https://api.razorpay.com/v1/payments/${target.providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        // Razorpay dedupes retried refund attempts on this key, so a
        // network timeout on our end can't accidentally double-refund.
        'X-Razorpay-Idempotency-Key': refundId,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        speed: 'normal',
        notes: { reason: reason || 'Refund issued by creator via Kurso', kurso_refund_id: refundId },
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new RefundExecutionError(json?.error?.description || `Razorpay refund failed (${res.status})`)
    return { providerRefundId: json.id }
  }

  if (gateway.provider === 'stripe') {
    if (!target.providerPaymentId) throw new RefundExecutionError('Missing Stripe payment intent on this payment — cannot refund.')
    const body = new URLSearchParams({
      payment_intent: target.providerPaymentId,
      amount: String(Math.round(amount * 100)), // cents
      reason: 'requested_by_customer',
      'metadata[kurso_refund_id]': refundId,
    })
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${gateway.credentials.secretKey}`,
        // Stripe's own idempotency mechanism — a retried request with the
        // same key returns the original result instead of refunding twice.
        'Idempotency-Key': refundId,
      },
      body,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new RefundExecutionError(json?.error?.message || `Stripe refund failed (${res.status})`)
    return { providerRefundId: json.id }
  }

  throw new RefundExecutionError('Unsupported payment provider.')
}
