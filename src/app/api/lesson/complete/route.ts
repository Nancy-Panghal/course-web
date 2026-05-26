/**
 * src/app/api/lesson/complete/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Mark a lesson complete. Called by:
 *  - Web player (enrollmentId in body)
 *  - Telegram viewer page (identity = chat_id in body)
 *
 * Also handles quiz result storage.
 * Updates current_lesson to max(existing, lessonNum+1) so progress
 * never goes backwards even if requests arrive out of order.
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
    const body = await req.json()
    const {
      identity,         // telegram_chat_id (string) — Telegram path
      enrollmentId,     // enrollment UUID — web path (preferred)
      lessonId,         // lesson UUID (for quiz tracking)
      lessonNum,        // order_num of the completed lesson
      courseId,
      source = 'web',   // 'web' | 'telegram'
      // Optional quiz result
      quizScore,        // number of correct answers
      quizTotal,        // total questions
    } = body

    if (!lessonNum || !courseId) {
      return NextResponse.json({ error: 'lessonNum and courseId required' }, { status: 400 })
    }
    if (!identity && !enrollmentId) {
      return NextResponse.json({ error: 'identity or enrollmentId required' }, { status: 400 })
    }

    // ── Find enrollment ───────────────────────────────────────────
    let query = supabase
      .from('enrollments')
      .select('id, completed_lessons, current_lesson, quiz_results')
      .eq('course_uuid', courseId)
      .order('enrolled_at', { ascending: false })

    if (enrollmentId) {
      query = query.eq('id', enrollmentId)
    } else {
      query = query.eq('telegram_chat_id', String(identity))
    }

    const { data: rows, error } = await query.limit(1)
    const enrollment = rows?.[0]

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    // ── Update completed_lessons (idempotent) ─────────────────────
    const completed: number[] = Array.isArray(enrollment.completed_lessons)
      ? [...enrollment.completed_lessons]
      : []

    if (!completed.includes(lessonNum)) {
      completed.push(lessonNum)
    }

    // ── Update quiz_results if quiz was submitted ─────────────────
    let quizResults: any[] = Array.isArray(enrollment.quiz_results)
      ? [...enrollment.quiz_results]
      : []

    if (lessonId && typeof quizScore === 'number' && typeof quizTotal === 'number') {
      // Replace existing result for this lesson or add new
      const existingIdx = quizResults.findIndex((r: any) => r.lessonId === lessonId)
      const result = {
        lessonId,
        lessonNum,
        score: quizScore,
        total: quizTotal,
        completedAt: new Date().toISOString(),
        source,
      }
      if (existingIdx >= 0) {
        quizResults[existingIdx] = result
      } else {
        quizResults.push(result)
      }
    }

    // ── Advance current_lesson (never go backwards) ───────────────
    const newCurrentLesson = Math.max(
      enrollment.current_lesson ?? 1,
      lessonNum + 1
    )

    const syncField = source === 'telegram' ? 'last_telegram_sync' : 'last_web_sync'

    const { error: updateErr } = await supabase
      .from('enrollments')
      .update({
        completed_lessons: completed,
        current_lesson: newCurrentLesson,
        quiz_results: quizResults,
        last_accessed: new Date().toISOString(),
        [syncField]: new Date().toISOString(),
      })
      .eq('id', enrollment.id)

    if (updateErr) throw updateErr

    return NextResponse.json({
      ok: true,
      completed,
      currentLesson: newCurrentLesson,
      quizResults,
    })
  } catch (err: any) {
    console.error('[lesson/complete]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}