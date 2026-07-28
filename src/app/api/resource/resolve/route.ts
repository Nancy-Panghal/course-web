/**
 * src/app/api/resource/resolve/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Server-side counterpart to /resource/[lessonId]. That page is a
 * client component and can never hold LESSON_LINK_SECRET, so it can't
 * verify the identity/exp/sig params a WhatsApp link carries on its
 * own — it was previously just ignoring them and requiring a logged-in
 * Supabase session instead, which silently broke quiz-score saving
 * (and the "previous attempt" banner) for phone-only WhatsApp students.
 *
 * This route verifies the signature (via lib/signer.ts, same secret
 * used by the WhatsApp bot's signResourceUrl), then resolves the
 * enrollment by phone so the client page can proceed exactly like a
 * logged-in student would.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLessonResourceUrl } from '@/lib/signer'
import { normalizePhone } from '@/lib/phone'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const lessonId = params.get('lessonId') || ''

    if (!lessonId) {
      return NextResponse.json({ valid: false, error: 'lessonId required' }, { status: 400 })
    }

    const verified = verifyLessonResourceUrl(lessonId, params)
    if (!verified.valid) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired link' }, { status: 403 })
    }

    const { data: lesson } = await supabase
      .from('lessons')
      .select('id, course_id')
      .eq('id', lessonId)
      .maybeSingle()

    if (!lesson) {
      return NextResponse.json({ valid: false, error: 'Lesson not found' }, { status: 404 })
    }

    const phone = normalizePhone(verified.identity) || verified.identity

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, quiz_results')
      .eq('course_uuid', lesson.course_id)
      .eq('phone', phone)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!enrollment) {
      // Signature is valid but no enrollment matches — most likely the
      // student's phone changed or the course_id on the lesson doesn't
      // match. Quiz can still be taken; the score just won't save.
      return NextResponse.json({ valid: true, enrollmentId: null, previousResult: null })
    }

    const quizResults: any[] = Array.isArray(enrollment.quiz_results) ? enrollment.quiz_results : []
    const prev = quizResults.find((r: any) => r.lessonId === lessonId) || null

    return NextResponse.json({
      valid: true,
      enrollmentId: enrollment.id,
      previousResult: prev ? { score: prev.score, total: prev.total } : null,
    })
  } catch (err: any) {
    console.error('[resource/resolve]', err.message)
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 })
  }
}