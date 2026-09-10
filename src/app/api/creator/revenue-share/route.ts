import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'
import {
  REVENUE_SHARE_BASE_RATE_PERCENT,
  REVENUE_SHARE_OVERFLOW_RATE_PERCENT,
  REVENUE_SHARE_STUDENT_THRESHOLD,
} from '@/lib/revenueShare'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCreatorId(req: NextRequest): Promise<string | null> {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

/** Opt a creator into Pay-As-You-Earn. Safe to call again — reactivates a cancelled agreement instead of duplicating it. */
export async function POST(req: NextRequest) {
  try {
    const creatorId = await getCreatorId(req)
    if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: existing } = await supabase
      .from('revenue_share_agreements')
      .select('id, status')
      .eq('creator_id', creatorId)
      .maybeSingle()

    if (existing?.status === 'active') {
      return NextResponse.json({ success: true, alreadyActive: true })
    }

    if (existing) {
      const { error } = await supabase
        .from('revenue_share_agreements')
        .update({ status: 'active', cancelled_at: null, started_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('revenue_share_agreements').insert({
        creator_id: creatorId,
        base_rate_percent: REVENUE_SHARE_BASE_RATE_PERCENT,
        overflow_rate_percent: REVENUE_SHARE_OVERFLOW_RATE_PERCENT,
        overflow_threshold_students: REVENUE_SHARE_STUDENT_THRESHOLD,
        status: 'active',
      })
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/revenue-share POST')
  }
}

export async function GET(req: NextRequest) {
  try {
    const creatorId = await getCreatorId(req)
    if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: agreement }, { data: invoices }] = await Promise.all([
      supabase
        .from('revenue_share_agreements')
        .select('id, base_rate_percent, overflow_rate_percent, overflow_threshold_students, status, started_at')
        .eq('creator_id', creatorId)
        .maybeSingle(),
      supabase
        .from('revenue_share_invoices')
        .select('id, period_start, period_end, gross_revenue, total_amount_due, status, paid_at, overdue_at')
        .eq('creator_id', creatorId)
        .order('period_start', { ascending: false })
        .limit(24),
    ])

    return NextResponse.json({ agreement: agreement || null, invoices: invoices || [] })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/revenue-share GET')
  }
}