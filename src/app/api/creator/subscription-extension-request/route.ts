import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_DAYS = [3, 7, 15, 30] // 3 days, 1 week, 15 days, 1 month

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const creatorId = userData.user.id

    const { requestedDays, reason } = await req.json()
    if (!ALLOWED_DAYS.includes(requestedDays)) {
      return NextResponse.json({ error: 'Invalid extension length' }, { status: 400 })
    }

    // Server-side re-check: only within 2 days of (or already past) expiry —
    // never trust the client's "am I close to expiry" judgment.
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .select('id, status, current_period_end')
      .eq('creator_id', creatorId)
      .maybeSingle()
    if (subErr) throw subErr
    if (!sub || !sub.current_period_end) {
      return NextResponse.json({ error: 'No active subscription found.' }, { status: 400 })
    }
    const daysLeft = (new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysLeft > 2) {
      return NextResponse.json({ error: 'Extension requests open up 2 days before your plan expires.' }, { status: 400 })
    }

    // One pending request at a time; no cap on total requests over the account's lifetime.
    const { data: existingPending, error: pendingErr } = await supabase
      .from('subscription_extension_requests')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('status', 'pending')
      .maybeSingle()
    if (pendingErr) throw pendingErr
    if (existingPending) {
      return NextResponse.json({ error: 'You already have a pending extension request.' }, { status: 400 })
    }

    const { error: insertErr } = await supabase.from('subscription_extension_requests').insert({
      creator_id: creatorId,
      subscription_id: sub.id,
      requested_days: requestedDays,
      reason: reason || null,
      status: 'pending',
    })
    if (insertErr) throw insertErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/subscription-extension-request POST')
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('subscription_extension_requests')
      .select('id, requested_days, status, requested_at, reviewed_at, admin_note')
      .eq('creator_id', userData.user.id)
      .order('requested_at', { ascending: false })
      .limit(5)
    if (error) throw error
    return NextResponse.json({ requests: data || [] })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/subscription-extension-request GET')
  }
}
