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

    // Check if student already has an enrollment for this course
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenData.course_slug)
    const { data: courseRows } = await supabase
      .from('courses')
      .select('id')
      .eq(isUuid ? 'id' : 'slug', tokenData.course_slug)
      .limit(1)
    const resolvedCourseId = courseRows?.[0]?.id || tokenData.course_slug

    const { data: existingRows } = await supabase
      .from('enrollments')
      .select('*')
      .eq('phone', tokenData.student_phone)
      .eq('course_uuid', resolvedCourseId)
      .limit(1)
    const existing = existingRows?.[0]

    if (existing) {
      // If the token has a payment_id, upgrade the existing enrollment to paid
      if (tokenData.payment_id) {
        await supabase
          .from('enrollments')
          .update({
            payment_status: 'paid',
            payment_id: tokenData.payment_id,
          })
          .eq('id', existing.id)
      }
    } else {
      // Create new enrollment
      await supabase.from('enrollments').insert({
        phone: tokenData.student_phone,
        course_uuid: resolvedCourseId,
        current_lesson: 1,
        payment_id: tokenData.payment_id || null,
        payment_status: tokenData.payment_id ? 'paid' : 'free',
        student_name: tokenData.student_name,
        creator_id: tokenData.creator_id || null,
      })
    }

    return NextResponse.json({
      valid: true,
      studentName: tokenData.student_name,
      courseSlug: tokenData.course_slug,
      courseId: resolvedCourseId,
      studentPhone: tokenData.student_phone,
    })

  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message })
  }
}
