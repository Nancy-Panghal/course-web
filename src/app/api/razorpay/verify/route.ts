/**
 * src/app/api/razorpay/verify/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Production-grade payment verification.
 * After verifying signature + amount with Razorpay servers:
 *  1. Upsert student row (create or update)
 *  2. Upsert enrollment as 'paid' (never duplicate, never downgrade)
 *  3. If a bot-created enrollment exists, merge it (keep telegram_chat_id)
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { escapeHtml, sendLoggedEmail } from '@/lib/email'
import { slugify } from '@/lib/utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function safeCompare(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    if (left.length !== right.length) return false
    return crypto.timingSafeEqual(left, right)
  } catch {
    return false
  }
}

async function fetchRazorpayPayment(paymentId: string) {
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Razorpay API error: ${res.status}`)
  return res.json()
}

async function firstRow(query: any): Promise<any | null> {
  const { data, error } = await query.limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

async function maybeSendCreatorSaleEmail({
  creatorId,
  courseId,
  paymentRecordId,
  courseName,
  amount,
  buyerName,
  buyerEmail,
}: {
  creatorId: string
  courseId: string
  paymentRecordId?: string | null
  courseName: string
  amount: number
  buyerName?: string | null
  buyerEmail?: string | null
}) {
  try {
    const { data } = await supabase.auth.admin.getUserById(creatorId)
    const creator = data?.user
    const prefs = creator?.user_metadata?.email_notifications || {}
    if (prefs.paidSale === false || !creator?.email) return

    const safeCourse = escapeHtml(courseName || 'your course')
    const safeBuyer = escapeHtml(buyerName || buyerEmail || 'A student')

    await sendLoggedEmail({
      supabase,
      emailType: 'creator_paid_sale',
      to: creator.email,
      subject: `New sale: ₹${amount.toLocaleString('en-IN')}`,
      creatorId,
      courseId,
      paymentId: paymentRecordId,
      metadata: {
        buyer_name: buyerName || null,
        buyer_email: buyerEmail || null,
        amount,
      },
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
          <h2 style="margin:0 0 12px">New paid sale</h2>
          <p style="margin:0 0 8px"><strong>${safeBuyer}</strong> paid <strong>₹${amount.toLocaleString('en-IN')}</strong>.</p>
          <p style="margin:0 0 16px">Course: <strong>${safeCourse}</strong></p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard"
            style="display:inline-block;background:#7c3aed;color:white;padding:10px 14px;border-radius:10px;text-decoration:none">
            Open dashboard
          </a>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email/creator-sale]', err)
  }
}

async function maybeSendCreatorEnrollmentEmail({
  creatorId,
  courseId,
  paymentRecordId,
  courseName,
  studentName,
  studentEmail,
  studentPhone,
}: {
  creatorId: string
  courseId: string
  paymentRecordId?: string | null
  courseName: string
  studentName?: string | null
  studentEmail?: string | null
  studentPhone?: string | null
}) {
  try {
    const { data } = await supabase.auth.admin.getUserById(creatorId)
    const creator = data?.user
    const prefs = creator?.user_metadata?.email_notifications || {}
    if (prefs.newEnrollment === false || !creator?.email) return

    const safeCourse = escapeHtml(courseName || 'your course')
    const safeStudent = escapeHtml(studentName || studentEmail || studentPhone || 'A student')

    await sendLoggedEmail({
      supabase,
      emailType: 'creator_new_enrollment',
      to: creator.email,
      subject: `New enrollment: ${courseName}`,
      creatorId,
      courseId,
      paymentId: paymentRecordId,
      metadata: {
        student_name: studentName || null,
        student_email: studentEmail || null,
        student_phone: studentPhone || null,
      },
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
    console.error('[email/creator-enrollment]', err)
  }
}

async function maybeSendStudentReceiptEmail({
  studentEmail,
  studentName,
  studentId,
  creatorId,
  courseId,
  paymentRecordId,
  courseName,
  amount,
  discountAmount,
  providerPaymentId,
}: {
  studentEmail?: string | null
  studentName?: string | null
  studentId?: string | null
  creatorId: string
  courseId: string
  paymentRecordId?: string | null
  courseName: string
  amount: number
  discountAmount: number
  providerPaymentId: string
}) {
  if (!studentEmail) return

  const safeName = escapeHtml(studentName || 'there')
  const safeCourse = escapeHtml(courseName || 'your course')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

  await sendLoggedEmail({
    supabase,
    emailType: 'student_payment_receipt',
    to: studentEmail,
    subject: `Receipt for ${courseName}`,
    creatorId,
    studentId,
    courseId,
    paymentId: paymentRecordId,
    metadata: {
      amount,
      discount_amount: discountAmount,
      provider_payment_id: providerPaymentId,
    },
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">Payment receipt</h2>
        <p style="margin:0 0 12px">Hi ${safeName}, your enrollment payment was successful.</p>
        <div style="background:#f6f4ff;border:1px solid #ddd6fe;border-radius:12px;padding:14px;margin:0 0 16px">
          <p style="margin:0 0 6px"><strong>Course:</strong> ${safeCourse}</p>
          <p style="margin:0 0 6px"><strong>Amount paid:</strong> ₹${amount.toLocaleString('en-IN')}</p>
          ${discountAmount > 0 ? `<p style="margin:0 0 6px"><strong>Discount:</strong> ₹${discountAmount.toLocaleString('en-IN')}</p>` : ''}
          <p style="margin:0"><strong>Payment ID:</strong> ${escapeHtml(providerPaymentId)}</p>
        </div>
        <a href="${siteUrl}/dashboard"
          style="display:inline-block;background:#7c3aed;color:white;padding:10px 14px;border-radius:10px;text-decoration:none">
          Open AcademyKit
        </a>
      </div>
    `,
  })
}

async function maybeSendStudentWelcomeEmail({
  studentEmail,
  studentName,
  studentId,
  creatorId,
  courseId,
  paymentRecordId,
  courseName,
  creatorName,
  telegramBotUsername,
}: {
  studentEmail?: string | null
  studentName?: string | null
  studentId?: string | null
  creatorId: string
  courseId: string
  paymentRecordId?: string | null
  courseName: string
  creatorName?: string | null
  telegramBotUsername?: string | null
}) {
  if (!studentEmail) return

  const safeName = escapeHtml(studentName || 'there')
  const safeCourse = escapeHtml(courseName || 'your course')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const creatorSlug = slugify(creatorName || 'instructor')
  const courseSlug = slugify(courseName || 'course')
  const courseUrl = `${siteUrl}/course/${creatorSlug}/${courseSlug}/${courseId}`
  const cleanBot = telegramBotUsername?.replace('@', '').trim()

  await sendLoggedEmail({
    supabase,
    emailType: 'student_welcome',
    to: studentEmail,
    subject: `Welcome to ${courseName}`,
    creatorId,
    studentId,
    courseId,
    paymentId: paymentRecordId,
    metadata: {
      has_telegram: Boolean(cleanBot),
      telegram_bot_username: cleanBot || null,
    },
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">Welcome to ${safeCourse}</h2>
        <p style="margin:0 0 12px">Hi ${safeName}, your course access is ready.</p>
        <a href="${courseUrl}"
          style="display:inline-block;background:#7c3aed;color:white;padding:10px 14px;border-radius:10px;text-decoration:none;margin:0 0 16px">
          Start learning
        </a>
        ${cleanBot ? `
          <div style="background:#eef8ff;border:1px solid #bae6fd;border-radius:12px;padding:14px;margin-top:16px">
            <p style="margin:0 0 6px"><strong>Telegram delivery is available.</strong></p>
            <p style="margin:0">After payment, use the Telegram button on the success screen to link your account with @${escapeHtml(cleanBot)}.</p>
          </div>
        ` : ''}
      </div>
    `,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      studentId,      // auth.users id (from supabase session)
      studentEmail,
      studentName,
      studentPhone,
      creatorId,
      courseId,
      couponCode,
    } = body

    // ── 1. Validate required fields ───────────────────────────────
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !courseId) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }
    if (!studentPhone && !studentEmail) {
      return NextResponse.json({ error: 'Missing student contact' }, { status: 400 })
    }

    // ── 2. Verify HMAC signature ──────────────────────────────────
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (!safeCompare(expectedSig, razorpay_signature)) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // ── 3. Verify payment amount with Razorpay server ─────────────
    const course = await firstRow(
      supabase
        .from('courses')
        .select('id, name, price, creator_id, host_name, is_published')
        .eq('id', courseId)
    )
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    if (!course.is_published) {
      return NextResponse.json({ error: 'This course is not currently available for enrollment.' }, { status: 403 })
    }

    let pricing = {
      originalAmount: Number(course.price),
      discountAmount: 0,
      finalAmount: Number(course.price),
      couponId: null as string | null,
      couponCode: null as string | null,
    }

    const normalizedCoupon = String(couponCode || '').trim()
    if (normalizedCoupon) {
      const { data: couponRows, error: couponError } = await supabase.rpc(
        'validate_coupon_for_course',
        {
          input_course_id: courseId,
          input_coupon_code: normalizedCoupon,
        }
      )

      if (couponError) throw couponError

      const coupon = couponRows?.[0]
      if (!coupon?.valid) {
        return NextResponse.json(
          { error: coupon?.reason || 'Coupon is no longer valid' },
          { status: 400 }
        )
      }

      pricing = {
        originalAmount: Number(coupon.original_amount),
        discountAmount: Number(coupon.discount_amount),
        finalAmount: Number(coupon.final_amount),
        couponId: coupon.coupon_id,
        couponCode: coupon.coupon_code,
      }
    }

    const expectedAmount = Math.round(Number(pricing.finalAmount) * 100)
    const payment = await fetchRazorpayPayment(razorpay_payment_id)

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== expectedAmount ||
      payment.currency !== 'INR' ||
      payment.status !== 'captured'
    ) {
      return NextResponse.json(
        { error: 'Payment details do not match order' },
        { status: 400 }
      )
    }

    // ── 4. Upsert student row ─────────────────────────────────────
    // Find existing student by auth_id, then email, then create
    let student: any = null

    if (studentId) {
      student = await firstRow(
        supabase.from('students').select('id').eq('auth_id', studentId)
      )
    }
    if (!student && studentEmail) {
      student = await firstRow(
        supabase.from('students').select('id').eq('email', studentEmail)
      )
    }

    if (student) {
      // Update with latest info
      await supabase
        .from('students')
        .update({
          email: studentEmail || undefined,
          name: studentName || undefined,
          phone: studentPhone || undefined,
          auth_id: studentId || undefined,
        })
        .eq('id', student.id)
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('students')
        .insert({
          email: studentEmail || null,
          name: studentName || null,
          phone: studentPhone || null,
          auth_id: studentId || null,
        })
        .select('id')
        .single()
      if (insertErr) throw insertErr
      student = inserted
    }

    // ── 5. Find any existing enrollment (paid or bot-created) ─────
    // Check by student_id first (web signup), then by phone (bot signup)
    const phoneOrEmail = studentPhone || studentEmail!
    const normalizedCreatorId = creatorId || course.creator_id

    let existingEnrollment: any = null

    if (student?.id) {
      existingEnrollment = await firstRow(
        supabase
          .from('enrollments')
          .select('id, payment_status, telegram_chat_id, current_lesson, completed_lessons, quiz_results')
          .eq('course_uuid', courseId)
          .eq('student_id', student.id)
      )
    }
    // Also check by phone (bot may have created enrollment before web payment)
    if (!existingEnrollment && phoneOrEmail) {
      existingEnrollment = await firstRow(
        supabase
          .from('enrollments')
          .select('id, payment_status, telegram_chat_id, current_lesson, completed_lessons, quiz_results')
          .eq('course_uuid', courseId)
          .eq('phone', phoneOrEmail)
      )
    }

    const now = new Date().toISOString()
    let enrollmentId: string | null = null

    if (existingEnrollment) {
      // Update to paid — preserve telegram_chat_id and progress if they exist
      const { error: updateErr } = await supabase
        .from('enrollments')
        .update({
          payment_status: 'paid',
          payment_id: razorpay_payment_id,
          amount_paid: pricing.finalAmount,
          student_id: student?.id || null,
          creator_id: normalizedCreatorId,
          phone: phoneOrEmail,
          last_web_sync: now,
          // Preserve telegram_chat_id — don't overwrite if bot already linked it
          // Preserve current_lesson and completed_lessons from bot progress
        })
        .eq('id', existingEnrollment.id)

      if (updateErr) throw updateErr

      enrollmentId = existingEnrollment.id
      if (existingEnrollment.payment_status === 'paid') {
        return NextResponse.json({ success: true, alreadyEnrolled: true })
      }
    }

    // ── 6. Create new enrollment ──────────────────────────────────
    if (!enrollmentId) {
    const { data: insertedEnrollment, error: insertEnrollErr } = await supabase
      .from('enrollments')
      .insert({
        phone: phoneOrEmail,
        course_uuid: courseId,
        current_lesson: 1,
        student_id: student?.id || null,
        creator_id: normalizedCreatorId,
        amount_paid: pricing.finalAmount,
        payment_id: razorpay_payment_id,
        payment_status: 'paid',
        completed_lessons: [],
        quiz_results: [],
        last_web_sync: now,
      })
      .select('id')
      .single()

    if (insertEnrollErr) throw insertEnrollErr
    enrollmentId = insertedEnrollment?.id || null
    }

    let paymentRecordId: string | null = null
    const existingPayment = await firstRow(
      supabase
        .from('payments')
        .select('id')
        .eq('provider', 'razorpay')
        .eq('provider_payment_id', razorpay_payment_id)
    )

    if (existingPayment?.id) {
      paymentRecordId = existingPayment.id
    } else {
      const { data: paymentRecord, error: paymentInsertError } = await supabase
        .from('payments')
        .insert({
          creator_id: normalizedCreatorId,
          course_id: courseId,
          student_id: student?.id || null,
          enrollment_id: enrollmentId,
          provider: 'razorpay',
          provider_payment_id: razorpay_payment_id,
          provider_order_id: razorpay_order_id,
          buyer_name: studentName || null,
          buyer_email: studentEmail || null,
          buyer_phone: studentPhone || null,
          currency: 'INR',
          gross_amount: pricing.originalAmount,
          discount_amount: pricing.discountAmount,
          net_amount: pricing.finalAmount,
          platform_fee: 0,
          creator_earning: pricing.finalAmount,
          status: 'paid',
          metadata: {
            source: 'razorpay_verify',
            coupon_code: pricing.couponCode,
            razorpay_status: payment.status,
          },
          paid_at: now,
        })
        .select('id')
        .single()

      if (paymentInsertError) throw paymentInsertError
      paymentRecordId = paymentRecord?.id || null
    }

    if (pricing.couponId && pricing.couponCode && paymentRecordId) {
      const { data: redemptionRows, error: redemptionError } = await supabase.rpc(
        'redeem_coupon_for_payment',
        {
          input_coupon_code: pricing.couponCode,
          input_course_id: courseId,
          input_creator_id: normalizedCreatorId,
          input_student_id: student?.id || null,
          input_enrollment_id: enrollmentId,
          input_payment_id: paymentRecordId,
        }
      )

      if (redemptionError) throw redemptionError

      const redemption = redemptionRows?.[0]
      if (!redemption?.success) {
        throw new Error(redemption?.reason || 'Coupon redemption failed')
      }
    }

    await maybeSendCreatorSaleEmail({
      creatorId: normalizedCreatorId,
      courseId,
      paymentRecordId,
      courseName: course.name,
      amount: pricing.finalAmount,
      buyerName: studentName,
      buyerEmail: studentEmail,
    })

    await maybeSendCreatorEnrollmentEmail({
      creatorId: normalizedCreatorId,
      courseId,
      paymentRecordId,
      courseName: course.name,
      studentName,
      studentEmail,
      studentPhone,
    })

    await maybeSendStudentReceiptEmail({
      studentEmail,
      studentName,
      studentId: student?.id || null,
      creatorId: normalizedCreatorId,
      courseId,
      paymentRecordId,
      courseName: course.name,
      amount: pricing.finalAmount,
      discountAmount: pricing.discountAmount,
      providerPaymentId: razorpay_payment_id,
    })

    const creatorProfile = await firstRow(
      supabase
        .from('creators')
        .select('telegram_bot_username, name')
        .eq('id', normalizedCreatorId)
    )

    await maybeSendStudentWelcomeEmail({
      studentEmail,
      studentName,
      studentId: student?.id || null,
      creatorId: normalizedCreatorId,
      courseId,
      paymentRecordId,
      courseName: course.name,
      creatorName: course.host_name || creatorProfile?.name,
      telegramBotUsername: creatorProfile?.telegram_bot_username,
    })

    return NextResponse.json({ success: true, alreadyEnrolled: false })
  } catch (err: any) {
    console.error('[razorpay/verify]', err)
    return NextResponse.json(
      { error: err.message || 'Payment verification failed' },
      { status: 500 }
    )
  }
}
