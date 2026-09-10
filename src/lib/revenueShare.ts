import { createClient } from '@supabase/supabase-js'

/**
 * src/lib/revenueShare.ts
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for the "Pay As You Earn" pricing numbers and
 * the per-transaction commission split. Change the rate/threshold here
 * only — the pricing page copy, the webhook, and the invoice cron all
 * read from these constants so they can never drift out of sync.
 * ─────────────────────────────────────────────────────────────────
 */
export const REVENUE_SHARE_BASE_RATE_PERCENT = 5
export const REVENUE_SHARE_OVERFLOW_RATE_PERCENT = 6.5
export const REVENUE_SHARE_STUDENT_THRESHOLD = 300
export const REVENUE_SHARE_INVOICE_GRACE_DAYS = 14

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type RevenueShareSplit = {
  platformFee: number
  creatorEarning: number
  ratePercent: number | null
}

/**
 * Computes how much of a single course-sale goes to Kurso as commission.
 * Returns platformFee: 0 for any creator without an active Pay-As-You-Earn
 * agreement — every flat-plan creator, and every payment recorded before
 * this feature existed, is completely unaffected. This is the only place
 * that decides the split; the webhook just calls it and stores the result.
 */
export async function computeRevenueShareSplit(creatorId: string, grossAmount: number): Promise<RevenueShareSplit> {
  const { data: agreement } = await supabase
    .from('revenue_share_agreements')
    .select('base_rate_percent, overflow_rate_percent, overflow_threshold_students')
    .eq('creator_id', creatorId)
    .eq('status', 'active')
    .maybeSingle()

  if (!agreement) return { platformFee: 0, creatorEarning: grossAmount, ratePercent: null }

  const { count } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId)
    .eq('payment_status', 'paid')
    .eq('is_test', false)

  const overThreshold = (count || 0) > (agreement.overflow_threshold_students ?? REVENUE_SHARE_STUDENT_THRESHOLD)
  const ratePercent = overThreshold
    ? Number(agreement.overflow_rate_percent ?? REVENUE_SHARE_OVERFLOW_RATE_PERCENT)
    : Number(agreement.base_rate_percent ?? REVENUE_SHARE_BASE_RATE_PERCENT)

  const platformFee = Math.round((grossAmount * ratePercent) / 100)
  const creatorEarning = grossAmount - platformFee

  return { platformFee, creatorEarning, ratePercent }
}

/** YYYY-MM-01 for the first day of the month containing `date` (defaults to now). */
export function monthStart(date: Date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

/** Last calendar day of the month containing `date`. */
export function monthEnd(date: Date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
}

export function previousMonthRange(date: Date = new Date()): { start: string; end: string } {
  const prevMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1))
  return { start: monthStart(prevMonth), end: monthEnd(prevMonth) }
}