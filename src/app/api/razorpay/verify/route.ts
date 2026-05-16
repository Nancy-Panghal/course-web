import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

async function fetchRazorpayPayment(paymentId: string) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Unable to verify payment with Razorpay')
  }

  return res.json()
}

async function firstRow(query: any) {
  const { data, error } = await query.limit(1)
  if (error) throw error
  return data?.[0] || null
}

export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      studentId,
      studentEmail,
      studentName,
      studentPhone,
      creatorId,
      courseId,
    } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !courseId) {
      return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 })
    }

    if (!studentPhone && !studentEmail) {
      return NextResponse.json({ error: 'Missing student contact details' }, { status: 400 })
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (!safeCompare(expectedSignature, razorpay_signature)) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    const course = await firstRow(
      supabase
        .from('courses')
        .select('id, price, creator_id')
        .eq('id', courseId)
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
      return NextResponse.json({ error: 'Payment details did not match the course order' }, { status: 400 })
    }

    const normalizedCreatorId = creatorId || course.creator_id || null
    const phoneOrEmail = studentPhone || studentEmail

    let student = studentId
      ? await firstRow(supabase.from('students').select('id').eq('auth_id', studentId))
      : null

    if (!student && studentEmail) {
      student = await firstRow(supabase.from('students').select('id').eq('email', studentEmail))
    }

    if (!student) {
      const { data: insertedStudent, error: studentError } = await supabase
        .from('students')
        .insert({
          email: studentEmail,
          name: studentName,
          phone: studentPhone,
          auth_id: studentId || null,
        })
        .select('id')
        .limit(1)

      if (studentError) throw studentError
      student = insertedStudent?.[0] || null
    } else {
      await supabase
        .from('students')
        .update({
          email: studentEmail,
          name: studentName,
          phone: studentPhone,
          auth_id: studentId || null,
        })
        .eq('id', student.id)
    }

    const enrollmentByStudent = student?.id
      ? await firstRow(
          supabase
            .from('enrollments')
            .select('id, payment_status')
            .eq('course_uuid', courseId)
            .eq('student_id', student.id)
        )
      : null

    const enrollmentByPhone = !enrollmentByStudent && phoneOrEmail
      ? await firstRow(
          supabase
            .from('enrollments')
            .select('id, payment_status')
            .eq('course_uuid', courseId)
            .eq('phone', phoneOrEmail)
        )
      : null

    const existingEnrollment = enrollmentByStudent || enrollmentByPhone
    const enrollmentPayload = {
      phone: phoneOrEmail,
      course_uuid: courseId,
      current_lesson: 1,
      student_id: student?.id || null,
      creator_id: normalizedCreatorId,
      amount_paid: Number(course.price),
      payment_id: razorpay_payment_id,
      payment_status: 'paid',
    }

    if (existingEnrollment) {
      const { error: updateError } = await supabase
        .from('enrollments')
        .update(enrollmentPayload)
        .eq('id', existingEnrollment.id)

      if (updateError) throw updateError
      return NextResponse.json({ success: true, alreadyEnrolled: existingEnrollment.payment_status === 'paid' })
    }

    const { error: insertError } = await supabase
      .from('enrollments')
      .insert(enrollmentPayload)

    if (insertError) throw insertError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Verify error:', err)
    return NextResponse.json({ error: err.message || 'Payment verification failed' }, { status: 500 })
  }
}
