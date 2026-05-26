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
      supabase.from('courses').select('id, price, creator_id').eq('id', courseId)
    )
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const expectedAmount = Math.round(Number(course.price) * 100)
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

    if (existingEnrollment) {
      // Update to paid — preserve telegram_chat_id and progress if they exist
      const { error: updateErr } = await supabase
        .from('enrollments')
        .update({
          payment_status: 'paid',
          payment_id: razorpay_payment_id,
          amount_paid: Number(course.price),
          student_id: student?.id || null,
          creator_id: normalizedCreatorId,
          phone: phoneOrEmail,
          last_web_sync: now,
          // Preserve telegram_chat_id — don't overwrite if bot already linked it
          // Preserve current_lesson and completed_lessons from bot progress
        })
        .eq('id', existingEnrollment.id)

      if (updateErr) throw updateErr

      const alreadyPaid = existingEnrollment.payment_status === 'paid'
      return NextResponse.json({ success: true, alreadyEnrolled: alreadyPaid })
    }

    // ── 6. Create new enrollment ──────────────────────────────────
    const { error: insertEnrollErr } = await supabase
      .from('enrollments')
      .insert({
        phone: phoneOrEmail,
        course_uuid: courseId,
        current_lesson: 1,
        student_id: student?.id || null,
        creator_id: normalizedCreatorId,
        amount_paid: Number(course.price),
        payment_id: razorpay_payment_id,
        payment_status: 'paid',
        completed_lessons: [],
        quiz_results: [],
        last_web_sync: now,
      })

    if (insertEnrollErr) throw insertEnrollErr

    return NextResponse.json({ success: true, alreadyEnrolled: false })
  } catch (err: any) {
    console.error('[razorpay/verify]', err)
    return NextResponse.json(
      { error: err.message || 'Payment verification failed' },
      { status: 500 }
    )
  }
}