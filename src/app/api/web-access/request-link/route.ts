// "Email me a new link" — from the expired-link pages.
//
// The student never types an address. The dead link identifies a paid enrollment,
// and the new link goes ONLY to the email already on file for it. Throttled per
// enrollment so nobody can use this to spam a student's inbox.
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLoggedEmail } from '@/lib/email'
import {
  createEmailAccessUrl,
  getEnrollmentEmail,
  hashToken,
  isRequestRateLimited,
  isTokenShape,
  maskEmail,
  parseLessonHint,
  renderNewLinkEmail,
} from '@/lib/emailAccess'
import { messagePage } from '@/lib/accessPages'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COULD_NOT = () =>
  messagePage('We couldn’t send a new link', 'Please ask for a new link from where you originally received this one.', 400)

export async function POST(req: NextRequest) {
  let raw: string | null = null
  let lessonNum: number | null = null
  try {
    const form = await req.formData()
    const t = form.get('t')
    raw = typeof t === 'string' ? t : null
    const l = form.get('lesson')
    lessonNum = parseLessonHint(typeof l === 'string' ? l : null)
  } catch {
    return COULD_NOT()
  }
  if (!isTokenShape(raw)) return COULD_NOT()

  // The dead link tells us which enrollment this is about. Any state: used/expired is the point.
  const { data: row } = await supabase
    .from('web_bootstrap_tokens')
    .select('course_id, enrollment_id')
    .eq('token_hash', hashToken(raw))
    .maybeSingle()
  if (!row) return COULD_NOT()

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, course_uuid, student_id, student_email, creator_id, payment_status')
    .eq('id', row.enrollment_id)
    .eq('course_uuid', row.course_id)
    .eq('payment_status', 'paid')
    .maybeSingle()
  if (!enrollment) return COULD_NOT()

  const { email, name } = await getEnrollmentEmail(supabase, enrollment)
  if (!email) return COULD_NOT()

  if (await isRequestRateLimited(supabase, enrollment.id)) {
    return messagePage(
      'Please check your inbox',
      'We sent you links a moment ago. Check your inbox and spam folder, or try again in an hour.',
      429
    )
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, creator_id')
    .eq('id', enrollment.course_uuid)
    .maybeSingle()
  if (!course) return COULD_NOT()

  let created: { url: string; tokenHash: string }
  try {
    created = await createEmailAccessUrl(supabase, {
      courseId: course.id,
      enrollmentId: enrollment.id,
      studentId: enrollment.student_id,
      lessonNum,
    })
  } catch (err) {
    console.error('[request-link] could not create token', err)
    return COULD_NOT()
  }

  const { subject, html } = renderNewLinkEmail({ studentName: name, courseName: course.name || 'your course', link: created.url })
  const result = await sendLoggedEmail({
    supabase,
    emailType: 'student_access_link',
    to: email,
    subject,
    html,
    creatorId: enrollment.creator_id || course.creator_id || null,
    studentId: enrollment.student_id || null,
    courseId: course.id,
    metadata: { enrollment_id: enrollment.id, reason: 'requested_new_link' },
  })

  if (!result.sent) {
    // Don't let a failed send count against the student's throttle.
    await supabase.from('web_bootstrap_tokens').delete().eq('token_hash', created.tokenHash)
    return COULD_NOT()
  }

  return messagePage('Check your inbox', `We've emailed a new link to ${maskEmail(email)}. It works once and lasts 24 hours.`)
}