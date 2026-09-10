import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: agreements, error: agErr }, { data: invoices, error: invErr }] = await Promise.all([
      supabase
        .from('revenue_share_agreements')
        .select('id, creator_id, base_rate_percent, overflow_rate_percent, overflow_threshold_students, status, started_at, creators(name, email)')
        .order('started_at', { ascending: false }),
      supabase
        .from('revenue_share_invoices')
                .select('id, creator_id, product_type, period_start, period_end, gross_revenue, total_amount_due, status, paid_at, overdue_at, creators(name, email)')
        .order('period_start', { ascending: false })
        .limit(300),
    ])
    if (agErr) throw agErr
    if (invErr) throw invErr

    return NextResponse.json({ agreements: agreements || [], invoices: invoices || [] })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/revenue-share GET')
  }
}