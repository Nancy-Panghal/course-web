/**
 * ═══════════════════════════════════════════════════════════════════
 * CURRENT VERSION — for Vercel Hobby (free tier: 1 cron job, once/day)
 * ═══════════════════════════════════════════════════════════════════
 * Set this up in Vercel dashboard → Settings → Cron Jobs:
 *   Path:     /api/cron/live-session-reminders
 *   Schedule: 0 3 * * *     (once a day, e.g. 3:00 AM IST — any time works,
 *                             it just needs to run once daily)
 *
 * WHAT THIS DOES vs WHAT IT DOESN'T:
 * Because this only runs once a day, it can't fire a precise "starts in
 * exactly 24 hours" reminder — depending on what time of day it runs vs.
 * what time the class is scheduled, the actual lead time when a student
 * gets this message could be anywhere from ~24 to ~48 hours before class.
 * The message below is worded around a full date/time rather than a
 * relative "24 hours" claim, so it stays accurate regardless of exactly
 * when it fires. Every live class still gets exactly ONE advance
 * reminder — `reminder_24h_sent_at` gates that — it just isn't pinned to
 * a precise 24h mark on this tier.
 *
 * The 30-MINUTE join-link reminder is NOT handled here at all — it's
 * handled by the whatsapp-bot itself (see wa-bot/index.js's
 * pollLiveClassReminders, running on its own 5-minute internal timer on
 * Railway, which has no cron-frequency limit). That's the piece that
 * actually needs 5-minute precision, so it lives where 5-minute polling
 * is free and unlimited.
 *
 * When you upgrade off Hobby: swap in route.future.ts (same folder,
 * inert until renamed to route.ts) for a precise ~24h-before window
 * instead of this 24–48h wide one.
 * ═══════════════════════════════════════════════════════════════════
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendViaBot(
  channel: 'whatsapp' | 'telegram',
  phone: string,
  fields: { lessonTitle: string; courseName: string; timeLabel: string; joinUrl: string },
) {
  const baseUrl = channel === 'whatsapp' ? process.env.WHATSAPP_BOT_URL : process.env.TELEGRAM_BOT_URL
  const secret = process.env.INTERNAL_BOT_SECRET
  if (!baseUrl || !secret) {
    console.warn(`[live-reminders] ${channel} bot URL/secret not configured, skipping send to ${phone}`)
    return
  }
  try {
    const res = await fetch(`${baseUrl}/internal/send-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ phone, kind: '24h', ...fields }),
    })
    if (!res.ok) {
      console.error(`[live-reminders] ${channel} bot rejected reminder for ${phone}:`, res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error(`[live-reminders] failed to send via ${channel}:`, err)
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Wide window (24h–48h out) because this only gets ONE shot per day —
    // narrower and a class could slip through the gap between two runs.
    const windowStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const windowEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const { data: dueLessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, title, course_id, order_num, live_join_url, live_scheduled_at, courses(name)')
      .eq('content_type', 'live')
      .eq('is_published', true)
      .is('reminder_24h_sent_at', null)
      .not('live_join_url', 'is', null)
      .gte('live_scheduled_at', windowStart)
      .lte('live_scheduled_at', windowEnd)

    if (lessonsError) throw lessonsError
    if (!dueLessons?.length) return NextResponse.json({ ok: true, sent: 0 })

    let sentCount = 0

    for (const lesson of dueLessons) {
      const { data: students, error: studentsError } = await supabase
        .from('enrollments')
        .select('phone, students(reminder_channel)')
        .eq('course_uuid', lesson.course_id)
        .eq('current_lesson', lesson.order_num)
        .eq('payment_status', 'paid')

      if (studentsError) {
        console.error('[live-reminders] enrollment lookup failed for lesson', lesson.id, studentsError)
        continue
      }

      const courseName = (lesson as any).courses?.name || 'your course'
      const fullDateLabel = new Date(lesson.live_scheduled_at).toLocaleString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
      })

      for (const s of students || []) {
        const channel = (s as any).students?.reminder_channel
        if (channel !== 'whatsapp' && channel !== 'telegram') continue
        if (!s.phone) continue

        await sendViaBot(channel, s.phone, {
          lessonTitle: lesson.title,
          courseName,
          timeLabel: fullDateLabel,
          joinUrl: lesson.live_join_url,
        })
        sentCount++
      }

      await supabase.from('lessons').update({ reminder_24h_sent_at: new Date().toISOString() }).eq('id', lesson.id)
    }

    return NextResponse.json({ ok: true, sent: sentCount })
  } catch (err: any) {
    console.error('[live-reminders]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}