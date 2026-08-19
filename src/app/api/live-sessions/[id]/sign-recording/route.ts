/**
 * src/app/api/live-sessions/[id]/sign-recording/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Mirrors /api/content/sign, but for a live_sessions recording.
 * Verifies the requester is a paid, enrolled student (or the owning
 * creator, for preview) before handing back a short-lived signed URL
 * — the actual storage path never reaches the browser.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { signLiveSessionVideoUrl } from '@/lib/signer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params

        const { data: session } = await supabase
      .from('live_sessions')
      .select('id, course_id, creator_id, recording_storage_path, recording_url')
      .eq('id', sessionId)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (!session.recording_storage_path && !session.recording_url) {
      return NextResponse.json({ error: 'No recording available' }, { status: 404 })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Owning creator can always preview their own recording.
    if (user.id !== session.creator_id) {
      const { data: student } = await supabase
        .from('students')
        .select('id, email, phone')
        .eq('auth_id', user.id)
        .limit(1)
        .single()

      const identifiers = [student?.phone, student?.email, user.phone, user.email].filter(Boolean) as string[]

      let enrolled = false
      if (student?.id) {
        const { data: byStudentId } = await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', student.id)
          .eq('course_uuid', session.course_id)
          .eq('payment_status', 'paid')
          .limit(1)
          .single()
        enrolled = !!byStudentId
      }
      if (!enrolled && identifiers.length > 0) {
        const { data: byIdentifier } = await supabase
          .from('enrollments')
          .select('id')
          .eq('course_uuid', session.course_id)
          .eq('payment_status', 'paid')
          .in('phone', identifiers)
          .limit(1)
          .single()
        enrolled = !!byIdentifier
      }

      if (!enrolled) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
    }

        // An externally-hosted recording (Zoom/Drive/YouTube/etc.) has no
    // bytes for Kurso to proxy or watermark — hand back the link itself,
    // clearly marked, rather than trying to run it through the signed
    // stream flow that only ever works for an uploaded file.
    if (!session.recording_storage_path) {
      return NextResponse.json({ url: session.recording_url, external: true })
    }

    const url = signLiveSessionVideoUrl(sessionId, user.id)
    return NextResponse.json({ url, external: false, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() })
  } catch (err: any) {
    console.error('[live-sessions/sign-recording]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}