// Landing for email access links.
//
//   GET  /api/web-access/email?t=<token>[&lesson=N]
//        Shows a "Continue" page. Reads only — it never redeems the link, so mail
//        scanners that open every URL in a message can't use it up.
//   POST /api/web-access/email   (the Continue button)
//        Redeems the single-use token, starts the 7-day web session, redirects to the course.
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getWebAccessContext } from '@/lib/webAccess'
import {
  SESSION_DAYS,
  courseDestination,
  getEmailHintForToken,
  hashToken,
  isTokenShape,
  parseLessonHint,
} from '@/lib/emailAccess'
import { continuePage, expiredEmailPage, messagePage } from '@/lib/accessPages'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function expired(token: string | null, lessonNum: number | null) {
  const hint = await getEmailHintForToken(supabase, token)
  return expiredEmailPage({ token: hint ? token : null, masked: hint?.masked ?? null, lessonNum })
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('t')
  const lessonNum = parseLessonHint(req.nextUrl.searchParams.get('lesson'))
  if (!isTokenShape(raw)) return expiredEmailPage({})

  const { data: row } = await supabase
    .from('web_bootstrap_tokens')
    .select('id, course_id, used_at, expires_at')
    .eq('token_hash', hashToken(raw))
    .maybeSingle()
  if (!row) return expiredEmailPage({})

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, host_name')
    .eq('id', row.course_id)
    .maybeSingle()
  if (!course) return expiredEmailPage({})

  // Already signed in to THIS course in this browser (valid session, still paid): straight in.
  const context = await getWebAccessContext(req)
  if (context && context.courseId === row.course_id) {
    const res = NextResponse.redirect(new URL(courseDestination(course, lessonNum), req.url))
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    return res
  }

  const usable = !row.used_at && new Date(row.expires_at).getTime() > Date.now()
  if (!usable) return expired(raw, lessonNum)

  return continuePage({ courseName: course.name || 'your course', token: raw, lessonNum })
}

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
    return expiredEmailPage({})
  }
  if (!isTokenShape(raw)) return expiredEmailPage({})

  const tokenHash = hashToken(raw)
  const now = new Date().toISOString()

  const { data: bootstrap } = await supabase
    .from('web_bootstrap_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle()
  if (!bootstrap) return expired(raw, lessonNum)

  // Same re-check as the Telegram route: the enrollment must still be paid, for this course.
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, course_uuid, student_id, payment_status')
    .eq('id', bootstrap.enrollment_id)
    .eq('course_uuid', bootstrap.course_id)
    .eq('payment_status', 'paid')
    .maybeSingle()
  if (!enrollment) return messagePage('Access unavailable', 'A paid enrollment is required to open this course.', 403)

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, host_name')
    .eq('id', bootstrap.course_id)
    .maybeSingle()
  if (!course) return messagePage('Course not found', 'This course is no longer available.', 404)

  const sessionToken = randomBytes(32).toString('hex')
  const sessionExpiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Atomic one-time consumption.
  const { data: consumed } = await supabase
    .from('web_bootstrap_tokens')
    .update({ used_at: now, session_token_hash: hashToken(sessionToken), session_expires_at: sessionExpiresAt })
    .eq('id', bootstrap.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()
  if (!consumed) return expired(raw, lessonNum)

  const response = NextResponse.redirect(new URL(courseDestination(course, lessonNum), req.url), 303)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  response.headers.set('Pragma', 'no-cache')
  response.cookies.set('kurso_web_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(sessionExpiresAt),
  })
  return response
}