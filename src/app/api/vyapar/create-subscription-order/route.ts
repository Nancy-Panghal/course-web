import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { getSubscriptionPlan } from '@/app/api/razorpay/subscription-plans'
import { createVyaparOrder, VyaparError } from '@/lib/vyapar'
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

    const apiKey = process.env.VYAPAR_PLATFORM_API_KEY
    if (!apiKey) {
      console.error('VYAPAR_PLATFORM_API_KEY is not configured')
      return NextResponse.json({ error: 'Subscriptions are temporarily unavailable. Please try again shortly.' }, { status: 500 })
    }

    const subscriptionId = randomUUID()
    await supabase.from('subscriptions').upsert(
      { id: subscriptionId, creator_id: creator.id, plan_tier: plan.id, amount: plan.amount, status: 'inactive', client_txn_id: subscriptionId },
      { onConflict: 'creator_id' }
    )

    try {
      const order = await createVyaparOrder({
        apiKey,
        amount: plan.amount,
        clientTxnId: subscriptionId,
        customerName: creator.name || creator.email || 'Creator',
        customerEmail: creator.email,
        pInfo: `Kurso ${plan.name} subscription`,
        callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/vyapar/webhook`,
      })

      await supabase.from('subscriptions').update({ gateway_order_id: order.order_id }).eq('creator_id', creator.id)

      return NextResponse.json({
        clientTxnId: subscriptionId,
        orderId: order.order_id,
        amount: order.amount,
        qrCode: order.qr_code,
        upiIntent: order.upi_intent,
        expiresAt: order.expires_at,
        plan,
      })
    } catch (err: any) {
      const msg = err instanceof VyaparError ? err.message : 'Could not start the subscription payment.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  } catch (err: any) {
    return friendlyErrorResponse(err, 'vyapar/create-subscription-order')
  }
}