/**
 * src/app/api/content/sign/route.ts
 * Fixed: BUG 7 — web access was not logged to lesson_access_logs
 * Fixed: auth token properly extracted from header
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { signVideoUrl, signPdfUrl, TTL } from '@/lib/signer'
import { isLessonFree } from '@/lib/freeLesson'
import { getWebAccessContext } from '@/lib/webAccess'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { lessonId, type } = await req.json()

    if (!lessonId || !type) {
      return NextResponse.json({ error: 'lessonId and type required' }, { status: 400 })
    }

    // Get user from Authorization header
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    let userId = 'web'
    let webUserId: string | null = null

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        userId = user.id
        webUserId = user.id
      }
    }

    const webAccess = await getWebAccessContext(req)

    // Verify lesson exists and is published
    const { data: lesson } = await supabase
      .from('lessons')
      .select('id, is_published, content_type, course_id, order_num, is_free')
      .eq('id', lessonId)
      .single()

    if (!lesson || !lesson.is_published) {
      console.warn('[content/sign] lesson_not_found_or_unpublished', { lessonId, found: !!lesson, isPublished: lesson?.is_published })
      return NextResponse.json({ error: 'Lesson not found', reason: 'lesson_not_found' }, { status: 404 })
    }

    // ── verify enrollment once here, then return direct signed URL ──
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('is_free_course')
      .eq('id', lesson.course_id)
      .single()

    if (courseErr) {
      console.error('[content/sign] course_lookup_failed', { lessonId, courseId: lesson.course_id, message: courseErr.message })
    }

    const isFree = isLessonFree(
      { is_free: lesson.is_free ?? false },
      { is_free_course: course?.is_free_course ?? false }
    )

    // Two independent ways a request can prove access to this lesson:
    //   (a) a valid kurso_web_session cookie (bot-issued, no Kurso login) for THIS course
    //   (b) a Supabase Auth Bearer token whose linked student has a paid enrollment in THIS course
    // A browser can carry both at once (e.g. a bot-linked session cookie plus an
    // unrelated Supabase Auth session for a different account) — previously, the
    // mere presence of a Bearer token made the code check ONLY path (b) and
    // ignore a perfectly valid path (a), incorrectly denying access. Now we
    // check both and grant access if either succeeds.
    let hasAccess = isFree

    const webAccessOk = !!(webAccess && webAccess.courseId === lesson.course_id)
    if (webAccessOk) hasAccess = true

    if (!hasAccess && userId !== 'web') {
      // Single query — check enrollment by student auth_id join
      const { data: student, error: studentErr } = await supabase
        .from('students')
        .select('id')
        .eq('auth_id', userId)
        .limit(1)
        .single()

      if (studentErr) {
        console.warn('[content/sign] student_lookup_missing_or_failed', { lessonId, userId, message: studentErr.message })
      }

      const { data: enrollment, error: enrollmentErr } = student?.id ? await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', student.id)
        .eq('course_uuid', lesson.course_id)
        .eq('payment_status', 'paid')
        .limit(1)
        .single() : { data: null, error: null }

      if (enrollmentErr) {
        console.warn('[content/sign] enrollment_lookup_missing_or_failed', { lessonId, studentId: student?.id, courseId: lesson.course_id, message: enrollmentErr.message })
      }

      if (enrollment) hasAccess = true
    }

    if (!hasAccess) {
      console.warn('[content/sign] denied_no_access', {
        lessonId, courseId: lesson.course_id, userId,
        hadWebAccess: !!webAccess,
        webAccessCourseId: webAccess?.courseId,
      })
      return NextResponse.json({ error: 'Not enrolled', reason: 'no_access' }, { status: 403 })
    }

    

    // Log access for piracy detection (web path)
    // Fire and forget — never block content delivery for logging
    void supabase.from('lesson_access_logs').insert({
      lesson_id: lessonId,
      course_id: lesson.course_id,
      web_user_id: webUserId,
      source: 'web',
      accessed_at: new Date().toISOString(),
    }).then(() => {}, () => {})

    // Which identity gets baked into the signed URL matters just as much as
    // whether access was granted: /api/video/stream and /api/pdf/view each
    // re-derive access from this identity independently, and only consult
    // the kurso_web_session cookie when identity is exactly 'web'. If access
    // was actually granted via the cookie (webAccessOk), we must sign as
    // 'web' — signing with a Bearer-token UUID that has no matching
    // student/enrollment would pass this check but then fail downstream.
    const identityForSigning = webAccessOk ? 'web' : userId

    // Generate signed URL
    const ttlMs = type === 'pdf' ? TTL.PDF : TTL.VIDEO
    const url = type === 'pdf'
      ? signPdfUrl(lessonId, identityForSigning)
      : signVideoUrl(lessonId, identityForSigning)

    return NextResponse.json({ url, expiresAt: new Date(Date.now() + ttlMs).toISOString() })
  } catch (err: any) {
    console.error('[content/sign] unhandled_error', err.message, err.stack)
    return NextResponse.json({ error: 'Server error', reason: 'unhandled_error' }, { status: 500 })
  }
}