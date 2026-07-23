import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyVyaparSignature } from '@/lib/vyapar'
import { decryptSecret } from '@/lib/creator-secrets'
import { normalizePhone } from '@/lib/phone'
import { getSubscriptionPlan } from '@/app/api/razorpay/subscription-plans'
import { escapeHtml, sendLoggedEmail } from '@/lib/email'
import { generateInvoicePdfForPayment } from '@/lib/invoice'

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
    supabaseAdmin.from('transactions').select('id, creator_id, course_id, ebook_id, product_type, student_name, student_email, student_phone, status')
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
    if (flow === 'flow_a') {
      return transaction.product_type === 'ebook'
        ? await handleFlowAEbook(transaction, body, signature)
        : await handleFlowA(transaction, body, signature)
    }
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

// ── Flow A: ebook purchase ───────────────────────────────────────
async function handleFlowAEbook(transaction: any, body: any, signature: string) {
  if (transaction.status === 'success') return NextResponse.json({ received: true, message: 'Already processed' })
  if (body.status === 'failed' || body.status === 'expired') {
    await supabaseAdmin.from('transactions').update({ status: body.status }).eq('id', transaction.id)
    return NextResponse.json({ received: true, message: `Marked ${body.status}` })
  }
  if (body.status !== 'success') return NextResponse.json({ received: true, message: `Ignored status: ${body.status}` })

  await supabaseAdmin.from('transactions').update({
    status: 'success', rrn: body.upi_txn_id, payer_vpa: body.payer_vpa, signature_hash: signature,
  }).eq('id', transaction.id)

  const { data: ebook } = await supabaseAdmin.from('ebooks').select('title').eq('id', transaction.ebook_id).maybeSingle()
  const email = body.customer_email || transaction.student_email
  const downloadUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/ebook-download/${transaction.id}`

  const { data: paymentRow, error: paymentInsertError } = await supabaseAdmin
    .from('payments')
    .insert({
      creator_id: transaction.creator_id,
      product_type: 'ebook',
      ebook_id: transaction.ebook_id,
      provider: 'vyapar',
      provider_payment_id: body.upi_txn_id,
      provider_order_id: body.order_id,
      buyer_name: body.customer_name || transaction.student_name || null,
      buyer_email: email || null,
      buyer_phone: body.customer_mobile || transaction.student_phone || null,
      currency: 'INR',
      gross_amount: body.amount,
      discount_amount: 0,
      net_amount: body.amount,
      platform_fee: 0,
      creator_earning: body.amount,
      status: 'paid',
      metadata: { source: 'vyapar_webhook' },
      paid_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (paymentInsertError) {
    console.error('[vyapar-webhook] Failed to record ebook payment — invoice unavailable until fixed manually:', paymentInsertError)
    if (email) {
      await sendLoggedEmail({
        supabase: supabaseAdmin, emailType: 'ebook_purchase_download_link', to: email,
        subject: `Your download: ${ebook?.title || 'Your ebook'}`, creatorId: transaction.creator_id,
        html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111"><h2>Thanks for your purchase!</h2><p>Your copy of <strong>${escapeHtml(ebook?.title || 'your ebook')}</strong> is ready.</p><a href="${downloadUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 18px;border-radius:10px;text-decoration:none">Download your ebook</a></div>`,
      }).catch(err => console.error('[webhook-email/ebook]', err))
    }
    return NextResponse.json({ received: true, message: 'Ebook purchase activated (invoice pending manual fix)' })
  }

  try {
    const { pdfBuffer, invoiceRow } = await generateInvoicePdfForPayment(supabaseAdmin, paymentRow.id)
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64')
    const filename = `${invoiceRow.invoice_number}.pdf`

    if (email) {
      await sendLoggedEmail({
        supabase: supabaseAdmin,
        emailType: 'ebook_purchase_download_link',
        to: email,
        subject: `Your download: ${ebook?.title || 'Your ebook'}`,
        creatorId: transaction.creator_id,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
            <h2 style="margin:0 0 12px">Thanks for your purchase!</h2>
            <p style="margin:0 0 16px">Your copy of <strong>${escapeHtml(ebook?.title || 'your ebook')}</strong> is ready — invoice ${invoiceRow.invoice_number} is attached.</p>
            <a href="${downloadUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 18px;border-radius:10px;text-decoration:none">Download your ebook</a>
            <p style="margin:16px 0 0;font-size:12px;color:#666">This link is personal to you and limited to 5 downloads.</p>
          </div>
        `,
        attachments: [{ filename, content: base64Pdf }],
      })
    }

    const { data } = await supabaseAdmin.auth.admin.getUserById(transaction.creator_id)
    const creatorEmail = data?.user?.email
    if (creatorEmail) {
      await sendLoggedEmail({
        supabase: supabaseAdmin,
        emailType: 'creator_ebook_sale',
        to: creatorEmail,
        subject: `New ebook sale: ${invoiceRow.invoice_number} — ₹${Number(invoiceRow.amount).toLocaleString('en-IN')}`,
        creatorId: transaction.creator_id,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
            <h2 style="margin:0 0 12px">New ebook sale</h2>
            <p style="margin:0 0 8px"><strong>${escapeHtml(invoiceRow.student_name || 'A reader')}</strong> bought <strong>${escapeHtml(ebook?.title || 'your ebook')}</strong> for ₹${Number(invoiceRow.amount).toLocaleString('en-IN')}.</p>
            <p style="margin:0">Invoice ${invoiceRow.invoice_number} is attached for your records.</p>
          </div>
        `,
        attachments: [{ filename, content: base64Pdf }],
      })
    }
  } catch (err) {
    console.error('[webhook-email/ebook-invoice]', err)
  }

  return NextResponse.json({ received: true, message: 'Ebook purchase activated' })
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

  // Mirror into the legacy `payments` table so the existing invoice system
  // (numbering, GST, download route) keeps working unchanged.
  const { data: course } = await supabaseAdmin.from('courses').select('name').eq('id', transaction.course_id).maybeSingle()
  const { data: paymentRow, error: paymentInsertError } = await supabaseAdmin
    .from('payments')
    .insert({
      creator_id: transaction.creator_id,
      course_id: transaction.course_id,
      student_id: student.id,
      enrollment_id: enrollmentId,
      provider: 'vyapar',
      provider_payment_id: body.upi_txn_id,
      provider_order_id: body.order_id,
      buyer_name: body.customer_name || transaction.student_name || null,
      buyer_email: email || null,
      buyer_phone: cleanedPhone || null,
      currency: 'INR',
      gross_amount: body.amount,
      discount_amount: 0,
      net_amount: body.amount,
      platform_fee: 0,
      creator_earning: body.amount,
      status: 'paid',
      metadata: { source: 'vyapar_webhook' },
      paid_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (paymentInsertError) {
    console.error('[vyapar-webhook] Failed to mirror payments row — invoice for this sale will be unavailable until fixed manually:', paymentInsertError)
  } else {
    // Best-effort notifications — none of these should block the webhook
    // from returning success, since the payment itself is already final.
    await maybeSendInvoiceEmails({
      paymentId: paymentRow.id,
      creatorId: transaction.creator_id,
      courseId: transaction.course_id,
      studentId: student.id,
      studentEmail: email,
    })
    await maybeSendCreatorEnrollmentEmail({
      creatorId: transaction.creator_id,
      courseId: transaction.course_id,
      courseName: course?.name || 'a course',
      studentName: body.customer_name,
      studentEmail: email,
      studentPhone: cleanedPhone,
    })
  }

  return NextResponse.json({ received: true, message: 'Enrollment activated' })
}

// ── Notification emails ──────────────────────────────────────────
async function maybeSendInvoiceEmails({
  paymentId, creatorId, courseId, studentId, studentEmail,
}: {
  paymentId: string; creatorId: string; courseId: string; studentId?: string | null; studentEmail?: string | null
}) {
  try {
    const { pdfBuffer, invoiceRow } = await generateInvoicePdfForPayment(supabaseAdmin, paymentId)
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64')
    const filename = `${invoiceRow.invoice_number}.pdf`

    const { data } = await supabaseAdmin.auth.admin.getUserById(creatorId)
    const creatorEmail = data?.user?.email
    const prefs = data?.user?.user_metadata?.email_notifications || {}

    if (creatorEmail && prefs.paidSale !== false) {
      await sendLoggedEmail({
        supabase: supabaseAdmin,
        emailType: 'creator_invoice_copy',
        to: creatorEmail,
        subject: `Invoice ${invoiceRow.invoice_number} — ₹${Number(invoiceRow.amount).toLocaleString('en-IN')}`,
        creatorId, courseId, paymentId,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
            <h2 style="margin:0 0 12px">New sale — invoice attached</h2>
            <p style="margin:0 0 8px"><strong>${escapeHtml(invoiceRow.student_name || 'A student')}</strong> paid <strong>₹${Number(invoiceRow.amount).toLocaleString('en-IN')}</strong> for <strong>${escapeHtml(invoiceRow.course_name)}</strong>.</p>
            <p style="margin:0">Invoice ${invoiceRow.invoice_number} is attached for your records.</p>
          </div>
        `,
        attachments: [{ filename, content: base64Pdf }],
      })
    }

    if (studentEmail) {
      await sendLoggedEmail({
        supabase: supabaseAdmin,
        emailType: 'student_invoice_copy',
        to: studentEmail,
        subject: `Your invoice for ${invoiceRow.course_name}`,
        creatorId, studentId: studentId || null, courseId, paymentId,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
            <h2 style="margin:0 0 12px">Payment confirmed</h2>
            <p style="margin:0 0 8px">Your invoice ${invoiceRow.invoice_number} is attached.</p>
          </div>
        `,
        attachments: [{ filename, content: base64Pdf }],
      })
    }
  } catch (err) {
    console.error('[webhook-email/invoice]', err)
  }
}

async function maybeSendCreatorEnrollmentEmail({
  creatorId, courseId, courseName, studentName, studentEmail, studentPhone,
}: {
  creatorId: string; courseId: string; courseName: string
  studentName?: string | null; studentEmail?: string | null; studentPhone?: string | null
}) {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(creatorId)
    const creator = data?.user
    const prefs = creator?.user_metadata?.email_notifications || {}
    if (prefs.newEnrollment === false || !creator?.email) return

    const safeCourse = escapeHtml(courseName || 'your course')
    const safeStudent = escapeHtml(studentName || studentEmail || studentPhone || 'A student')

    await sendLoggedEmail({
      supabase: supabaseAdmin,
      emailType: 'creator_new_enrollment',
      to: creator.email,
      subject: `New enrollment: ${courseName}`,
      creatorId, courseId,
      metadata: { student_name: studentName || null, student_email: studentEmail || null, student_phone: studentPhone || null },
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
          <h2 style="margin:0 0 12px">New student enrolled</h2>
          <p style="margin:0 0 8px"><strong>${safeStudent}</strong> enrolled in <strong>${safeCourse}</strong>.</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard"
            style="display:inline-block;background:#7c3aed;color:white;padding:10px 14px;border-radius:10px;text-decoration:none">
            Open dashboard
          </a>
        </div>
      `,
    })
  } catch (err) {
    console.error('[webhook-email/creator-enrollment]', err)
  }
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