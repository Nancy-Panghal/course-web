/**
 * src/app/api/qa/comments/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET  ?lessonId=...&enrollmentId=...  — list comments/replies for a
 *      lesson. `enrollmentId` is optional (bot-referred students pass
 *      it; web students are identified via the Authorization header).
 * POST { lessonId, body, parentCommentId?, enrollmentId? } — create a
 *      new top-level comment or reply.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, resolveQaIdentity } from '@/lib/qaIdentity'
import { moderateComment } from '@/lib/moderateComment'

const MAX_WORDS = 300
const MAX_COMMENTS_PER_LESSON = 15
const COOLDOWN_MS = 20 * 1000

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

type Row = {
  id: string
  lesson_id: string
  parent_comment_id: string | null
  body: string
  is_creator_reply: boolean
  status: string
  flag_reason: string | null
  created_at: string
  enrollment_id: string | null
  creator_id: string | null
}

export async function GET(req: NextRequest) {
  try {
    const lessonId = req.nextUrl.searchParams.get('lessonId')
    const bodyEnrollmentId = req.nextUrl.searchParams.get('enrollmentId')
    if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

    const { data: lesson } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id, qa_enabled')
      .eq('id', lessonId)
      .single()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    if (!lesson.qa_enabled) return NextResponse.json({ qaEnabled: false, comments: [] })

    const identity = await resolveQaIdentity(req, lesson.course_id, bodyEnrollmentId)

    // Visible to everyone, plus the viewer's own pending-review comments
    // (so they see "awaiting review" instead of the comment vanishing).
    let query = supabaseAdmin
      .from('lesson_comments')
      .select('id, lesson_id, parent_comment_id, body, is_creator_reply, status, flag_reason, created_at, enrollment_id, creator_id')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true })

    const { data: rows } = await query
    const allRows = (rows || []) as Row[]

    const visibleOrMine = allRows.filter(r => {
      if (r.status === 'visible') return true
      if (r.status !== 'pending_review' || !identity) return false
      if (identity.kind === 'student') return r.enrollment_id === identity.enrollmentId
      return r.creator_id === identity.creatorId
    })

    const commentIds = visibleOrMine.map(r => r.id)
    let likedIds = new Set<string>()
    const likeCounts = new Map<string, number>()

    if (commentIds.length > 0) {
      const { data: likeRows } = await supabaseAdmin
        .from('lesson_comment_likes')
        .select('comment_id, enrollment_id')
        .in('comment_id', commentIds)

      for (const l of likeRows || []) {
        likeCounts.set(l.comment_id, (likeCounts.get(l.comment_id) || 0) + 1)
        if (identity?.kind === 'student' && l.enrollment_id === identity.enrollmentId) {
          likedIds.add(l.comment_id)
        }
      }
    }

    const withMeta = visibleOrMine.map(r => ({
      id: r.id,
      body: r.body,
      isCreatorReply: r.is_creator_reply,
      status: r.status,
      createdAt: r.created_at,
      parentCommentId: r.parent_comment_id,
      likeCount: likeCounts.get(r.id) || 0,
      likedByMe: likedIds.has(r.id),
      mine: identity?.kind === 'student'
        ? r.enrollment_id === identity.enrollmentId
        : identity?.kind === 'creator'
          ? r.creator_id === identity.creatorId
          : false,
    }))

    const topLevel = withMeta.filter(c => !c.parentCommentId)
    const replies = withMeta.filter(c => c.parentCommentId)

    const nested = topLevel.map(c => ({
      ...c,
      replies: replies
        .filter(r => r.parentCommentId === c.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ qaEnabled: true, comments: nested })
  } catch (err: any) {
    console.error('[qa/comments GET]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { lessonId, body, parentCommentId, enrollmentId } = await req.json()

    if (!lessonId || !body || !body.trim()) {
      return NextResponse.json({ error: 'lessonId and body are required' }, { status: 400 })
    }
    if (wordCount(body) > MAX_WORDS) {
      return NextResponse.json({ error: `Comments are limited to ${MAX_WORDS} words.` }, { status: 400 })
    }

    const { data: lesson } = await supabaseAdmin
      .from('lessons')
      .select('id, course_id, qa_enabled')
      .eq('id', lessonId)
      .single()

    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    if (!lesson.qa_enabled) return NextResponse.json({ error: 'Q&A is closed for this lesson.' }, { status: 403 })

    // A reply's parent must belong to the same lesson.
    if (parentCommentId) {
      const { data: parent } = await supabaseAdmin
        .from('lesson_comments')
        .select('id, lesson_id, parent_comment_id')
        .eq('id', parentCommentId)
        .single()
      if (!parent || parent.lesson_id !== lessonId) {
        return NextResponse.json({ error: 'Invalid parent comment.' }, { status: 400 })
      }
      if (parent.parent_comment_id) {
        return NextResponse.json({ error: 'Replies can only be one level deep.' }, { status: 400 })
      }
    }

    const identity = await resolveQaIdentity(req, lesson.course_id, enrollmentId)
    if (!identity) return NextResponse.json({ error: 'Not enrolled in this course.' }, { status: 403 })

    const insertRow: Record<string, any> = {
      lesson_id: lessonId,
      course_id: lesson.course_id,
      parent_comment_id: parentCommentId || null,
      body: body.trim(),
    }

    if (identity.kind === 'creator') {
      insertRow.creator_id = identity.creatorId
      insertRow.is_creator_reply = true
      insertRow.status = 'visible' // creator replies are trusted, no rate limit or moderation
    } else {
      const cooldownStart = new Date(Date.now() - COOLDOWN_MS).toISOString()

      const [{ count: recentCount }, { count: lessonCount }] = await Promise.all([
        supabaseAdmin
          .from('lesson_comments')
          .select('id', { count: 'exact', head: true })
          .eq('enrollment_id', identity.enrollmentId)
          .gte('created_at', cooldownStart),
        supabaseAdmin
          .from('lesson_comments')
          .select('id', { count: 'exact', head: true })
          .eq('lesson_id', lessonId)
          .eq('enrollment_id', identity.enrollmentId),
      ])

      if ((recentCount || 0) > 0) {
        return NextResponse.json({ error: 'Please wait a moment before posting again.' }, { status: 429 })
      }
      if ((lessonCount || 0) >= MAX_COMMENTS_PER_LESSON) {
        return NextResponse.json({ error: `You've reached the comment limit for this lesson.` }, { status: 429 })
      }

      const moderation = await moderateComment(body.trim())
      insertRow.enrollment_id = identity.enrollmentId
      insertRow.is_creator_reply = false
      insertRow.status = moderation.flagged ? 'pending_review' : 'visible'
      insertRow.flag_reason = moderation.reason
    }

    const { data: created, error } = await supabaseAdmin
      .from('lesson_comments')
      .insert(insertRow)
      .select('id, status, created_at, body, is_creator_reply, parent_comment_id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ comment: created })
  } catch (err: any) {
    console.error('[qa/comments POST]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}