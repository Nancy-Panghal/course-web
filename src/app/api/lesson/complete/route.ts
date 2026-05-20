/**
 * app/api/lesson/complete/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Called by the lesson viewer page when student taps "Mark Complete".
 * Works for both Telegram (identity = chatId) and web (identity = userId).
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { identity, lessonNum, courseId } = await req.json()

    if (!identity || !lessonNum || !courseId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Find enrollment by telegram_chat_id
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select('id, completed_lessons, current_lesson')
      .eq('telegram_chat_id', String(identity))
      .eq('course_uuid', courseId)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    const completed: number[] = Array.isArray(enrollment.completed_lessons)
      ? enrollment.completed_lessons
      : []

    if (!completed.includes(lessonNum)) completed.push(lessonNum)

    await supabase
      .from('enrollments')
      .update({
        completed_lessons: completed,
        current_lesson: lessonNum + 1,
        last_accessed: new Date().toISOString(),
      })
      .eq('id', enrollment.id)

    return NextResponse.json({ ok: true, completed })
  } catch (err: any) {
    console.error('[lesson/complete]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}