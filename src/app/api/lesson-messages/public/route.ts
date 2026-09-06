/**
 * src/app/api/lesson-messages/public/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Public, read-only endpoint the STUDENT-facing course page calls
 * (no auth — same trust level as the lesson list itself, which is
 * already publicly readable for enrolled/free-preview students).
 *
 * GET ?courseId=...&lessonNumber=N
 *   → { type: 'note' | 'availability' | null, text: string | null }
 *
 * Mirrors the exact same resolution the Telegram/WhatsApp bots use
 * (src/lib/lesson-availability.ts + lessonMessages.js in both bot
 * repos), so all three surfaces agree on what a student sees:
 *   - lesson exists & is available  → look up a 'note' message
 *   - lesson missing/unpublished/no-content, or a future slot with
 *     no row yet → look up an 'availability' message
 * Only ever returns the single message text relevant to that one
 * lesson number — never the full course message list.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isLessonAvailable, type LessonAvailabilityInput } from '@/lib/lesson-availability'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get('courseId')
    const lessonNumberRaw = req.nextUrl.searchParams.get('lessonNumber')
    const lessonNumber = Number(lessonNumberRaw)

    if (!courseId || !lessonNumberRaw || !Number.isFinite(lessonNumber) || lessonNumber < 1) {
      return NextResponse.json({ error: 'courseId and a valid lessonNumber are required' }, { status: 400 })
    }

        const { data: lessonRow } = await supabase
      .from('lessons')
      .select('id, order_num, is_published, content_type, quiz_questions, assignment_prompt, assignment_file_url')
      .eq('course_id', courseId)
      .eq('order_num', lessonNumber)
      .maybeSingle()

    if (lessonRow && isLessonAvailable(lessonRow as LessonAvailabilityInput)) {
      const { data } = await supabase
        .from('lesson_messages')
        .select('message_text')
        .eq('lesson_id', lessonRow.id)
        .eq('message_type', 'note')
        .maybeSingle()

      return NextResponse.json({ type: data ? 'note' : null, text: data?.message_text || null })
    }

    const query = supabase
      .from('lesson_messages')
      .select('message_text')
      .eq('course_id', courseId)
      .eq('message_type', 'availability')

    const { data } = lessonRow
      ? await query.eq('lesson_id', lessonRow.id).maybeSingle()
      : await query.eq('pending_lesson_number', lessonNumber).is('lesson_id', null).maybeSingle()

    return NextResponse.json({ type: data ? 'availability' : null, text: data?.message_text || null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}