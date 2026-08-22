import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { decideSubscriptionRefundRequest } from '@/lib/refund-actions'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('refund_requests')
      .select('id, subscription_id, reason, status, requested_at, decision_note, creators(name, email)')
      .eq('type', 'subscription')
      .order('requested_at', { ascending: false })
    if (error) throw error

    const subscriptionIds = [...new Set((data || []).map(r => r.subscription_id).filter(Boolean))]
    const { data: payments } = subscriptionIds.length
      ? await supabase
          .from('kurso_subscription_payments')
          .select('subscription_id, order_id, amount, refunded_amount, paid_at')
          .in('subscription_id', subscriptionIds)
          .order('paid_at', { ascending: false })
      : { data: [] as any[] }

    // Most recent payment per subscription — payments is ordered by
    // paid_at desc, so the first match for each subscription_id wins.
    const latestPaymentBySubscription = new Map<string, any>()
    for (const p of payments || []) {
      if (!latestPaymentBySubscription.has(p.subscription_id)) latestPaymentBySubscription.set(p.subscription_id, p)
    }

    const enriched = (data || []).map(r => {
      const payment = latestPaymentBySubscription.get(r.subscription_id)
      const refundable = payment ? Number(payment.amount) - Number(payment.refunded_amount || 0) : null
      return {
        ...r,
        refundableAmount: refundable,
        canAutoRefund: !!payment?.order_id,
      }
    })

    return NextResponse.json({ requests: enriched })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/subscription-refund-requests GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { requestId, decision, note, amount } = await req.json()
    if (!requestId || !['approved', 'denied'].includes(decision)) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }
    const result = await decideSubscriptionRefundRequest({ requestId, decision, note, amount })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, message: result.message })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/subscription-refund-requests POST')
  }
}