/**
 * src/app/api/lesson-messages/route.ts
 * ─────────────────────────────────────────────────────────────────
 * CRUD for the lesson-messaging feature (broadcast page widget +
 * student-facing "lesson not available yet" / "note" messages).
 *
 * GET    ?courseId=...   → list messages for a course, WITH lesson
 *                          status joined in, and 'availability'
 *                          messages auto-excluded once their lesson
 *                          is actually available (published + has
 *                          content where applicable) — no cleanup
 *                          job needed, per the "must not show once
 *                          available" requirement.
 * POST                   → create a message. Body:
 *                          { courseId, target: { lessonId } | { pendingLessonNumber },
 *                            messageType: 'note' | 'availability', messageText }
 * PATCH                  → edit a message. Body: { id, messageText }
 * DELETE ?id=...         → delete a message.
 *
 * All lesson_messages rows are scoped to the authenticated creator's
 * own courses via the courses.creator_id check — same pattern as
 * /api/broadcast.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isLessonAvailable, type LessonAvailabilityInput } from '@/lib/lesson-availability'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_MESSAGE_WORDS = 150

/** Resolve the authenticated creator from the Bearer token */
async function getCreator(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** Confirms the course belongs to this creator. Returns the course row or null. */
async function getOwnedCourse(courseId: string, creatorId: string) {
  const { data } = await supabase
    .from('courses')
    .select('id, creator_id')
    .eq('id', courseId)
    .eq('creator_id', creatorId)
    .maybeSingle()
  return data
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ── GET /api/lesson-messages?courseId=... ─────────────────────────
export async function GET(req: NextRequest) {
  try {
    const creator = await getCreator(req)
    if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courseId = req.nextUrl.searchParams.get('courseId')
    if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

    const course = await getOwnedCourse(courseId, creator.id)
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Pull all real lessons for this course so we can (a) attach live
    // status to each message's lesson and (b) drop stale 'availability'
    // messages whose lesson is now actually available.
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, order_num, title, is_published, content_type, quiz_questions, assignment_prompt, assignment_file_url')
      .eq('course_id', courseId)
      .order('order_num', { ascending: true })

    if (lessonsError) {
      return NextResponse.json({ error: lessonsError.message }, { status: 500 })
    }

        const lessonsById = new Map((lessons || []).map(l => [l.id, l]))
    const lessonsByOrderNum = new Map((lessons || []).map(l => [l.order_num, l]))

    const { data: messages, error: messagesError } = await supabase
      .from('lesson_messages')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 })
    }

    const visible = (messages || []).filter(m => {
      if (m.message_type !== 'availability') return true
      if (m.lesson_id) {
        const lesson = lessonsById.get(m.lesson_id)
        if (!lesson) return true // lesson gone (shouldn't happen — cascade would've deleted the row too)
        return !isLessonAvailable(lesson as LessonAvailabilityInput)
      }
      // Pending "next lesson" slot — a real lesson may have been created and
      // published at this order_num since the message was set. If so, this
      // message is stale and should disappear just like the lesson_id case.
      const nowRealLesson = lessonsByOrderNum.get(m.pending_lesson_number)
      if (!nowRealLesson) return true
      return !isLessonAvailable(nowRealLesson as LessonAvailabilityInput)
    })


    const enriched = visible.map(m => {
      const lesson = m.lesson_id ? lessonsById.get(m.lesson_id) : null
      return {
        ...m,
        lesson_title: lesson?.title ?? null,
        lesson_number: lesson?.order_num ?? m.pending_lesson_number,
      }
    })

    return NextResponse.json({ messages: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}

// ── POST /api/lesson-messages ─────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const creator = await getCreator(req)
    if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { courseId, target, messageType, messageText } = body || {}

    if (!courseId || !target || !messageType || !messageText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!['note', 'availability'].includes(messageType)) {
      return NextResponse.json({ error: 'Invalid messageType' }, { status: 400 })
    }
    if (wordCount(messageText) > MAX_MESSAGE_WORDS) {
      return NextResponse.json({ error: `Message must be ${MAX_MESSAGE_WORDS} words or fewer` }, { status: 400 })
    }

    const course = await getOwnedCourse(courseId, creator.id)
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const insertRow: Record<string, any> = {
      course_id: courseId,
      message_type: messageType,
      message_text: messageText.trim(),
      lesson_id: null,
      pending_lesson_number: null,
    }

    if (target.lessonId) {
      insertRow.lesson_id = target.lessonId
    } else if (target.pendingLessonNumber) {
      insertRow.pending_lesson_number = target.pendingLessonNumber
    } else {
      return NextResponse.json({ error: 'target must include lessonId or pendingLessonNumber' }, { status: 400 })
    }

    // Upsert semantics: one message per (type, target) — if the creator
    // re-sends for the same lesson/slot + type, replace the existing one
    // rather than erroring on the unique constraint.
    const conflictTarget = target.lessonId
      ? 'course_id,lesson_id,message_type'
      : 'course_id,pending_lesson_number,message_type'

    const { data, error } = await supabase
      .from('lesson_messages')
      .upsert(insertRow, { onConflict: conflictTarget })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ message: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}

// ── PATCH /api/lesson-messages ─────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const creator = await getCreator(req)
    if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, messageText } = body || {}
    if (!id || !messageText) {
      return NextResponse.json({ error: 'id and messageText required' }, { status: 400 })
    }
    if (wordCount(messageText) > MAX_MESSAGE_WORDS) {
      return NextResponse.json({ error: `Message must be ${MAX_MESSAGE_WORDS} words or fewer` }, { status: 400 })
    }

    // Confirm ownership via the join before allowing the edit.
    const { data: existing } = await supabase
      .from('lesson_messages')
      .select('id, course_id, courses!inner(creator_id)')
      .eq('id', id)
      .eq('courses.creator_id', creator.id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('lesson_messages')
      .update({ message_text: messageText.trim() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ message: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}

// ── DELETE /api/lesson-messages?id=... ─────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const creator = await getCreator(req)
    if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data: existing } = await supabase
      .from('lesson_messages')
      .select('id, courses!inner(creator_id)')
      .eq('id', id)
      .eq('courses.creator_id', creator.id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

    const { error } = await supabase.from('lesson_messages').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}