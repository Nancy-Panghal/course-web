import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { token, senderPhone } = await req.json()

    if (!token || !senderPhone) {
      return NextResponse.json({ valid: false, error: 'Missing token or phone' })
    }

    // Find the token
    const { data: tokenData, error } = await supabase
      .from('whatsapp_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !tokenData) {
      return NextResponse.json({ valid: false, error: 'Token not found' })
    }

    // Check if already used
    if (tokenData.used) {
      return NextResponse.json({ valid: false, error: 'Token already used' })
    }

    // Check expiry
    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Token expired' })
    }

    // Check sender phone matches
    // Normalize both numbers — remove +, spaces, dashes
    const normalize = (p: string) => p.replace(/[\s+\-()]/g, '')
    const storedPhone = normalize(tokenData.student_phone)
    const incomingPhone = normalize(senderPhone)

    if (!incomingPhone.includes(storedPhone.slice(-10)) &&
        !storedPhone.includes(incomingPhone.slice(-10))) {
      return NextResponse.json({ valid: false, error: 'Phone number mismatch' })
    }

    // Mark token as used
    await supabase
      .from('whatsapp_tokens')
      .update({ used: true })
      .eq('id', tokenData.id)

    // Enroll student if not already enrolled
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('phone', tokenData.student_phone)
      .eq('course_id', tokenData.course_slug)
      .single()

    if (!existing) {
      await supabase.from('enrollments').insert({
        phone: tokenData.student_phone,
        course_id: tokenData.course_slug,
        current_lesson: 1,
        payment_id: tokenData.payment_id,
        payment_status: 'paid',
      })
    }

    return NextResponse.json({
      valid: true,
      studentName: tokenData.student_name,
      courseSlug: tokenData.course_slug,
      studentPhone: tokenData.student_phone,
    })

  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message })
  }
}