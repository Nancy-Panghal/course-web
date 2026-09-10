import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLoggedEmail, escapeHtml } from '@/lib/email'
import { getSubscriptionPlan } from '@/app/api/razorpay/subscription-plans'
import { previousMonthRange, REVENUE_SHARE_INVOICE_GRACE_DAYS, EBOOK_REVENUE_SHARE_RATE_PERCENT, EBOOK_MONTHLY_REVENUE_FLOOR } from '@/lib/revenueShare'

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

  const results = {
    checked: 0, sent7d: 0, sent1d: 0, expired: 0,
    revenueShareInvoicesGenerated: 0, revenueShareOverdueReminders: 0, revenueShareOverdueUnpublished: 0,
    errors: [] as string[],
  }

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
          .update({ is_published: false, auto_unpublished_at: now.toISOString(), auto_unpublished_reason: 'subscription_expired' })
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

    await runRevenueShareSweep(now, results)

    return NextResponse.json({ ok: true, ...results })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, ...results }, { status: 500 })
  }
}

/**
 * Runs on the same daily tick as the subscription sweep above.
 *
 * Three jobs:
 * 1. Generate last month's COURSE invoice for every active Pay-As-You-Earn
 *    creator, if it doesn't already exist yet (idempotent — safe to run
 *    every day, not just on the 1st, so a missed cron run never skips a
 *    creator). Zero revenue that month → invoice still created, but
 *    marked 'not_due' so it never shows a payment prompt or a reminder —
 *    "pay only in months you earn" is enforced right here.
 * 2. Generate last month's EBOOK invoice for every creator with ebook
 *    sales that month — unconditionally, regardless of course plan,
 *    since ebook selling is never gated behind any plan. Below the
 *    ₹500 monthly floor → 'not_due', same as zero course revenue.
 *    Kept as a SEPARATE invoice row (product_type) per Nancy's call —
 *    a creator can owe course commission, ebook commission, both, or
 *    neither in the same month, each tracked and paid independently.
 * 3. Sweep invoices that are still 'pending' REVENUE_SHARE_INVOICE_GRACE_DAYS
 *    after being generated, with no pending waiver request. Enforcement
 *    differs by type: an overdue COURSE invoice pauses new enrollments
 *    (mirrors the subscription auto-expiry sweep); an overdue EBOOK
 *    invoice pauses new ebook sales only. Neither ever touches students
 *    or buyers who already paid.
 */
