import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { decideSubscriptionRefundRequest } from '@/lib/refund-actions'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('refund_requests')
      .select('id, subscription_id, reason, status, requested_at, decision_note, creators(name, email)')
      .eq('type', 'subscription')
      .order('requested_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ requests: data || [] })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/subscription-refund-requests GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { requestId, decision, note } = await req.json()
    if (!requestId || !['approved', 'denied'].includes(decision)) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }
    const result = await decideSubscriptionRefundRequest({ requestId, decision, note })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, message: result.message })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/subscription-refund-requests POST')
  }
}