import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyVyaparSignature } from '@/lib/vyapar'
import { decryptSecret } from '@/lib/creator-secrets'
import { normalizePhone } from '@/lib/phone'
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
  const rawBody = await req.text()
  const signature = req.headers.get('x-vyapargateway-signature')
  const timestamp = req.headers.get('x-vyapargateway-timestamp')
  const headerOrderId = req.headers.get('x-vyapargateway-order-id')

  if (!signature || !timestamp || !headerOrderId) {
    await logWebhook({ provider: 'vyapar', flow: 'unmatched', signature_valid: false, http_status_returned: 400, raw_payload: safeParse(rawBody), error_message: 'Missing required webhook headers' })
    return NextResponse.json({ error: 'Missing required webhook headers' }, { status: 400 })
  }

  // Identify which record this belongs to via the HEADER order id — never
  // trust the body for this lookup until the signature is verified below.
  const transaction = await firstRow(
    supabaseAdmin.from('transactions')
      .select('id, creator_id, course_id, student_name, student_email, student_phone, status')
      .eq('gateway_order_id', headerOrderId)
  )

  let flow: 'flow_a' | 'flow_b' | 'unmatched' = 'unmatched'
  let secret: string | null = null
  let subscription: any = null

  if (transaction) {
    flow = 'flow_a'
    const creator = await firstRow(
      supabaseAdmin.from('creators').select('id, vyapar_webhook_secret_encrypted').eq('id', transaction.creator_id)
    )
    if (creator?.vyapar_webhook_secret_encrypted) {
      try { secret = decryptSecret(creator.vyapar_webhook_secret_encrypted) } catch { secret = null }
    }
  } else {
    subscription = await firstRow(
      supabaseAdmin.from('subscriptions').select('id, creator_id, plan_tier, status').eq('gateway_order_id', headerOrderId)
    )
    if (subscription) {
      flow = 'flow_b'
      secret = process.env.VYAPAR_PLATFORM_WEBHOOK_SECRET || null
    }
  }

  if (flow === 'unmatched' || !secret) {
    await logWebhook({
      provider: 'vyapar', flow, signature_valid: false, http_status_returned: 200,
      gateway_order_id: headerOrderId, raw_payload: safeParse(rawBody),
      error_message: flow === 'unmatched' ? 'No matching transaction or subscription for this order_id' : 'Webhook secret not configured for this account',
    })
    // 200 so Vyapar doesn't keep retrying an order we'll never recognize —
    // this is flagged in webhook_logs for manual review instead.
    return NextResponse.json({ received: true, matched: false })
  }

  const validSignature = verifyVyaparSignature({ timestamp, rawBody, secret, signature })
  if (!validSignature) {
    await logWebhook({ provider: 'vyapar', flow, signature_valid: false, http_status_returned: 400, gateway_order_id: headerOrderId, raw_payload: safeParse(rawBody), error_message: 'Signature mismatch' })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const body = safeParse(rawBody)
  if (!body || body.order_id !== headerOrderId) {
    await logWebhook({ provider: 'vyapar', flow, signature_valid: true, http_status_returned: 400, gateway_order_id: headerOrderId, raw_payload: body, error_message: 'Body order_id does not match header order_id' })
    return NextResponse.json({ error: 'Payload mismatch' }, { status: 400 })
  }

  await logWebhook({ provider: 'vyapar', flow, signature_valid: true, http_status_returned: 200, gateway_order_id: headerOrderId, client_txn_id: body.client_txn_id, event: body.event, raw_payload: body })

  try {
    if (flow === 'flow_a') return await handleFlowA(transaction, body, signature)
    return await handleFlowB(subscription, body)
  } catch (err: any) {
    // Payment was genuinely verified but OUR processing failed — leave the
    // record 'pending' rather than guessing, log the real error, and return
    // 500 so this surfaces for manual reconciliation instead of silently
    // marking a real payment as failed.
    console.error('Vyapar webhook processing error:', err)
    await logWebhook({ provider: 'vyapar', flow, signature_valid: true, http_status_returned: 500, gateway_order_id: headerOrderId, raw_payload: body, error_message: err?.message || 'Unknown processing error' })
    return NextResponse.json({ error: 'Processing error — left pending for reconciliation' }, { status: 500 })
  }
}

