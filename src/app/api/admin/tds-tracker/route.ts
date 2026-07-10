import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TDS_THRESHOLD = 500000 // Section 194-O, ₹5,00,000/financial year
const TDS_WARNING_ZONE = 400000 // start flagging once a creator crosses this

function getCurrentFinancialYearStart(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0 = Jan, 3 = April
  const fyStartYear = month >= 3 ? year : year - 1
  return new Date(Date.UTC(fyStartYear, 3, 1)).toISOString()
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const fyStart = getCurrentFinancialYearStart()

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('creator_id, net_amount, status, paid_at')
      .eq('status', 'paid')
      .gte('paid_at', fyStart)

    if (paymentsError) throw paymentsError

    const totals = new Map<string, number>()
    for (const p of payments || []) {
      if (!p.creator_id) continue
      totals.set(p.creator_id, (totals.get(p.creator_id) || 0) + Number(p.net_amount || 0))
    }

    const creatorIds = Array.from(totals.keys())
    let names = new Map<string, string>()
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase.from('creators').select('id, name').in('id', creatorIds)
      names = new Map((creators || []).map((c: any) => [c.id, c.name]))
    }

    const rows = creatorIds
      .map((id) => {
        const total = totals.get(id) || 0
        return {
          creatorId: id,
          name: names.get(id) || id,
          totalSalesThisFY: total,
          status: total >= TDS_THRESHOLD ? 'over_threshold' : total >= TDS_WARNING_ZONE ? 'approaching' : 'ok',
        }
      })
      .sort((a, b) => b.totalSalesThisFY - a.totalSalesThisFY)

    return NextResponse.json({ fyStart, threshold: TDS_THRESHOLD, warningZone: TDS_WARNING_ZONE, rows })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/tds-tracker GET')
  }
}