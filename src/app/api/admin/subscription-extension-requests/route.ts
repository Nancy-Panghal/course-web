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

    const { data, error } = await supabase
      .from('subscription_extension_requests')
      .select('id, creator_id, subscription_id, requested_days, status, reason, requested_at, reviewed_at, admin_note, creators(name, email)')
      .order('requested_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ requests: data || [] })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/subscription-extension-requests GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { requestId, decision, note } = await req.json()
    if (!requestId || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: reqRow, error: reqErr } = await supabase
      .from('subscription_extension_requests')
      .select('id, subscription_id, requested_days, status')
      .eq('id', requestId)
      .maybeSingle()
    if (reqErr) throw reqErr
    if (!reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: `Already ${reqRow.status}` }, { status: 400 })
    }

    if (decision === 'approved') {
      if (!reqRow.subscription_id) {
        return NextResponse.json({ error: 'No subscription linked to this request' }, { status: 400 })
      }
      const { data: sub, error: subErr } = await supabase
        .from('subscriptions')
        .select('id, current_period_end')
        .eq('id', reqRow.subscription_id)
        .maybeSingle()
      if (subErr) throw subErr
      if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

      // Extend from whichever is later — the current period_end (if it
      // hasn't lapsed yet) or right now (if it already has) — so a creator
      // who requested just before expiry doesn't lose the in-between days,
      // and one who's already lapsed gets a clean N-day extension from today.
      const base = new Date(sub.current_period_end) > new Date() ? new Date(sub.current_period_end) : new Date()
      const newPeriodEnd = new Date(base.getTime() + reqRow.requested_days * 24 * 60 * 60 * 1000)

      const { error: updateErr } = await supabase
        .from('subscriptions')
        .update({
          current_period_end: newPeriodEnd.toISOString(),
          status: 'active',
          // Clear reminder flags so the extended period gets its own fresh
          // 7-day/1-day reminders instead of staying silent because the old
          // period already "used up" its reminder for that calendar day.
          reminder_7d_sent_at: null,
          reminder_1d_sent_at: null,
        })
        .eq('id', reqRow.subscription_id)
      if (updateErr) throw updateErr
    }

    const { error: decideErr } = await supabase
      .from('subscription_extension_requests')
      .update({
        status: decision,
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.email,
        admin_note: note || null,
      })
      .eq('id', requestId)
    if (decideErr) throw decideErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/subscription-extension-requests POST')
  }
}
