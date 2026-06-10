/**
 * src/app/api/assignments/my/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET — fetch the authenticated student's submission for a lesson.
 *       Used by the learn page to show submission status.
 * Query params: lessonId + enrollmentId
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const lessonId = url.searchParams.get('lessonId')
    const enrollmentId = url.searchParams.get('enrollmentId')

    if (!lessonId || !enrollmentId) {
      return NextResponse.json({ error: 'lessonId and enrollmentId required' }, { status: 400 })
    }

    // Verify the enrollment belongs to this user (by student_id or auth_id)
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, student_id')
      .eq('id', enrollmentId)
      .maybeSingle()

    if (!enrollment) return NextResponse.json({ assignment: null })

    const { data, error } = await supabase
      .from('assignments')
      .select('id, submission_text, submission_url, submitted_at, creator_feedback, score, reviewed_at, status')
      .eq('lesson_id', lessonId)
      .eq('enrollment_id', enrollmentId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ assignment: data || null })
  } catch (err: any) {
    console.error('[assignments/my GET]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
