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
import { escapeHtml, sendLoggedEmail } from '@/lib/email'

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
      .select('id, completed_lessons, current_lesson, quiz_results, student_id, creator_id')
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

    const { count: totalLessons } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .eq('is_published', true)

    const courseCompleted = Boolean(totalLessons && completed.length >= totalLessons)

    if (courseCompleted) {
      const { data: existingCompletionEmail } = await supabase
        .from('email_logs')
        .select('id')
        .eq('email_type', 'student_course_completion')
        .eq('course_id', courseId)
        .eq('student_id', enrollment.student_id)
        .limit(1)

      if (!existingCompletionEmail?.length) {
        const [{ data: courseRows }, { data: studentRows }] = await Promise.all([
          supabase
            .from('courses')
            .select('name, creator_id')
            .eq('id', courseId)
            .limit(1),
          supabase
            .from('students')
            .select('email, name')
            .eq('id', enrollment.student_id)
            .limit(1),
        ])

        const course = courseRows?.[0]
        const student = studentRows?.[0]
        const creatorId = enrollment.creator_id || course?.creator_id || null

        if (student?.email && creatorId) {
          await sendLoggedEmail({
            supabase,
            emailType: 'student_course_completion',
            to: student.email,
            subject: `Completed: ${course?.name || 'Your course'}`,
            creatorId,
            studentId: enrollment.student_id,
            courseId,
            metadata: {
              completed_lessons: completed.length,
              total_lessons: totalLessons,
            },
            html: `
              <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
                <h2 style="margin:0 0 12px">Course completed</h2>
                <p style="margin:0 0 12px">Hi ${escapeHtml(student.name || 'there')}, you completed <strong>${escapeHtml(course?.name || 'your course')}</strong>.</p>
                <p style="margin:0">Your progress is saved in AcademyKit.</p>
              </div>
            `,
          })
        }

        if (creatorId) {
          const { data } = await supabase.auth.admin.getUserById(creatorId)
          const creator = data?.user
          const prefs = creator?.user_metadata?.email_notifications || {}
          if (creator?.email && prefs.courseCompletion !== false) {
            await sendLoggedEmail({
              supabase,
              emailType: 'creator_course_completion',
              to: creator.email,
              subject: `Course completed: ${course?.name || 'Your course'}`,
              creatorId,
              studentId: enrollment.student_id,
              courseId,
              metadata: {
                student_name: student?.name || null,
                student_email: student?.email || null,
              },
              html: `
                <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111">
                  <h2 style="margin:0 0 12px">Student completed a course</h2>
                  <p style="margin:0 0 12px"><strong>${escapeHtml(student?.name || student?.email || 'A student')}</strong> completed <strong>${escapeHtml(course?.name || 'your course')}</strong>.</p>
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/dashboard"
                    style="display:inline-block;background:#7c3aed;color:white;padding:10px 14px;border-radius:10px;text-decoration:none">
                    Open dashboard
                  </a>
                </div>
              `,
            })
          }
        }
      }
    }

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
