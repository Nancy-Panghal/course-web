import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side DB writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      amount,
    } = await req.json()

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // Check if student exists, create if not
    let studentDbId: string | null = null

    const { data: existingStudent } = await supabase
      .from('students')
      .select('id')
      .eq('email', studentEmail)
      .single()

    if (existingStudent) {
      studentDbId = existingStudent.id
    } else {
      const { data: newStudent } = await supabase
        .from('students')
        .insert({
          email: studentEmail,
          name: studentName,
          phone: studentPhone,
          auth_id: studentId || null,
        })
        .select('id')
        .single()
      studentDbId = newStudent?.id || null
    }

    // Check not already enrolled
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('phone', studentPhone || studentEmail)
      .single()

    if (existingEnrollment) {
      return NextResponse.json({ success: true, alreadyEnrolled: true })
    }

    // Create enrollment
    await supabase.from('enrollments').insert({
      phone: studentPhone || studentEmail,
      course_uuid: courseId || null,
      current_lesson: 1,
      student_id: studentDbId,
      creator_id: creatorId || null,
      amount_paid: amount,
      payment_id: razorpay_payment_id,
      payment_status: 'paid',
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Verify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}