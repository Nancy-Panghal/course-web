import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { getSubscriptionPlan } from '@/app/api/razorpay/subscription-plans'
import { createKursoSubscriptionOrder, KursoCashfreeError } from '@/lib/kurso-cashfree'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { creator, error } = await getAuthenticatedCreator(req)
    if (error || !creator) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })

    const { planId } = await req.json()
    const plan = getSubscriptionPlan(planId)
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const subscriptionId = randomUUID()
    await supabase.from('subscriptions').upsert(
      { id: subscriptionId, creator_id: creator.id, plan_tier: plan.id, amount: plan.amount, status: 'inactive', client_txn_id: subscriptionId },
      { onConflict: 'creator_id' }
    )

    try {
      const order = await createKursoSubscriptionOrder({
        orderId: subscriptionId,
        amount: plan.amount,
        customerName: creator.name || creator.email || 'Creator',
        customerEmail: creator.email,
        returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/upgrade?order_id=${subscriptionId}`,
      })

      await supabase.from('subscriptions').update({ gateway_order_id: order.order_id }).eq('creator_id', creator.id)

      return NextResponse.json({
        clientTxnId: subscriptionId,
        orderId: order.order_id,
        paymentSessionId: order.payment_session_id,
        amount: plan.amount,
        plan,
      })
    } catch (err: any) {
      const msg = err instanceof KursoCashfreeError ? err.message : 'Could not start the subscription payment.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (err: any) {
    return friendlyErrorResponse(err, 'kurso/create-subscription-order')
  }
}
