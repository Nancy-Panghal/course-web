/**
 * src/app/api/assignments/[id]/route.ts
 * ─────────────────────────────────────────────────────────────────
 * PATCH — creator submits feedback + optional score
 *         Also sends a Telegram notification to the student
 * GET   — fetch a single assignment (student or creator)
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

// ── GET — fetch single assignment ─────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { data, error } = await supabase
      .from('assignments')
      .select(`
        id, lesson_id, course_id, submission_text, submission_url,
        submitted_at, creator_feedback, score, reviewed_at, status,
        lessons:lesson_id(title, order_num)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    // Allow access to: the student who submitted OR the course creator
    const { data: course } = await supabase
      .from('courses')
      .select('creator_id')
      .eq('id', data.course_id)
      .maybeSingle()

    const isCreator = course?.creator_id === user.id
    const isStudent = data.student_id === user.id ||
      // fallback: check by enrollment
      !!(await supabase
        .from('enrollments')
        .select('id')
        .eq('id', data.enrollment_id)
        .maybeSingle()
        .then(r => r.data))

    if (!isCreator && !isStudent) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ assignment: data })
  } catch (err: any) {
    console.error('[assignments/[id] GET]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── PATCH — creator reviews assignment ────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { feedback, score } = body as { feedback?: string; score?: number }

    if (!feedback?.trim()) {
      return NextResponse.json({ error: 'Feedback is required' }, { status: 400 })
    }
    if (score !== undefined && (score < 1 || score > 10 || !Number.isInteger(score))) {
      return NextResponse.json({ error: 'Score must be an integer between 1 and 10' }, { status: 400 })
    }

    // Fetch assignment + verify creator owns the course
    const { data: assignment } = await supabase
      .from('assignments')
      .select('id, course_id, enrollment_id, lesson_id, student_id')
      .eq('id', id)
      .maybeSingle()

    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    const { data: course } = await supabase
      .from('courses')
      .select('creator_id, name')
      .eq('id', assignment.course_id)
      .maybeSingle()

    if (course?.creator_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update assignment
    const { error: updateErr } = await supabase
      .from('assignments')
      .update({
        creator_feedback: feedback.trim(),
        score: score ?? null,
        reviewed_at: new Date().toISOString(),
        status: 'reviewed',
      })
      .eq('id', id)

    if (updateErr) throw updateErr

    // ── Notify student via Telegram (non-fatal) ───────────────────
    try {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('telegram_chat_id')
        .eq('id', assignment.enrollment_id)
        .maybeSingle()

      const { data: lesson } = await supabase
        .from('lessons')
        .select('title, order_num')
        .eq('id', assignment.lesson_id)
        .maybeSingle()

      const chatId = enrollment?.telegram_chat_id
      if (chatId && BOT_TOKEN) {
        const scoreText = score !== undefined ? `\nScore: *${score}/10*` : ''
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ *Assignment reviewed*\n\nLesson ${lesson?.order_num || ''}: ${lesson?.title || ''}\n\n*Feedback from your instructor:*\n${feedback.trim()}${scoreText}`,
            parse_mode: 'Markdown',
            protect_content: true,
          }),
        })
      }
    } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[assignments/[id] PATCH]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
