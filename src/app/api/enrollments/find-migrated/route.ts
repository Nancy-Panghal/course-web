import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Public, unauthenticated lookup used by /claim/telegram.
 *
 * A migrated student has no Kurso login — this is the only way for them
 * to identify themselves before we hand them a Telegram start-token.
 * Deliberately returns a generic "not found" for every failure mode
 * (wrong course, no paid enrollment, wrong identifier) rather than
 * distinguishing them, so this can't be used to enumerate who bought a
 * given course.
 */
export async function POST(req: NextRequest) {
  try {
    const { courseId, phone, email } = await req.json()
    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 })

    const normalizedPhone = normalizePhone(phone || '')
    const cleanEmail = (email || '').trim().toLowerCase() || null
    const phoneOrEmail = normalizedPhone || cleanEmail
    if (!phoneOrEmail) {
      return NextResponse.json({ found: false })
    }

    const { data: course } = await supabase
      .from('courses')
      .select('id, name, delivery, creator_id')
      .eq('id', courseId)
      .maybeSingle()
    if (!course) return NextResponse.json({ found: false })

    if (course.delivery === 'whatsapp') {
      return NextResponse.json({
        found: false,
        reason: 'This course delivers lessons over WhatsApp, not Telegram — just message the WhatsApp number directly.',
      })
    }

    let enrollment = await supabase
      .from('enrollments')
      .select('id, student_id, telegram_chat_id, certificate_student_name, phone, payment_id, delivery_method')
      .eq('course_uuid', courseId)
      .eq('phone', phoneOrEmail)
      .eq('payment_status', 'paid')
      .maybeSingle()
      .then(r => r.data)

    // Fall back to matching via the students table, in case this
    // enrollment's phone column doesn't line up exactly (e.g. an older
    // record from before the phone-normalization fix).
    if (!enrollment) {
      let student: { id: string } | null = null
      if (normalizedPhone) {
        student = await supabase.from('students').select('id').eq('phone', normalizedPhone).maybeSingle().then(r => r.data)
      }
      if (!student && cleanEmail) {
        student = await supabase.from('students').select('id').eq('email', cleanEmail).maybeSingle().then(r => r.data)
      }
      if (student) {
        enrollment = await supabase
          .from('enrollments')
          .select('id, student_id, telegram_chat_id, certificate_student_name, phone, payment_id, delivery_method')
          .eq('course_uuid', courseId)
          .eq('student_id', student.id)
          .eq('payment_status', 'paid')
          .maybeSingle()
          .then(r => r.data)
      }
    }

    if (!enrollment) return NextResponse.json({ found: false })

    const { data: creator } = await supabase
      .from('creators')
      .select('telegram_bot_username')
      .eq('id', course.creator_id)
      .maybeSingle()

    const telegramBotUsername =
      (creator?.telegram_bot_username || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').replace('@', '')

    if (!telegramBotUsername) {
      return NextResponse.json({ found: false, reason: 'Telegram delivery is not set up for this course yet.' })
    }

    return NextResponse.json({
      found: true,
      alreadyLinked: Boolean(enrollment.telegram_chat_id),
      enrollmentId: enrollment.id,
      creatorId: course.creator_id,
      courseId: course.id,
      courseName: course.name,
      studentName: enrollment.certificate_student_name || null,
      studentPhone: normalizedPhone || null,
      studentEmail: cleanEmail,
      paymentId: enrollment.payment_id || null,
      telegramBotUsername,
    })
  } catch (err: any) {
    console.error('[enrollments/find-migrated] POST failed:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}