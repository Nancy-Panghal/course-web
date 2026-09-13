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
import { getWebAccessContext } from '@/lib/webAccess'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()

    const url = new URL(req.url)
    const lessonId = url.searchParams.get('lessonId')
    const enrollmentId = url.searchParams.get('enrollmentId')

    if (!lessonId || !enrollmentId) {
      return NextResponse.json({ error: 'lessonId and enrollmentId required' }, { status: 400 })
    }

    // ── Verify the request can access this enrollment, via either of two
    // independent identity paths — a Bearer-token auth_id match, or a valid
    // kurso_web_session cookie (bot-issued, no Kurso login) pointing at this
    // exact enrollment. A browser can carry a Bearer token for an unrelated
    // Supabase Auth account alongside a legitimate cookie session; requiring
    // the Bearer token to match previously denied access even when the
    // cookie already proved it. ──
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, student_id, students:student_id(auth_id)')
      .eq('id', enrollmentId)
      .maybeSingle()

    if (!enrollment) return NextResponse.json({ assignment: null })

    let hasAccess = false

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      const enrolledAuthId = (enrollment as any)?.students?.auth_id
      if (user && enrolledAuthId === user.id) hasAccess = true
    }

    if (!hasAccess) {
      const webAccess = await getWebAccessContext(req)
      if (webAccess && webAccess.access.enrollment_id === enrollmentId) hasAccess = true
    }

    if (!hasAccess) {
      console.warn('[assignments/my GET] denied_no_access', { lessonId, enrollmentId })
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    
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