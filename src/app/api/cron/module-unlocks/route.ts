/**
 * src/app/api/cron/module-unlocks/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Daily job: tells students that a new module has unlocked for them,
 * on Telegram and/or by email.
 *
 * Register in vercel.json:  { "path": "/api/cron/module-unlocks", "schedule": "0 4 * * *" }
 * (04:xx UTC = 09:30-10:29 IST, i.e. just after the default 09:00 IST unlock time.)
 *
 * How it works
 *  1. For every drip course (fixed_calendar / per_student_drip) it works out, per
 *     paid enrollment and per module, the exact moment the module opened
 *     (computeModuleUnlockAt — the same rule that locks the content).
 *  2. A notification is due only if that moment has passed, is no older than
 *     LOOKBACK_HOURS, and is AFTER the student enrolled (modules open from the
 *     start are covered by the enrollment message, not announced as "new").
 *  3. Channels: Telegram if the enrollment has a chat id; email if there is an
 *     address on file. Each channel is deduped separately.
 *  4. Dedup: a row in module_unlock_notifications is claimed BEFORE sending
 *     (unique per enrollment+module+channel). If the send fails the claim is
 *     released so tomorrow's run retries (still inside the lookback window).
 *  5. Telegram goes through the bot (/internal/send-module-unlock), which re-checks
 *     payment + lock state itself. Email carries a fresh 24h single-use link that
 *     opens the module's first lesson.
 * ─────────────────────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeModuleUnlockAt } from '@/lib/moduleLock'
import { sendLoggedEmail } from '@/lib/email'
import { createEmailAccessUrl, getEnrollmentEmail, renderModuleUnlockEmail } from '@/lib/emailAccess'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LOOKBACK_HOURS = 48
const MAX_SENDS_PER_RUN = 150
const SEND_GAP_MS = 60 // stay well under Telegram's ~30 msgs/sec

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type SendResult = 'sent' | 'skipped' | 'failed'
type Channel = 'telegram' | 'email'

async function sendViaBot(enrollmentId: string, moduleId: string): Promise<SendResult> {
  const baseUrl = process.env.TELEGRAM_BOT_URL
  const secret = process.env.INTERNAL_BOT_SECRET
  if (!baseUrl || !secret) {
    console.warn('[module-unlocks] TELEGRAM_BOT_URL / INTERNAL_BOT_SECRET not configured, skipping')
    return 'failed'
  }
  try {
    const res = await fetch(`${baseUrl}/internal/send-module-unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ enrollmentId, moduleId }),
    })
    if (res.ok) return 'sent'
    // 409 = the bot decided this must not be sent (still locked / no longer paid / no lessons).
    if (res.status === 409) return 'skipped'
    console.error('[module-unlocks] bot rejected send:', res.status, await res.text().catch(() => ''))
    return 'failed'
  } catch (err) {
    console.error('[module-unlocks] failed to reach bot:', err)
    return 'failed'
  }
}

async function sendViaEmail(input: {
  course: { id: string; name: string | null; creator_id: string | null }
  enrollment: { id: string; student_id: string | null; creator_id: string | null }
  moduleName: string
  firstLessonNum: number | null
  email: string
  studentName: string | null
}): Promise<SendResult> {
  let created: { url: string; tokenHash: string } | null = null
  try {
    created = await createEmailAccessUrl(supabase, {
      courseId: input.course.id,
      enrollmentId: input.enrollment.id,
      studentId: input.enrollment.student_id,
      lessonNum: input.firstLessonNum,
    })
    const { subject, html } = renderModuleUnlockEmail({
      studentName: input.studentName,
      courseName: input.course.name || 'your course',
      moduleName: input.moduleName || 'Next module',
      link: created.url,
    })
    const result = await sendLoggedEmail({
      supabase,
      emailType: 'student_module_unlocked',
      to: input.email,
      subject,
      html,
      creatorId: input.enrollment.creator_id || input.course.creator_id || null,
      studentId: input.enrollment.student_id,
      courseId: input.course.id,
      metadata: { enrollment_id: input.enrollment.id },
    })
    if (result.sent) return 'sent'
    await supabase.from('web_bootstrap_tokens').delete().eq('token_hash', created.tokenHash)
    return 'failed'
  } catch (err) {
    console.error('[module-unlocks] email send failed:', err)
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
    const earliest = now - LOOKBACK_HOURS * 60 * 60 * 1000
    const stats = {
      courses: 0,
      due: 0,
      sent: { telegram: 0, email: 0 },
      skipped: 0,
      failed: 0,
      alreadySent: 0,
      capped: false,
    }
    let attempts = 0

    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, name, creator_id, delivery_mode, delivery_unlock_time')
      .in('delivery_mode', ['fixed_calendar', 'per_student_drip'])
    if (coursesError) throw coursesError

    for (const course of courses || []) {
      stats.courses++

      const { data: modules } = await supabase
        .from('course_modules')
        .select('id, name, unlock_date, unlock_after_days')
        .eq('course_id', course.id)
      if (!modules?.length) continue

      // Only announce modules that actually contain a published lesson; remember each
      // module's first lesson so the email link opens it directly.
      const { data: lessons } = await supabase
        .from('lessons')
        .select('module_id, order_num')
        .eq('course_id', course.id)
        .eq('is_published', true)
      const firstLessonByModule = new Map<string, number>()
      for (const l of lessons || []) {
        if (!l.module_id) continue
        const prev = firstLessonByModule.get(l.module_id)
        if (prev === undefined || l.order_num < prev) firstLessonByModule.set(l.module_id, l.order_num)
      }
      const candidateModules = modules.filter(m => firstLessonByModule.has(m.id))
      if (!candidateModules.length) continue

      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, enrolled_at, telegram_chat_id, student_email, student_id, creator_id')
        .eq('course_uuid', course.id)
        .eq('payment_status', 'paid')
      if (!enrollments?.length) continue

      const { data: already } = await supabase
        .from('module_unlock_notifications')
        .select('enrollment_id, module_id, channel')
        .in('enrollment_id', enrollments.map(e => e.id))
      const alreadyKeys = new Set((already || []).map(r => `${r.enrollment_id}:${r.module_id}:${r.channel}`))

      for (const enrollment of enrollments) {
        // Email on file (enrollment's own, else the student's). Resolved lazily, once per student.
        let emailInfo: { email: string | null; name: string | null } | null = null

        for (const mod of candidateModules) {
          const unlockAt = computeModuleUnlockAt({
            deliveryMode: course.delivery_mode,
            unlockTime: course.delivery_unlock_time,
            module: mod,
            enrolledAt: enrollment.enrolled_at,
          })
          if (!unlockAt) continue

          const t = unlockAt.getTime()
          if (t > now) continue // not open yet
          if (t < earliest) continue // too old — never blast a backlog
          if (enrollment.enrolled_at && t <= new Date(enrollment.enrolled_at).getTime()) continue // open from the start

          const wanted: Channel[] = []
          if (enrollment.telegram_chat_id) wanted.push('telegram')
          if (!emailInfo) emailInfo = await getEnrollmentEmail(supabase, enrollment)
          if (emailInfo.email) wanted.push('email')

          for (const channel of wanted) {
            if (alreadyKeys.has(`${enrollment.id}:${mod.id}:${channel}`)) { stats.alreadySent++; continue }

            stats.due++
            if (attempts >= MAX_SENDS_PER_RUN) { stats.capped = true; continue }
            attempts++

            // Claim first (unique constraint = dedup even if two runs overlap).
            const { error: claimError } = await supabase.from('module_unlock_notifications').insert({
              enrollment_id: enrollment.id,
              module_id: mod.id,
              channel,
            })
            if (claimError) {
              if ((claimError as any).code === '23505') { stats.alreadySent++; continue }
              console.error('[module-unlocks] claim failed', claimError)
              stats.failed++
              continue
            }

            const result =
              channel === 'telegram'
                ? await sendViaBot(enrollment.id, mod.id)
                : await sendViaEmail({
                    course,
                    enrollment,
                    moduleName: mod.name || 'Next module',
                    firstLessonNum: firstLessonByModule.get(mod.id) ?? null,
                    email: emailInfo!.email!,
                    studentName: emailInfo!.name,
                  })

            if (result === 'sent') {
              stats.sent[channel]++
            } else {
              // Release the claim so the next run can retry (still inside the lookback window).
              await supabase
                .from('module_unlock_notifications')
                .delete()
                .eq('enrollment_id', enrollment.id)
                .eq('module_id', mod.id)
                .eq('channel', channel)
              result === 'skipped' ? stats.skipped++ : stats.failed++
            }
            await sleep(SEND_GAP_MS)
          }
        }
      }
    }

    return NextResponse.json({ ok: true, ...stats })
  } catch (err: any) {
    console.error('[cron/module-unlocks]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}