/**
 * src/app/api/qa/comments/[id]/like/route.ts
 * POST { enrollmentId? } — toggles a like on a comment. Requires a
 * student identity (web session or bot-resolved enrollmentId).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, resolveQaIdentity } from '@/lib/qaIdentity'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { enrollmentId } = await req.json().catch(() => ({ enrollmentId: null }))

    const { data: comment } = await supabaseAdmin
      .from('lesson_comments')
      .select('id, lesson_id, course_id, status')
      .eq('id', id)
      .single()

    if (!comment || comment.status !== 'visible') {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const identity = await resolveQaIdentity(req, comment.course_id, enrollmentId)
    if (!identity || identity.kind !== 'student') {
      return NextResponse.json({ error: 'Not enrolled in this course.' }, { status: 403 })
    }

    const { data: existing } = await supabaseAdmin
      .from('lesson_comment_likes')
      .select('id')
      .eq('comment_id', id)
      .eq('enrollment_id', identity.enrollmentId)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin.from('lesson_comment_likes').delete().eq('id', existing.id)
    } else {
      await supabaseAdmin.from('lesson_comment_likes').insert({
        comment_id: id,
        enrollment_id: identity.enrollmentId,
      })
    }

    const { count } = await supabaseAdmin
      .from('lesson_comment_likes')
      .select('id', { count: 'exact', head: true })
      .eq('comment_id', id)

    return NextResponse.json({ liked: !existing, likeCount: count || 0 })
  } catch (err: any) {
    console.error('[qa/comments/like]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}