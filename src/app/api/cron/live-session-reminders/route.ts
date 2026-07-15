/**
 * Triggered by Vercel Cron every ~5 minutes (see vercel.json below).
 * Finds live lessons starting in roughly 55–65 minutes, finds every
 * enrolled+paid student currently AT that lesson's order_num who has
 * opted into a reminder channel, and hands off to that channel's bot.
 *
 * NOTE: the actual bot-side endpoints (/internal/send-reminder on
 * telegram-bot and Whatsapp-bot) don't exist yet — that's the next
 * stage. This job is fully wired and testable except for that final
 * delivery call, which will currently fail until those are built.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendViaBot(channel: 'whatsapp' | 'telegram', phone: string, message: string) {
  const baseUrl = channel === 'whatsapp' ? process.env.WHATSAPP_BOT_URL : process.env.TELEGRAM_BOT_URL
  const secret = process.env.INTERNAL_BOT_SECRET
  if (!baseUrl || !secret) {
    console.warn(`[live-reminders] ${channel} bot URL/secret not configured, skipping send to ${phone}`)
    return
  }
  try {
    await fetch(`${baseUrl}/internal/send-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ phone, message }),
    })
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
    const windowStart = new Date(Date.now() + 55 * 60 * 1000).toISOString()
    const windowEnd = new Date(Date.now() + 65 * 60 * 1000).toISOString()

    const { data: dueLessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, title, course_id, order_num, live_scheduled_at, courses(name)')
      .eq('content_type', 'live')
      .eq('is_published', true)
      .is('reminder_sent_at', null)
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

      for (const s of students || []) {
        const channel = (s as any).students?.reminder_channel
        if (channel !== 'whatsapp' && channel !== 'telegram') continue
        if (!s.phone) continue

        const courseName = (lesson as any).courses?.name || 'your course'
        const timeLabel = new Date(lesson.live_scheduled_at).toLocaleString('en-IN', {
          hour: 'numeric', minute: '2-digit', hour12: true,
        })
        const message = `🔴 Reminder: "${lesson.title}" for ${courseName} starts at ${timeLabel} — about 1 hour from now. Open your lesson to join.`

        await sendViaBot(channel, s.phone, message)
        sentCount++
      }

      await supabase.from('lessons').update({ reminder_sent_at: new Date().toISOString() }).eq('id', lesson.id)
    }

    return NextResponse.json({ ok: true, sent: sentCount })
  } catch (err: any) {
    console.error('[live-reminders]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}