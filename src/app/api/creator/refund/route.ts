import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { getCreatorGatewayByProvider } from '@/lib/gateway-checkout'
import { executeGatewayRefund, RefundExecutionError } from '@/lib/gateway-refund'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getRefundablePayment(enrollmentId: string, creatorId: string) {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, creator_id, payment_status, amount_paid, course_uuid')
    .eq('id', enrollmentId)
    .maybeSingle()

  if (!enrollment || enrollment.creator_id !== creatorId) return { error: 'Enrollment not found', status: 404 } as const
  if (enrollment.payment_status !== 'paid') return { error: 'This enrollment is not in a refundable state (already refunded, or never paid).', status: 400 } as const

  const { data: payment } = await supabase
    .from('payments')
    .select('id, provider, provider_order_id, provider_payment_id, net_amount, status')
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment) return { error: 'No completed payment record found for this enrollment — cannot refund automatically. Please refund manually and contact support.', status: 404 } as const

  const { data: refundRows } = await supabase
    .from('refunds')
    .select('amount, status')
    .eq('payment_id', payment.id)

  const alreadyRefunded = (refundRows || [])
    .filter(r => r.status === 'succeeded')
    .reduce((sum, r) => sum + Number(r.amount), 0)

  const refundable = Number(payment.net_amount) - alreadyRefunded

  return { enrollment, payment, alreadyRefunded, refundable } as const
}

// GET — how much is left to refund on this enrollment, before showing the amount picker
export async function GET(req: NextRequest) {
  try {
    const { creator, error } = await getAuthenticatedCreator(req)
    if (error || !creator) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })

    const enrollmentId = req.nextUrl.searchParams.get('enrollmentId')
    if (!enrollmentId) return NextResponse.json({ error: 'Missing enrollmentId' }, { status: 400 })

    const result = await getRefundablePayment(enrollmentId, creator.id)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({
      provider: result.payment.provider,
      netAmount: Number(result.payment.net_amount),
      alreadyRefunded: result.alreadyRefunded,
      refundable: result.refundable,
    })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/refund GET')
  }
}

// POST — actually issue the refund. Never marks anything as refunded
// unless the gateway itself confirmed it — a failed gateway call always
// leaves the enrollment untouched and reports the real error back.
export async function POST(req: NextRequest) {
  try {
    const { creator, error } = await getAuthenticatedCreator(req)
    if (error || !creator) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })

    const { enrollmentId, amount, reason } = await req.json()
    if (!enrollmentId) return NextResponse.json({ error: 'Missing enrollmentId' }, { status: 400 })

    const result = await getRefundablePayment(enrollmentId, creator.id)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    const { enrollment, payment, refundable } = result

    // amount omitted or explicitly "full" → refund whatever's left
    const requestedAmount = amount === undefined || amount === null || amount === 'full'
      ? refundable
      : Number(amount)

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json({ error: 'Enter a valid refund amount.' }, { status: 400 })
    }
    if (requestedAmount > refundable + 0.01) { // small epsilon for float rounding
      return NextResponse.json({ error: `You can refund at most ₹${refundable.toLocaleString('en-IN')} on this payment — ₹${result.alreadyRefunded.toLocaleString('en-IN')} has already been refunded.` }, { status: 400 })
    }

    const gateway = await getCreatorGatewayByProvider(creator.id, payment.provider)
    if (!gateway) {
      return NextResponse.json({ error: `Your ${payment.provider} connection isn't active — reconnect it in Settings before issuing refunds.` }, { status: 409 })
    }

    const refundId = randomUUID()
    const isFullRefund = requestedAmount >= refundable - 0.01

    await supabase.from('refunds').insert({
      id: refundId,
      payment_id: payment.id,
      creator_id: creator.id,
      enrollment_id: enrollmentId,
      amount: requestedAmount,
      reason: reason || null,
      revoke_access: true,
      provider: payment.provider,
      status: 'pending',
    })

    try {
      const { providerRefundId } = await executeGatewayRefund({
        gateway,
        target: {
          provider: payment.provider,
          providerOrderId: payment.provider_order_id,
          providerPaymentId: payment.provider_payment_id,
        },
        amount: requestedAmount,
        refundId,
        reason,
      })

      await supabase.from('refunds').update({ status: 'succeeded', provider_refund_id: providerRefundId }).eq('id', refundId)
      await supabase.from('enrollments').update({ payment_status: 'refunded' }).eq('id', enrollmentId)

      return NextResponse.json({
        success: true,
        message: isFullRefund
          ? 'Full refund issued. The student\'s access has been revoked.'
          : `Partial refund of ₹${requestedAmount.toLocaleString('en-IN')} issued. The student's access has been revoked.`,
        revokedAccess: true,
      })
    } catch (err: any) {
      const msg = err instanceof RefundExecutionError ? err.message : 'The payment gateway rejected this refund. No money was moved and nothing was changed — please try again or refund manually from your gateway dashboard.'
      await supabase.from('refunds').update({ status: 'failed', error_message: msg }).eq('id', refundId)
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/refund POST')
  }
}
