import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLoggedEmail, escapeHtml } from '@/lib/email'
import { getSubscriptionPlan } from '@/app/api/razorpay/subscription-plans'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Runs once a day (Vercel free plan supports a single daily cron — see
 * vercel.json). Finds active subscriptions expiring in exactly 7 days or
 * exactly 1 day and emails the creator, guarded by reminder_*_sent_at so a
 * manual re-trigger on the same day never double-sends.
 *
 * This only sends reminders — it does not touch subscription status or
 * course visibility. Extension requests (separate feature) are how a
 * creator avoids losing access if they can't pay in time.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = { checked: 0, sent7d: 0, sent1d: 0, errors: [] as string[] }

  try {
    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('id, creator_id, plan_tier, status, current_period_end, reminder_7d_sent_at, reminder_1d_sent_at, creators(name, email)')
      .eq('status', 'active')
      .not('current_period_end', 'is', null)

    if (error) throw error
    results.checked = subs?.length || 0

    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10) // YYYY-MM-DD, for the "already sent today" guard

    for (const sub of subs || []) {
      const creator = (sub as any).creators
      if (!creator?.email) continue

      const periodEnd = new Date(sub.current_period_end)
      const daysLeft = Math.round((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const plan = getSubscriptionPlan(sub.plan_tier)
      const planName = plan?.name || sub.plan_tier

      const alreadySent7d = sub.reminder_7d_sent_at && sub.reminder_7d_sent_at.slice(0, 10) === todayKey
      const alreadySent1d = sub.reminder_1d_sent_at && sub.reminder_1d_sent_at.slice(0, 10) === todayKey

      try {
        if (daysLeft === 7 && !alreadySent7d) {
          await sendLoggedEmail({
            supabase,
            emailType: 'subscription_expiry_reminder_7d',
            to: creator.email,
            subject: `Your Kurso ${planName} plan renews in 7 days`,
            html: reminderEmailHtml({ name: creator.name, planName, daysLeft: 7, periodEnd }),
            creatorId: sub.creator_id,
          })
          await supabase.from('subscriptions').update({ reminder_7d_sent_at: now.toISOString() }).eq('id', sub.id)
          results.sent7d++
        }

        if (daysLeft === 1 && !alreadySent1d) {
          await sendLoggedEmail({
            supabase,
            emailType: 'subscription_expiry_reminder_1d',
            to: creator.email,
            subject: `Your Kurso ${planName} plan expires tomorrow`,
            html: reminderEmailHtml({ name: creator.name, planName, daysLeft: 1, periodEnd }),
            creatorId: sub.creator_id,
          })
          await supabase.from('subscriptions').update({ reminder_1d_sent_at: now.toISOString() }).eq('id', sub.id)
          results.sent1d++
        }
      } catch (e: any) {
        results.errors.push(`sub ${sub.id}: ${e.message}`)
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, ...results }, { status: 500 })
  }
}

function reminderEmailHtml({ name, planName, daysLeft, periodEnd }: { name: string; planName: string; daysLeft: number; periodEnd: Date }) {
  const safeName = escapeHtml(name || 'there')
  const dateStr = periodEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const urgency = daysLeft === 1
    ? `Your <strong>${escapeHtml(planName)}</strong> plan expires tomorrow (${dateStr}). If it lapses, your course's delivery channels will stop working for new students.`
    : `Your <strong>${escapeHtml(planName)}</strong> plan renews in ${daysLeft} days, on ${dateStr}.`
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
      <p>Hi ${safeName},</p>
      <p>${urgency}</p>
      <p>To keep your courses live without interruption, renew from your dashboard:</p>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/upgrade" style="display:inline-block;padding:10px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Renew now</a></p>
      ${daysLeft === 1 ? `<p style="font-size: 13px; color: #71717a;">Can't pay right now? You can request a short extension from the same page — we review these manually and usually respond quickly.</p>` : ''}
      <p style="font-size: 13px; color: #71717a;">— Team Kurso</p>
    </div>
  `
}
