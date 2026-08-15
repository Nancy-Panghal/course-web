import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Lets a creator try real WhatsApp/Telegram delivery on their own course
 * before paying — using ONE reusable test-student identity per creator,
 * shared across all their courses (never a separate identity per course).
 *
 * Every call: (1) confirms the course actually belongs to the calling
 * creator — critical, otherwise anyone could free-test-enroll into someone
 * else's course; (2) overwrites the creator's saved test-student details
 * with whatever was just submitted; (3) finds or creates the ONE test
 * enrollment for this course.
 */
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const creatorId = userData.user.id

    const { courseId, name, phone, telegramUsername } = await req.json()
    if (!courseId || (!phone && !telegramUsername)) {
      return NextResponse.json({ error: 'Enter at least a phone number or Telegram username.' }, { status: 400 })
    }

    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, creator_id, delivery')
      .eq('id', courseId)
      .maybeSingle()
    if (courseErr) throw courseErr
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    if (course.creator_id !== creatorId) {
      return NextResponse.json({ error: 'You can only test your own courses.' }, { status: 403 })
    }

    // Save/overwrite the one test-student identity for this creator.
    const { error: upsertErr } = await supabase
      .from('creator_test_students')
      .upsert({ creator_id: creatorId, name: name || null, phone: phone || null, telegram_username: telegramUsername || null, updated_at: new Date().toISOString() }, { onConflict: 'creator_id' })
    if (upsertErr) throw upsertErr

    // Find or create the test enrollment for this specific course. Only
    // ever one per course, matched on is_test=true, since a creator has
    // exactly one test-student identity.
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_uuid', courseId)
      .eq('is_test', true)
      .maybeSingle()

    let enrollmentId: string
    if (existing) {
      const { error: updateErr } = await supabase
        .from('enrollments')
        .update({ phone: phone || null, certificate_student_name: name || null })
        .eq('id', existing.id)
      if (updateErr) throw updateErr
      enrollmentId = existing.id
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('enrollments')
        .insert({
          course_uuid: courseId,
          creator_id: creatorId,
          phone: phone || null,
          certificate_student_name: name || null,
          current_lesson: 1,
          completed_lessons: [],
          quiz_results: [],
          payment_status: 'paid',
          payment_id: 'TEST',
          amount_paid: 0,
          is_test: true,
        })
        .select('id')
        .single()
      if (insertErr) throw insertErr
      enrollmentId = inserted.id
    }

    return NextResponse.json({
      enrollmentId,
      courseDelivery: course.delivery || 'both',
    })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/test-enroll POST')
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('creator_test_students')
      .select('name, phone, telegram_username')
      .eq('creator_id', userData.user.id)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ testStudent: data || null })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/test-enroll GET')
  }
}
