import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyKursoCashfreeWebhookSignature } from '@/lib/kurso-cashfree'
import { getSubscriptionPlan } from '@/app/api/razorpay/subscription-plans'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function firstRow(query: any) {
  const { data, error } = await query.limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

function safeParse(raw: string) {
  try { return JSON.parse(raw) } catch { return null }
}

async function logWebhook(fields: Record<string, any>) {
  try {
    await supabaseAdmin.from('webhook_logs').insert(fields)
  } catch (e) {
    console.error('Failed to write webhook_logs row:', e)
  }
}

export async function POST(req: NextRequest) {
  // Cashfree signs the RAW body — must read as text before any parsing,
  // or the signature will never match (JSON re-serialization changes bytes).
  const rawBody = await req.text()
  const signature = req.headers.get('x-webhook-signature')
  const timestamp = req.headers.get('x-webhook-timestamp')

  if (!signature || !timestamp) {
    await logWebhook({ provider: 'cashfree', flow: 'flow_b', signature_valid: false, http_status_returned: 400, error_message: 'Missing webhook headers', raw_payload: safeParse(rawBody) })
    return NextResponse.json({ error: 'Missing required webhook headers' }, { status: 400 })
  }

  let validSignature = false
  try {
    validSignature = verifyKursoCashfreeWebhookSignature({ timestamp, rawBody, signature })
  } catch (err: any) {
    await logWebhook({ provider: 'cashfree', flow: 'flow_b', signature_valid: false, http_status_returned: 500, error_message: err?.message || 'Signature verification error' })
    return NextResponse.json({ error: 'Verification unavailable' }, { status: 500 })
  }

  if (!validSignature) {
    await logWebhook({ provider: 'cashfree', flow: 'flow_b', signature_valid: false, http_status_returned: 400, error_message: 'Signature mismatch', raw_payload: safeParse(rawBody) })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const body = safeParse(rawBody)
  const orderId = body?.data?.order?.order_id
  const paymentStatus = body?.data?.payment?.payment_status // SUCCESS | FAILED | USER_DROPPED
  const amount = body?.data?.payment?.payment_amount

  if (!orderId) {
    await logWebhook({ provider: 'cashfree', flow: 'flow_b', signature_valid: true, http_status_returned: 400, error_message: 'No order_id in payload', raw_payload: body })
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })
  }

  const subscription = await firstRow(
    supabaseAdmin.from('subscriptions').select('id, creator_id, plan_tier, status').eq('gateway_order_id', orderId)
  )

  if (!subscription) {
    await logWebhook({ provider: 'cashfree', flow: 'flow_b', signature_valid: true, http_status_returned: 200, gateway_order_id: orderId, error_message: 'No matching subscription for this order_id', raw_payload: body })
    // 200 so Cashfree doesn't retry an order we'll never recognize.
    return NextResponse.json({ received: true, matched: false })
  }

  await logWebhook({ provider: 'cashfree', flow: 'flow_b', signature_valid: true, http_status_returned: 200, gateway_order_id: orderId, event: body?.type, raw_payload: body })

  try {
    if (paymentStatus === 'FAILED' || paymentStatus === 'USER_DROPPED') {
      await supabaseAdmin.from('subscriptions').update({ status: 'past_due' }).eq('id', subscription.id)
      return NextResponse.json({ received: true, message: `Marked ${paymentStatus}` })
    }
    if (paymentStatus !== 'SUCCESS') {
      return NextResponse.json({ received: true, message: `Ignored status: ${paymentStatus}` })
    }
    if (subscription.status === 'active') {
      return NextResponse.json({ received: true, message: 'Already processed' })
    }

    const periodStart = new Date()
    const periodEnd = new Date(periodStart)
    periodEnd.setDate(periodEnd.getDate() + 30)

    await supabaseAdmin.from('subscriptions').update({
      status: 'active',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    }).eq('id', subscription.id)

    // Auto-republish courses that were paused by the auto-expiry cron
    // (never a course the creator chose to draft themselves — that's the
    // whole reason auto_unpublished_at exists, to tell the two apart).
    await supabaseAdmin.from('courses')
      .update({ is_published: true, auto_unpublished_at: null })
      .eq('creator_id', subscription.creator_id)
      .not('auto_unpublished_at', 'is', null)

    await supabaseAdmin.from('creators').update({ plan: subscription.plan_tier }).eq('id', subscription.creator_id)

    const plan = getSubscriptionPlan(subscription.plan_tier)
    await supabaseAdmin.from('kurso_subscription_payments').insert({
      creator_id: subscription.creator_id,
      plan_name: plan?.name || subscription.plan_tier,
      amount: amount ?? plan?.amount,
      paid_at: new Date().toISOString(),
    })

    return NextResponse.json({ received: true, message: 'Subscription activated' })
  } catch (err: any) {
    // Payment was genuinely verified but our processing failed — leave the
    // record as-is and log for manual reconciliation, don't guess.
    console.error('Cashfree kurso-webhook processing error:', err)
    await logWebhook({ provider: 'cashfree', flow: 'flow_b', signature_valid: true, http_status_returned: 500, gateway_order_id: orderId, error_message: err?.message || 'Unknown processing error', raw_payload: body })
    return NextResponse.json({ error: 'Processing error — left pending for reconciliation' }, { status: 500 })
  }
}
