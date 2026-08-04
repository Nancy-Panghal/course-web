/**
 * src/app/api/creator/qa/pending/route.ts
 * GET — lists every pending_review comment across the logged-in
 * creator's courses, for the moderation dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, resolveCreatorId } from '@/lib/qaIdentity'

export async function GET(req: NextRequest) {
  try {
    const creatorId = await resolveCreatorId(req)
    if (!creatorId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, name')
      .eq('creator_id', creatorId)

    const courseIds = (courses || []).map(c => c.id)
    if (courseIds.length === 0) return NextResponse.json({ pending: [] })

    const { data: comments } = await supabaseAdmin
      .from('lesson_comments')
      .select('id, lesson_id, course_id, body, flag_reason, created_at, parent_comment_id')
      .in('course_id', courseIds)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })

    const lessonIds = Array.from(new Set((comments || []).map(c => c.lesson_id)))
    const { data: lessons } = lessonIds.length > 0 ? await supabaseAdmin
      .from('lessons')
      .select('id, title')
      .in('id', lessonIds) : { data: [] }

    const courseNameById = new Map((courses || []).map(c => [c.id, c.name]))
    const lessonTitleById = new Map((lessons || []).map(l => [l.id, l.title]))

    const pending = (comments || []).map(c => ({
      id: c.id,
      body: c.body,
      flagReason: c.flag_reason,
      createdAt: c.created_at,
      isReply: !!c.parent_comment_id,
      lessonTitle: lessonTitleById.get(c.lesson_id) || 'Lesson',
      courseName: courseNameById.get(c.course_id) || 'Course',
    }))

    return NextResponse.json({ pending })
  } catch (err: any) {
    console.error('[creator/qa/pending]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}