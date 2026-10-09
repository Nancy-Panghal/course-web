/**
 * src/app/api/cron/inactivity-nudge/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Daily job: a gentle "pick up where you left off" message for students who have
 * gone quiet — on Telegram and/or by email. No leaderboards, no comparison with
 * other students.
 *
 * Register in vercel.json:  { "path": "/api/cron/inactivity-nudge", "schedule": "0 13 * * *" }
 * (13:xx UTC = 18:30-19:29 IST, an evening slot rather than the middle of the night.)
 *
 * Who is nudged: paid enrollments whose last_accessed is more than INACTIVE_DAYS old
 * and who haven't been nudged in the last 3 days (so: every 3 days of continued silence).
 *
 * Who is NOT nudged (on purpose):
 *   - students silent for more than STOP_AFTER_DAYS (they've left; stop nagging)
 *   - students who finished every lesson
 *   - students whose next lesson is still locked by the drip schedule (they're waiting
 *     for a module, and the "module unlocked" message will reach them)
 *   - unpublished courses, and students we have no way to reach
 *
 * Safety: the nudge timestamp is claimed with a compare-and-swap BEFORE sending, so
 * overlapping runs can't double-send; it is rolled back if nothing could be delivered.
 * ─────────────────────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLoggedEmail } from '@/lib/email'
import { createEmailAccessUrl, getEnrollmentEmail, renderInactivityNudgeEmail } from '@/lib/emailAccess'
import { getLessonLock } from '@/lib/moduleLock'
import { isLessonFree } from '@/lib/freeLesson'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DAY_MS = 24 * 60 * 60 * 1000
const INACTIVE_DAYS = 3
const STOP_AFTER_DAYS = 30
// A daily cron never fires at exactly the same minute, so "3 days since the last nudge"
// would drift to 4. A few hours of slack keeps it a steady every-third-day rhythm.
const REPEAT_SLACK_MS = 3 * 60 * 60 * 1000
const MAX_SENDS_PER_RUN = 150
const BATCH_LIMIT = 1000
const SEND_GAP_MS = 60

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type SendResult = 'sent' | 'skipped' | 'failed'
type LessonRow = { id: string; order_num: number; title: string | null; is_free: boolean | null; module_id: string | null }

// The lesson the student is "on": their current lesson if it isn't done yet, otherwise the
// next unfinished one. null = nothing left to continue (course finished).
export function pickTargetLesson(lessons: LessonRow[], currentLesson: unknown, completed: unknown): LessonRow | null {
  const done = new Set((Array.isArray(completed) ? completed : []).map(Number))
  const sorted = [...lessons].sort((a, b) => a.order_num - b.order_num)
  if (!sorted.length || sorted.every(l => done.has(l.order_num))) return null
  const cur = Math.max(1, Number(currentLesson) || 1)
  const exact = sorted.find(l => l.order_num === cur && !done.has(l.order_num))
  if (exact) return exact
  return sorted.find(l => l.order_num > cur && !done.has(l.order_num)) ?? null
}

async function sendViaBot(enrollmentId: string, lessonNum: number): Promise<SendResult> {
  const baseUrl = process.env.TELEGRAM_BOT_URL
  const secret = process.env.INTERNAL_BOT_SECRET
  if (!baseUrl || !secret) {
    console.warn('[inactivity-nudge] TELEGRAM_BOT_URL / INTERNAL_BOT_SECRET not configured, skipping')
    return 'failed'
  }
  try {
    const res = await fetch(`${baseUrl}/internal/send-inactivity-nudge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ enrollmentId, lessonNum }),
    })
    if (res.ok) return 'sent'
    if (res.status === 409) return 'skipped' // the bot decided this must not go out
    console.error('[inactivity-nudge] bot rejected send:', res.status, await res.text().catch(() => ''))
    return 'failed'
  } catch (err) {
    console.error('[inactivity-nudge] failed to reach bot:', err)
    return 'failed'
  }
}

async function sendViaEmail(input: {
  course: { id: string; name: string | null; creator_id: string | null }
  enrollment: { id: string; student_id: string | null; creator_id: string | null }
  lesson: LessonRow
  email: string
  studentName: string | null
}): Promise<SendResult> {
  let created: { url: string; tokenHash: string } | null = null
  try {
    created = await createEmailAccessUrl(supabase, {
      courseId: input.course.id,
      enrollmentId: input.enrollment.id,
      studentId: input.enrollment.student_id,
      lessonNum: input.lesson.order_num,
    })
    const { subject, html } = renderInactivityNudgeEmail({
      studentName: input.studentName,
      courseName: input.course.name || 'your course',
      lessonTitle: input.lesson.title,
      link: created.url,
    })
    const result = await sendLoggedEmail({
      supabase,
      emailType: 'student_inactivity_nudge',
      to: input.email,
      subject,
      html,
      creatorId: input.enrollment.creator_id || input.course.creator_id || null,
      studentId: input.enrollment.student_id,
      courseId: input.course.id,
      metadata: { enrollment_id: input.enrollment.id, lesson_order: input.lesson.order_num },
    })
    if (result.sent) return 'sent'
    await supabase.from('web_bootstrap_tokens').delete().eq('token_hash', created.tokenHash)
    return 'failed'
  } catch (err) {
    console.error('[inactivity-nudge] email send failed:', err)
    if (created) await supabase.from('web_bootstrap_tokens').delete().eq('token_hash', created.tokenHash)
    return 'failed'
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = Date.now()
    const inactiveBefore = new Date(now - INACTIVE_DAYS * DAY_MS).toISOString()
    const giveUpBefore = new Date(now - STOP_AFTER_DAYS * DAY_MS).toISOString()
    const repeatBefore = new Date(now - INACTIVE_DAYS * DAY_MS + REPEAT_SLACK_MS).toISOString()

    const stats = {
      candidates: 0,
      sent: { telegram: 0, email: 0 },
      nudged: 0,
      skipped: { course: 0, finished: 0, locked: 0, unreachable: 0, raced: 0, botDeclined: 0 },
      failed: 0,
      capped: false,
    }

    const { data: candidates, error } = await supabase
      .from('enrollments')
      .select('id, course_uuid, student_id, student_email, telegram_chat_id, creator_id, enrolled_at, current_lesson, completed_lessons, last_accessed, last_inactivity_nudge_at')
      .eq('payment_status', 'paid')
      .lt('last_accessed', inactiveBefore)
      .gt('last_accessed', giveUpBefore)
      .or(`last_inactivity_nudge_at.is.null,last_inactivity_nudge_at.lt.${repeatBefore}`)
      .limit(BATCH_LIMIT)
    if (error) throw error

    const courseCache = new Map<string, { course: any; lessons: LessonRow[] } | null>()
    async function loadCourse(courseId: string) {
      if (courseCache.has(courseId)) return courseCache.get(courseId)!
      const { data: course } = await supabase
        .from('courses')
        .select('id, name, creator_id, is_published, is_free_course')
        .eq('id', courseId)
        .maybeSingle()
      let entry: { course: any; lessons: LessonRow[] } | null = null
      if (course && course.is_published !== false) {
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id, order_num, title, is_free, module_id')
          .eq('course_id', courseId)
          .eq('is_published', true)
        entry = { course, lessons: (lessons || []) as LessonRow[] }
      }
      courseCache.set(courseId, entry)
      return entry
    }

    let attempts = 0
    for (const enr of candidates || []) {
      stats.candidates++

      const loaded = await loadCourse(enr.course_uuid)
      if (!loaded) { stats.skipped.course++; continue }
      const { course, lessons } = loaded

      const target = pickTargetLesson(lessons, enr.current_lesson, enr.completed_lessons)
      if (!target) { stats.skipped.finished++; continue }

      // Still waiting for the drip schedule? Then there is nothing to "continue" yet.
      if (!isLessonFree({ is_free: target.is_free ?? false }, { is_free_course: course.is_free_course ?? false })) {
        const lock = await getLessonLock(supabase, target.id, [enr.enrolled_at])
        if (lock.locked) { stats.skipped.locked++; continue }
      }

      const emailInfo = await getEnrollmentEmail(supabase, enr)
      if (!enr.telegram_chat_id && !emailInfo.email) { stats.skipped.unreachable++; continue }

      if (attempts >= MAX_SENDS_PER_RUN) { stats.capped = true; continue }
      attempts++

      // Claim (compare-and-swap on the previous value): exactly one run wins.
      const claimedAt = new Date().toISOString()
      let claimQuery = supabase.from('enrollments').update({ last_inactivity_nudge_at: claimedAt }).eq('id', enr.id)
      claimQuery = enr.last_inactivity_nudge_at
        ? claimQuery.eq('last_inactivity_nudge_at', enr.last_inactivity_nudge_at)
        : claimQuery.is('last_inactivity_nudge_at', null)
      const { data: claimed } = await claimQuery.select('id').maybeSingle()
      if (!claimed) { stats.skipped.raced++; continue }

      let delivered = false
      let declined = false
      if (enr.telegram_chat_id) {
        const r = await sendViaBot(enr.id, target.order_num)
        if (r === 'sent') { delivered = true; stats.sent.telegram++ }
        else if (r === 'skipped') declined = true
      }
      if (emailInfo.email) {
        const r = await sendViaEmail({
          course,
          enrollment: enr,
          lesson: target,
          email: emailInfo.email,
          studentName: emailInfo.name,
        })
        if (r === 'sent') { delivered = true; stats.sent.email++ }
      }

      if (delivered) {
        stats.nudged++
      } else {
        // Nothing reached the student: give the claim back so tomorrow's run tries again.
        await supabase
          .from('enrollments')
          .update({ last_inactivity_nudge_at: enr.last_inactivity_nudge_at ?? null })
          .eq('id', enr.id)
          .eq('last_inactivity_nudge_at', claimedAt)
        declined ? stats.skipped.botDeclined++ : stats.failed++
      }
      await sleep(SEND_GAP_MS)
    }

    return NextResponse.json({ ok: true, ...stats })
  } catch (err: any) {
    console.error('[cron/inactivity-nudge]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}