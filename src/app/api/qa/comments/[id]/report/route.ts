/**
 * src/app/api/qa/comments/[id]/report/route.ts
 * POST { enrollmentId? } — a student flags someone else's comment for
 * creator review. Puts it back into 'pending_review' alongside
 * automated-moderation flags, so the creator has one queue to check.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, resolveQaIdentity } from '@/lib/qaIdentity'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { enrollmentId } = await req.json().catch(() => ({ enrollmentId: null }))

    const { data: comment } = await supabaseAdmin
      .from('lesson_comments')
      .select('id, course_id, status, enrollment_id')
      .eq('id', id)
      .single()

    if (!comment || comment.status !== 'visible') {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const identity = await resolveQaIdentity(req, comment.course_id, enrollmentId)
    if (!identity || identity.kind !== 'student') {
      return NextResponse.json({ error: 'Not enrolled in this course.' }, { status: 403 })
    }
    if (comment.enrollment_id === identity.enrollmentId) {
      return NextResponse.json({ error: "You can't report your own comment." }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('lesson_comments')
      .update({ status: 'pending_review', flag_reason: 'Reported by a student' })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[qa/comments/report]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}