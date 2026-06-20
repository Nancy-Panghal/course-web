import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { escapeHtml, sendLoggedEmail } from '@/lib/email'
import { slugify } from '@/lib/utils'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function firstRow(query: any): Promise<any | null> {
  const { data, error } = await query.limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-razorpay-signature')
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
    let body: any

    if (secret && signature) {
      const rawBody = await req.text()
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex')

      if (!safeCompare(expectedSig, signature)) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
      }
      body = JSON.parse(rawBody)
    } else {
      if (!secret) {
        console.warn('RAZORPAY_WEBHOOK_SECRET is not configured. Webhook signature verification skipped.')
      }
      body = await req.json()
    }

    // Only process payment.captured event
    if (body.event !== 'payment.captured') {
      return NextResponse.json({ success: true, message: `Ignored event: ${body.event}` })
    }

    const paymentEntity = body.payload?.payment?.entity
    if (!paymentEntity) {
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 })
    }

    const razorpay_payment_id = paymentEntity.id
    const razorpay_order_id = paymentEntity.order_id
    const email = paymentEntity.email
    const phone = paymentEntity.contact
    const notes = paymentEntity.notes || {}
    const courseId = notes.courseId

    if (!courseId) {
      return NextResponse.json({ error: 'Missing courseId in payment notes' }, { status: 400 })
    }

    // 1. Get Course details
    const course = await firstRow(
      supabaseAdmin
        .from('courses')
        .select('id, name, price, creator_id, host_name, is_published')
        .eq('id', courseId)
    )
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const finalAmount = notes.finalAmount ? Number(notes.finalAmount) : course.price
    const originalAmount = notes.originalAmount ? Number(notes.originalAmount) : course.price
    const discountAmount = notes.discountAmount ? Number(notes.discountAmount) : 0
    const couponId = notes.couponId || null
    const couponCode = notes.couponCode || null
    const normalizedCreatorId = course.creator_id

    // Clean phone number (e.g. "+91 99999-99999" -> "919999999999")
    const cleanedPhone = phone ? String(phone).trim().replace(/\D/g, '') : null
    const phoneOrEmail = cleanedPhone || email!

    // 2. Fetch auth user ID by email to map auth_id if it exists
    let authId: string | null = null
    let studentName: string | null = null

    if (email) {
      try {
        const { data: authUsers } = await supabaseAdmin
          .schema('auth')
          .from('users')
          .select('id, raw_user_meta_data')
          .eq('email', email)
          .limit(1)
        if (authUsers?.[0]?.id) {
          authId = authUsers[0].id
          const meta = authUsers[0].raw_user_meta_data || {}
          studentName = meta.full_name || meta.name || null
        }
      } catch (e) {
        console.warn('Could not query auth.users schema directly in webhook:', e)
      }
    }

    // 3. Find or Upsert student record
    let student: any = null
    if (authId) {
      student = await firstRow(
        supabaseAdmin.from('students').select('*').eq('auth_id', authId)
      )
    }
    if (!student && email) {
      student = await firstRow(
        supabaseAdmin.from('students').select('*').eq('email', email)
      )
    }
    if (!student && phoneOrEmail) {
      student = await firstRow(
        supabaseAdmin.from('students').select('*').eq('phone', phoneOrEmail)
      )
    }

    if (student) {
      const { data: updatedStudent, error: updateErr } = await supabaseAdmin
        .from('students')
        .update({
          email: email || undefined,
          phone: cleanedPhone || undefined,
          auth_id: authId || undefined,
          name: studentName || student.name || undefined,
        })
        .eq('id', student.id)
        .select('*')
        .single()
      if (!updateErr && updatedStudent) {
        student = updatedStudent
      }
    } else {
      const { data: insertedStudent, error: insertErr } = await supabaseAdmin
        .from('students')
        .insert({
          email: email || null,
          phone: cleanedPhone || null,
          auth_id: authId || null,
          name: studentName || null,
        })
        .select('*')
        .single()
      if (insertErr) throw insertErr
      student = insertedStudent
    }

    // 4. Find existing enrollment
    let existingEnrollment: any = null
    if (student?.id) {
      existingEnrollment = await firstRow(
        supabaseAdmin
          .from('enrollments')
          .select('*')
          .eq('course_uuid', courseId)
          .eq('student_id', student.id)
      )
    }
    if (!existingEnrollment && phoneOrEmail) {
      existingEnrollment = await firstRow(
        supabaseAdmin
          .from('enrollments')
          .select('*')
          .eq('course_uuid', courseId)
          .eq('phone', phoneOrEmail)
      )
    }

    let enrollmentId: string | null = null
    const now = new Date().toISOString()

    if (existingEnrollment) {
      enrollmentId = existingEnrollment.id
      if (existingEnrollment.payment_status === 'paid') {
        return NextResponse.json({ success: true, message: 'Enrollment already active' })
      }

      const { error: updateErr } = await supabaseAdmin
        .from('enrollments')
        .update({
          payment_status: 'paid',
          payment_id: razorpay_payment_id,
          amount_paid: finalAmount,
          student_id: student?.id || null,
          creator_id: normalizedCreatorId,
          phone: phoneOrEmail,
          last_web_sync: now,
          coupon_id: couponId,
        })
        .eq('id', existingEnrollment.id)

      if (updateErr) throw updateErr
    } else {
      const { data: insertedEnrollment, error: insertEnrollErr } = await supabaseAdmin
        .from('enrollments')
        .insert({
          phone: phoneOrEmail,
          course_uuid: courseId,
          current_lesson: 1,
          student_id: student?.id || null,
          creator_id: normalizedCreatorId,
          amount_paid: finalAmount,
          payment_id: razorpay_payment_id,
          payment_status: 'paid',
          completed_lessons: [],
          quiz_results: [],
          last_web_sync: now,
          coupon_id: couponId,
        })
        .select('id')
        .single()

      if (insertEnrollErr) throw insertEnrollErr
      enrollmentId = insertedEnrollment?.id || null
    }

    // 5. Create Payment record idempotently
    const existingPayment = await firstRow(
      supabaseAdmin
        .from('payments')
        .select('id')
        .eq('provider', 'razorpay')
        .eq('provider_payment_id', razorpay_payment_id)
    )

    let paymentRecordId = existingPayment?.id || null

    if (!paymentRecordId) {
      const { data: paymentRecord, error: paymentInsertError } = await supabaseAdmin
        .from('payments')
        .insert({
          creator_id: normalizedCreatorId,
          course_id: courseId,
          student_id: student?.id || null,
          enrollment_id: enrollmentId,
          provider: 'razorpay',
          provider_payment_id: razorpay_payment_id,
          provider_order_id: razorpay_order_id,
          buyer_name: student?.name || studentName || null,
          buyer_email: email || null,
          buyer_phone: cleanedPhone || null,
          currency: 'INR',
          gross_amount: originalAmount,
          discount_amount: discountAmount,
          net_amount: finalAmount,
          platform_fee: 0,
          creator_earning: finalAmount,
          status: 'paid',
          metadata: {
            source: 'razorpay_webhook',
            coupon_code: couponCode,
            razorpay_status: paymentEntity.status,
          },
          paid_at: now,
        })
        .select('id')
        .single()

      if (paymentInsertError) throw paymentInsertError
      paymentRecordId = paymentRecord?.id || null
    }

    // 6. Redeem coupon if applicable
    if (couponCode && paymentRecordId) {
      try {
        const { data: redemptionRows, error: redemptionError } = await supabaseAdmin.rpc(
          'redeem_coupon_for_payment',
          {
            input_coupon_code: couponCode,
            input_course_id: courseId,
            input_creator_id: normalizedCreatorId,
            input_student_id: student?.id || null,
            input_enrollment_id: enrollmentId,
            input_payment_id: paymentRecordId,
          }
        )

        if (redemptionError) {
          console.error('Webhook coupon redemption error:', redemptionError)
        } else {
          const redemption = redemptionRows?.[0]
          if (!redemption?.success) {
            console.warn('Webhook coupon redemption not successful:', redemption?.reason)
          }
        }
      } catch (err) {
        console.error('Failed to redeem coupon in webhook:', err)
      }
    }

    // 7. Send notification emails
    const resolvedStudentName = student?.name || studentName || email || 'A student'

    await maybeSendCreatorSaleEmail({
      creatorId: normalizedCreatorId,
      courseId,
      paymentRecordId,
      courseName: course.name,
      amount: finalAmount,
      buyerName: resolvedStudentName,
      buyerEmail: email,
    })

    await maybeSendCreatorEnrollmentEmail({
      creatorId: normalizedCreatorId,
      courseId,
      paymentRecordId,
      courseName: course.name,
      studentName: resolvedStudentName,
      studentEmail: email,
      studentPhone: cleanedPhone,
    })

    await maybeSendStudentReceiptEmail({
      studentEmail: email,
      studentName: resolvedStudentName,
      studentId: student?.id || null,
      creatorId: normalizedCreatorId,
      courseId,
      paymentRecordId,
      courseName: course.name,
      amount: finalAmount,
      discountAmount: discountAmount,
      providerPaymentId: razorpay_payment_id,
    })

    const creatorProfile = await firstRow(
      supabaseAdmin
        .from('creators')
        .select('telegram_bot_username, name')
        .eq('id', normalizedCreatorId)
    )

    await maybeSendStudentWelcomeEmail({
      studentEmail: email,
      studentName: resolvedStudentName,
      studentId: student?.id || null,
      creatorId: normalizedCreatorId,
      courseId,
      paymentRecordId,
      courseName: course.name,
      creatorName: course.host_name || creatorProfile?.name,
      telegramBotUsername: creatorProfile?.telegram_bot_username,
    })

    return NextResponse.json({ success: true, message: 'Enrollment active' })

  } catch (err: any) {
    console.error('Razorpay Webhook Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

// ── Email notification helpers ──────────────────────────────────────

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
    const { data } = await supabaseAdmin.auth.admin.getUserById(creatorId)
    const creator = data?.user
    const prefs = creator?.user_metadata?.email_notifications || {}
    if (prefs.paidSale === false || !creator?.email) return

    const safeCourse = escapeHtml(courseName || 'your course')
    const safeBuyer = escapeHtml(buyerName || buyerEmail || 'A student')

    await sendLoggedEmail({
      supabase: supabaseAdmin,
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
    console.error('[webhook-email/creator-sale]', err)
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
    console.error('[webhook-email/creator-enrollment]', err)
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

  try {
    const safeName = escapeHtml(studentName || 'there')
    const safeCourse = escapeHtml(courseName || 'your course')
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

    await sendLoggedEmail({
      supabase: supabaseAdmin,
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
  } catch (err) {
    console.error('[webhook-email/student-receipt]', err)
  }
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

  try {
    const safeName = escapeHtml(studentName || 'there')
    const safeCourse = escapeHtml(courseName || 'your course')
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    const creatorSlug = slugify(creatorName || 'instructor')
    const courseSlug = slugify(courseName || 'course')
    const courseUrl = `${siteUrl}/course/${creatorSlug}/${courseSlug}/${courseId}`
    const cleanBot = telegramBotUsername?.replace('@', '').trim()

    await sendLoggedEmail({
      supabase: supabaseAdmin,
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
              <p style="margin:0">Use the Telegram button on the success screen to link your account with @${escapeHtml(cleanBot)}.</p>
            </div>
          ` : ''}
        </div>
      `,
    })
  } catch (err) {
    console.error('[webhook-email/student-welcome]', err)
  }
}
