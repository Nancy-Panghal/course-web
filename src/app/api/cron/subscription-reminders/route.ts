import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLoggedEmail, escapeHtml } from '@/lib/email'
import { getSubscriptionPlan } from '@/app/api/razorpay/subscription-plans'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// A pending extension request holds off auto-expiry, but only for this many
// days from when it was submitted — an unreviewed request can't stall a
// lapsed plan open indefinitely. The request itself stays "pending" either
// way; approving it later still re-extends the period and re-publishes
// whatever this sweep paused.
const EXTENSION_REQUEST_GRACE_DAYS = 5

/**
 * Runs once a day (Vercel free plan supports a single daily cron — see
 * vercel.json). Does two things in one pass, since only one daily cron
 * job is available:
 *
 * 1. Reminders — finds active subscriptions expiring in exactly 7 days or
 *    exactly 1 day and emails the creator, guarded by reminder_*_sent_at so
 *    a manual re-trigger on the same day never double-sends.
 *
 * 2. Auto-expiry — a subscription whose period has fully lapsed (past
 *    current_period_end) with no extension request pending gets marked
 *    'expired', and that creator's currently-published courses get
 *    unpublished (stops new enrollments/sales). This deliberately does NOT
 *    touch existing enrollments — students who already enrolled keep their
 *    access; "their course stays live" for people who already paid, only
 *    new signups stop. A pending extension request gives one full grace
 *    period so a creator awaiting your review is never auto-expired out
 *    from under them.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = { checked: 0, sent7d: 0, sent1d: 0, expired: 0, errors: [] as string[] }

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

    // 2. Auto-expiry sweep — subscriptions that have fully lapsed with no
    // extension pending. Re-query rather than reuse `subs` above: a
    // subscription with daysLeft <= 0 wasn't in the 7d/1d reminder set
    // anyway (that loop only matched daysLeft === 7 or 1), so this needs
    // its own pass covering "already past current_period_end".
    const { data: lapsedSubs, error: lapsedErr } = await supabase
      .from('subscriptions')
      .select('id, creator_id, plan_tier, current_period_end, creators(name, email)')
      .eq('status', 'active')
      .lt('current_period_end', now.toISOString())

    if (lapsedErr) throw lapsedErr

    for (const sub of lapsedSubs || []) {
      try {
        const { data: pendingExt } = await supabase
          .from('subscription_extension_requests')
          .select('id, requested_at')
          .eq('creator_id', sub.creator_id)
          .eq('status', 'pending')
          .maybeSingle()
        // Grace: a request awaiting your review holds off auto-expiry — but
        // only for EXTENSION_REQUEST_GRACE_DAYS from when it was submitted,
        // so an unreviewed request can't hold a lapsed plan open forever.
        // Still shows as "pending" for you to decide later — approving it
        // afterward re-extends the period and re-publishes the course(s)
        // it paused (see the admin extension-requests route).
        if (pendingExt) {
          const requestAgeDays = (now.getTime() - new Date(pendingExt.requested_at).getTime()) / (1000 * 60 * 60 * 24)
          if (requestAgeDays < EXTENSION_REQUEST_GRACE_DAYS) continue
        }

        await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', sub.id)

        // Unpublish only currently-published courses — stops new
        // enrollments/sales, but never touches existing enrollments; those
        // students keep the access they already paid for. Mark
        // auto_unpublished_at so a later renewal (webhook) or extension
        // approval knows it's safe to republish these specifically —
        // never a course the creator chose to draft themselves.
        await supabase.from('courses')
          .update({ is_published: false, auto_unpublished_at: now.toISOString() })
          .eq('creator_id', sub.creator_id)
          .eq('is_published', true)

        results.expired++

        const creator = (sub as any).creators
        if (creator?.email) {
          await sendLoggedEmail({
            supabase,
            emailType: 'subscription_expired',
            to: creator.email,
            subject: 'Your Kurso plan has expired — new enrollments paused',
            html: expiredEmailHtml({ name: creator.name }),
            creatorId: sub.creator_id,
          })
        }
      } catch (e: any) {
        results.errors.push(`expire sub ${sub.id}: ${e.message}`)
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, ...results }, { status: 500 })
  }
}

function expiredEmailHtml({ name }: { name: string }) {
  const safeName = escapeHtml(name || 'there')
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
      <p>Hi ${safeName},</p>
      <p>Your Kurso plan has expired. Your published courses have been paused for <strong>new</strong> enrollments — students who already enrolled keep full access, nothing changes for them.</p>
      <p>Renew any time to make your courses live again:</p>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/upgrade" style="display:inline-block;padding:10px 20px;background:#f79514;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Renew now</a></p>
      <p style="font-size: 13px; color: #71717a;">— Team Kurso</p>
    </div>
  `
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
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/upgrade" style="display:inline-block;padding:10px 20px;background:#f79514;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Renew now</a></p>
      ${daysLeft === 1 ? `<p style="font-size: 13px; color: #71717a;">Can't pay right now? You can request a short extension from the same page — we review these manually and usually respond quickly.</p>` : ''}
      <p style="font-size: 13px; color: #71717a;">— Team Kurso</p>
    </div>
  `
}
