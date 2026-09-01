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
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // ── verify enrollment once here, then return direct signed URL ──
    const { data: course } = await supabase
      .from('courses')
      .select('is_free_course')
      .eq('id', lesson.course_id)
      .single()

    const isFree = isLessonFree(
      { is_free: lesson.is_free ?? false },
      { is_free_course: course?.is_free_course ?? false }
    )

    if (!isFree && userId === 'web' && !webAccess) {
  return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
}

if (
  !isFree &&
  webAccess &&
  webAccess.courseId !== lesson.course_id
) {
  return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
}
    if (!isFree && userId !== 'web') {
      // Single query — check enrollment by student auth_id join
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('auth_id', userId)
        .limit(1)
        .single()

      const { data: enrollment } = student?.id ? await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', student.id)
        .eq('course_uuid', lesson.course_id)
        .eq('payment_status', 'paid')
        .limit(1)
        .single() : { data: null }

      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
      }
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

    // Generate signed URL
    const ttlMs = type === 'pdf' ? TTL.PDF : TTL.VIDEO
    const url = type === 'pdf'
      ? signPdfUrl(lessonId, userId)
      : signVideoUrl(lessonId, userId)

    return NextResponse.json({ url, expiresAt: new Date(Date.now() + ttlMs).toISOString() })
  } catch (err: any) {
    console.error('[content/sign]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