async function runRevenueShareSweep(now: Date, results: {
  revenueShareInvoicesGenerated: number
  revenueShareOverdueReminders: number
  revenueShareOverdueUnpublished: number
  errors: string[]
}) {
  const { start, end } = previousMonthRange(now)

  // ── 1. Course invoices — only for active PAYE agreements ──────────
  const { data: agreements, error: agErr } = await supabase
    .from('revenue_share_agreements')
    .select('id, creator_id, base_rate_percent')
    .eq('status', 'active')
  if (agErr) { results.errors.push(`revenue-share agreements query: ${agErr.message}`) }

  for (const agreement of agreements || []) {
    try {
      const { data: existingInvoice } = await supabase
        .from('revenue_share_invoices')
        .select('id')
        .eq('creator_id', agreement.creator_id)
        .eq('period_start', start)
        .eq('product_type', 'course')
        .maybeSingle()
      if (existingInvoice) continue

      const { data: periodPayments, error: payErr } = await supabase
        .from('payments')
        .select('gross_amount, platform_fee')
        .eq('creator_id', agreement.creator_id)
        .eq('status', 'paid')
        .not('course_id', 'is', null)
        .gte('paid_at', `${start}T00:00:00.000Z`)
        .lte('paid_at', `${end}T23:59:59.999Z`)
      if (payErr) throw payErr

      const grossRevenue = (periodPayments || []).reduce((sum, p) => sum + (p.gross_amount || 0), 0)
      const totalAmountDue = (periodPayments || []).reduce((sum, p) => sum + (p.platform_fee || 0), 0)

      await supabase.from('revenue_share_invoices').insert({
        creator_id: agreement.creator_id,
        agreement_id: agreement.id,
        product_type: 'course',
        period_start: start,
        period_end: end,
        gross_revenue: grossRevenue,
        total_amount_due: totalAmountDue,
        status: totalAmountDue > 0 ? 'pending' : 'not_due',
      })
      results.revenueShareInvoicesGenerated++
    } catch (e: any) {
      results.errors.push(`course revenue-share invoice for creator ${agreement.creator_id}: ${e.message}`)
    }
  }

  // ── 2. Ebook invoices — every creator with ebook sales, unconditionally ──
  const { data: ebookPayments, error: ebookPayErr } = await supabase
    .from('payments')
    .select('creator_id, gross_amount')
    .eq('status', 'paid')
    .eq('product_type', 'ebook')
    .gte('paid_at', `${start}T00:00:00.000Z`)
    .lte('paid_at', `${end}T23:59:59.999Z`)
  if (ebookPayErr) {
    results.errors.push(`ebook payments query: ${ebookPayErr.message}`)
  } else {
    const ebookGrossByCreator = new Map<string, number>()
    for (const p of ebookPayments || []) {
      ebookGrossByCreator.set(p.creator_id, (ebookGrossByCreator.get(p.creator_id) || 0) + (p.gross_amount || 0))
    }

    for (const [creatorId, ebookGross] of ebookGrossByCreator.entries()) {
      try {
        const { data: existingInvoice } = await supabase
          .from('revenue_share_invoices')
          .select('id')
          .eq('creator_id', creatorId)
          .eq('period_start', start)
          .eq('product_type', 'ebook')
          .maybeSingle()
        if (existingInvoice) continue

        const totalAmountDue = ebookGross >= EBOOK_MONTHLY_REVENUE_FLOOR
          ? Math.round((ebookGross * EBOOK_REVENUE_SHARE_RATE_PERCENT) / 100)
          : 0

        await supabase.from('revenue_share_invoices').insert({
          creator_id: creatorId,
          product_type: 'ebook',
          period_start: start,
          period_end: end,
          gross_revenue: ebookGross,
          total_amount_due: totalAmountDue,
          status: totalAmountDue > 0 ? 'pending' : 'not_due',
        })
        results.revenueShareInvoicesGenerated++
      } catch (e: any) {
        results.errors.push(`ebook revenue-share invoice for creator ${creatorId}: ${e.message}`)
      }
    }
  }

  // ── 3. Overdue sweep — covers both invoice types ──────────────────
  const { data: pendingInvoices, error: pendErr } = await supabase
    .from('revenue_share_invoices')
    .select('id, creator_id, product_type, total_amount_due, created_at, reminder_sent_at, creators(name, email)')
    .eq('status', 'pending')
    .gt('total_amount_due', 0)
  if (pendErr) { results.errors.push(`revenue-share pending invoices query: ${pendErr.message}`); return }

  for (const invoice of pendingInvoices || []) {
    try {
      const ageDays = (now.getTime() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24)
      const creator = (invoice as any).creators
      const isEbook = invoice.product_type === 'ebook'

      const { data: pendingWaiver } = await supabase
        .from('revenue_share_waiver_requests')
        .select('id')
        .eq('invoice_id', invoice.id)
        .eq('status', 'pending')
        .maybeSingle()
      if (pendingWaiver) continue // creator's asked for a review — hold off entirely until you decide

      // One reminder, a few days before enforcement kicks in.
      if (ageDays >= REVENUE_SHARE_INVOICE_GRACE_DAYS - 4 && ageDays < REVENUE_SHARE_INVOICE_GRACE_DAYS && !invoice.reminder_sent_at) {
        if (creator?.email) {
          await sendLoggedEmail({
            supabase,
            emailType: isEbook ? 'ebook_revenue_share_invoice_reminder' : 'revenue_share_invoice_reminder',
            to: creator.email,
            subject: `Your Kurso ${isEbook ? 'ebook ' : ''}commission of ₹${invoice.total_amount_due} is due`,
            html: revenueShareReminderEmailHtml({
              name: creator.name, amount: invoice.total_amount_due,
              daysLeft: Math.max(0, Math.ceil(REVENUE_SHARE_INVOICE_GRACE_DAYS - ageDays)), isEbook,
            }),
            creatorId: invoice.creator_id,
          })
        }
        await supabase.from('revenue_share_invoices').update({ reminder_sent_at: now.toISOString() }).eq('id', invoice.id)
        results.revenueShareOverdueReminders++
      }

      if (ageDays >= REVENUE_SHARE_INVOICE_GRACE_DAYS) {
        await supabase.from('revenue_share_invoices').update({ status: 'overdue', overdue_at: now.toISOString() }).eq('id', invoice.id)

        if (isEbook) {
          // Blocks NEW ebook sales only — existing buyers keep their
          // downloads, and this never touches the creator's courses.
          await supabase.from('ebooks')
            .update({ is_published: false, auto_unpublished_at: now.toISOString(), auto_unpublished_reason: 'ebook_revenue_share_overdue' })
            .eq('creator_id', invoice.creator_id)
            .eq('is_published', true)
        } else {
          await supabase.from('courses')
            .update({ is_published: false, auto_unpublished_at: now.toISOString(), auto_unpublished_reason: 'revenue_share_overdue' })
            .eq('creator_id', invoice.creator_id)
            .eq('is_published', true)
        }

        results.revenueShareOverdueUnpublished++

        if (creator?.email) {
          await sendLoggedEmail({
            supabase,
            emailType: isEbook ? 'ebook_revenue_share_invoice_overdue' : 'revenue_share_invoice_overdue',
            to: creator.email,
            subject: isEbook ? 'New ebook sales paused — unpaid commission' : 'Your Kurso courses have been paused — unpaid commission',
            html: revenueShareOverdueEmailHtml({ name: creator.name, amount: invoice.total_amount_due, isEbook }),
            creatorId: invoice.creator_id,
          })
        }
      }
    } catch (e: any) {
      results.errors.push(`revenue-share overdue check ${invoice.id}: ${e.message}`)
    }
  }
}