// ── Flow A: student → creator ──────────────────────────────────────
async function handleFlowA(transaction: any, body: any, signature: string) {
  if (transaction.status === 'success') {
    return NextResponse.json({ received: true, message: 'Already processed' })
  }
  if (body.status === 'failed' || body.status === 'expired') {
    await supabaseAdmin.from('transactions').update({ status: body.status }).eq('id', transaction.id)
    return NextResponse.json({ received: true, message: `Marked ${body.status}` })
  }
  if (body.status !== 'success') {
    return NextResponse.json({ received: true, message: `Ignored status: ${body.status}` })
  }

  const cleanedPhone = body.customer_mobile
    ? normalizePhone(String(body.customer_mobile))
    : transaction.student_phone ? normalizePhone(transaction.student_phone) : null
  const email = body.customer_email || transaction.student_email
  const phoneOrEmail = cleanedPhone || email

  let student: any = null
  if (email) student = await firstRow(supabaseAdmin.from('students').select('*').eq('email', email))
  if (!student && cleanedPhone) student = await firstRow(supabaseAdmin.from('students').select('*').eq('phone', cleanedPhone))

  if (student) {
    await supabaseAdmin.from('students').update({
      email: email || undefined,
      phone: cleanedPhone || undefined,
      name: body.customer_name || student.name || undefined,
    }).eq('id', student.id)
  } else {
    const { data: inserted, error: insertErr } = await supabaseAdmin.from('students').insert({
      email: email || null, phone: cleanedPhone || null, name: body.customer_name || transaction.student_name || null,
    }).select('*').single()
    if (insertErr?.code === '23505') {
      student = cleanedPhone
        ? await firstRow(supabaseAdmin.from('students').select('*').eq('phone', cleanedPhone))
        : await firstRow(supabaseAdmin.from('students').select('*').eq('email', email))
      if (!student) throw insertErr
    } else if (insertErr) {
      throw insertErr
    } else {
      student = inserted
    }
  }

  let existingEnrollment = await firstRow(
    supabaseAdmin.from('enrollments').select('*').eq('course_uuid', transaction.course_id).eq('student_id', student.id)
  )
  if (!existingEnrollment && phoneOrEmail) {
    existingEnrollment = await firstRow(
      supabaseAdmin.from('enrollments').select('*').eq('course_uuid', transaction.course_id).eq('phone', phoneOrEmail)
    )
  }

  const now = new Date().toISOString()
  let enrollmentId: string

  if (existingEnrollment) {
    enrollmentId = existingEnrollment.id
    if (existingEnrollment.payment_status !== 'paid') {
      await supabaseAdmin.from('enrollments').update({
        payment_status: 'paid', payment_id: body.upi_txn_id, amount_paid: body.amount,
        student_id: student.id, creator_id: transaction.creator_id, phone: phoneOrEmail, last_web_sync: now,
      }).eq('id', enrollmentId)
    }
  } else {
    const { data: newEnrollment, error: enrollErr } = await supabaseAdmin.from('enrollments').insert({
      course_uuid: transaction.course_id, student_id: student.id, creator_id: transaction.creator_id,
      payment_status: 'paid', payment_id: body.upi_txn_id, amount_paid: body.amount, phone: phoneOrEmail, last_web_sync: now,
    }).select('id').single()
    if (enrollErr) throw enrollErr
    enrollmentId = newEnrollment.id
  }

  await supabaseAdmin.from('transactions').update({
    status: 'success', rrn: body.upi_txn_id, payer_vpa: body.payer_vpa,
    signature_hash: signature, student_id: student.id, enrollment_id: enrollmentId,
  }).eq('id', transaction.id)

  return NextResponse.json({ received: true, message: 'Enrollment activated' })
}

// ── Flow B: creator → Kurso subscription ────────────────────────────
async function handleFlowB(subscription: any, body: any) {
  if (body.status === 'failed' || body.status === 'expired') {
    await supabaseAdmin.from('subscriptions').update({ status: 'past_due' }).eq('id', subscription.id)
    return NextResponse.json({ received: true, message: `Marked ${body.status}` })
  }
  if (body.status !== 'success') {
    return NextResponse.json({ received: true, message: `Ignored status: ${body.status}` })
  }

  const periodStart = new Date()
  const periodEnd = new Date(periodStart)
  periodEnd.setDate(periodEnd.getDate() + 30)

  await supabaseAdmin.from('subscriptions').update({
    status: 'active',
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
  }).eq('id', subscription.id)

  await supabaseAdmin.from('creators').update({ plan: subscription.plan_tier }).eq('id', subscription.creator_id)

  // Keep your existing payment-history table (used on /upgrade) in sync
  const plan = getSubscriptionPlan(subscription.plan_tier)
  await supabaseAdmin.from('kurso_subscription_payments').insert({
    creator_id: subscription.creator_id,
    plan_name: plan?.name || subscription.plan_tier,
    amount: body.amount,
    paid_at: new Date().toISOString(),
  })

  return NextResponse.json({ received: true, message: 'Subscription activated' })
}