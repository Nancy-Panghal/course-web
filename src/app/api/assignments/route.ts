/**
 * src/app/api/assignments/route.ts
 * ─────────────────────────────────────────────────────────────────
 * POST — student submits an assignment (text or file URL)
 * GET  — creator fetches all pending/reviewed assignments for their courses
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

async function getUser(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// ── POST — student submits ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { lessonId, courseId, enrollmentId, submissionText, submissionUrl } = body as {
      lessonId: string
      courseId: string
      enrollmentId: string
      submissionText?: string
      submissionUrl?: string
    }

    if (!lessonId || !courseId || !enrollmentId) {
      return NextResponse.json({ error: 'lessonId, courseId and enrollmentId are required' }, { status: 400 })
    }
    if (!submissionText?.trim() && !submissionUrl?.trim()) {
      return NextResponse.json({ error: 'Provide submission text or a file URL' }, { status: 400 })
    }
    if (submissionText && submissionText.trim().length > 2000) {
      return NextResponse.json({ error: 'Submission text must be 2000 characters or less' }, { status: 400 })
    }

    // Verify the enrollment belongs to this user
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, student_id, creator_id, phone')
      .eq('id', enrollmentId)
      .eq('course_uuid', courseId)
      .maybeSingle()

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 403 })
    }

    // ── Actually verify ownership — the query above only confirmed the
    // enrollment exists for this course, not that it belongs to the caller ──
    if (enrollment.student_id) {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!student || student.id !== enrollment.student_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Phone/email-only enrollment (telegram/bot-created, not yet linked to a students row)
      const identifiers = [user.user_metadata?.phone, user.phone, user.email].filter(Boolean) as string[]
      if (!identifiers.includes(enrollment.phone)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    
    // Check if student already submitted for this lesson — idempotent
    const { data: existing } = await supabase
      .from('assignments')
      .select('id, status')
      .eq('lesson_id', lessonId)
      .eq('enrollment_id', enrollmentId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadySubmitted: true,
        assignmentId: existing.id,
        status: existing.status,
      })
    }

    // Get student_id from students table if not on enrollment
    let studentId = enrollment.student_id
    if (!studentId) {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()
      studentId = student?.id || null
    }

    const { data: assignment, error: insertErr } = await supabase
      .from('assignments')
      .insert({
        lesson_id: lessonId,
        course_id: courseId,
        student_id: studentId,
        enrollment_id: enrollmentId,
        submission_text: submissionText?.trim() || null,
        submission_url: submissionUrl?.trim() || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertErr) throw insertErr

    // ── Notify creator via Telegram (non-fatal) ───────────────────
    try {
      const [{ data: lesson }, { data: creator }] = await Promise.all([
        supabase.from('lessons').select('title, order_num').eq('id', lessonId).maybeSingle(),
        supabase.from('creators').select('telegram_chat_id').eq('id', enrollment.creator_id).maybeSingle(),
      ])

      if ((creator as any)?.telegram_chat_id && BOT_TOKEN) {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: (creator as any).telegram_chat_id,
            text: `📝 *New assignment submission*\n\nLesson ${lesson?.order_num || ''}: ${lesson?.title || ''}\n\nReview it in your dashboard.`,
            parse_mode: 'Markdown',
          }),
        })
      }
    } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true, assignmentId: assignment.id, status: 'pending' })
  } catch (err: any) {
    console.error('[assignments POST]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── GET — creator fetches submissions ─────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const courseId = url.searchParams.get('courseId')
    const status = url.searchParams.get('status') // 'pending' | 'reviewed' | null = all

    // Verify creator owns all courses being queried
    if (courseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .eq('creator_id', user.id)
        .maybeSingle()
      if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 403 })
    }

    let query = supabase
      .from('assignments')
      .select(`
        id, lesson_id, course_id, student_id, enrollment_id,
        submission_text, submission_url, submitted_at,
        creator_feedback, score, reviewed_at, status,
        lessons:lesson_id(title, order_num),
        enrollments:enrollment_id(phone)
      `)
      .order('submitted_at', { ascending: false })
      .limit(100)

    if (courseId) {
      query = query.eq('course_id', courseId)
    } else {
      // Only return assignments for courses owned by this creator
      const { data: creatorCourses } = await supabase
        .from('courses')
        .select('id')
        .eq('creator_id', user.id)
      const courseIds = (creatorCourses || []).map((c: any) => c.id)
      if (courseIds.length === 0) return NextResponse.json({ assignments: [] })
      query = query.in('course_id', courseIds)
    }

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ assignments: data || [] })
  } catch (err: any) {
    console.error('[assignments GET]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