function revenueShareReminderEmailHtml({ name, amount, daysLeft, isEbook }: { name: string; amount: number; daysLeft: number; isEbook?: boolean }) {
  const safeName = escapeHtml(name || 'there')
  const consequence = isEbook
    ? 'or new ebook sales pause (anyone who already bought keeps their download either way)'
    : 'or your courses pause for new enrollments (existing students keep full access either way)'
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
      <p>Hi ${safeName},</p>
      <p>Last month you collected enough for a Kurso ${isEbook ? 'ebook ' : ''}commission of <strong>₹${amount}</strong>. It's due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}, ${consequence}.</p>
      <p>Pay now, or if it was a slow month, request a waiver — both from your dashboard:</p>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/upgrade" style="display:inline-block;padding:10px 20px;background:#f79514;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Go to billing</a></p>
      <p style="font-size: 13px; color: #71717a;">— Team Kurso</p>
    </div>
  `
}

function revenueShareOverdueEmailHtml({ name, amount, isEbook }: { name: string; amount: number; isEbook?: boolean }) {
  const safeName = escapeHtml(name || 'there')
  const consequence = isEbook
    ? "we've paused new sales of your ebooks. Anyone who already bought keeps their download — nothing changes for them, and your courses are completely unaffected."
    : "we've paused your courses for <strong>new</strong> enrollments. Students who already enrolled keep full access — nothing changes for them."
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
      <p>Hi ${safeName},</p>
      <p>Your unpaid Kurso ${isEbook ? 'ebook ' : ''}commission of <strong>₹${amount}</strong> has gone past the grace period, so ${consequence}</p>
      <p>Pay the invoice to go live again immediately:</p>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/upgrade" style="display:inline-block;padding:10px 20px;background:#f79514;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Go to billing</a></p>
      <p style="font-size: 13px; color: #71717a;">— Team Kurso</p>
    </div>
  `
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
