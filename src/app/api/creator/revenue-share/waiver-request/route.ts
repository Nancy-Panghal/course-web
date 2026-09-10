import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const creatorId = userData.user.id

    const { invoiceId, reason } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })

    const { data: invoice, error: invErr } = await supabase
      .from('revenue_share_invoices')
      .select('id, creator_id, status')
      .eq('id', invoiceId)
      .maybeSingle()
    if (invErr) throw invErr
    if (!invoice || invoice.creator_id !== creatorId) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'This invoice is already paid — nothing to waive.' }, { status: 400 })
    }
    if (invoice.status === 'waived') {
      return NextResponse.json({ error: 'This invoice was already waived.' }, { status: 400 })
    }

    const { data: existingPending } = await supabase
      .from('revenue_share_waiver_requests')
      .select('id')
      .eq('invoice_id', invoiceId)
      .eq('status', 'pending')
      .maybeSingle()
    if (existingPending) {
      return NextResponse.json({ error: 'You already have a pending request for this invoice.' }, { status: 400 })
    }

    const { error: insertErr } = await supabase.from('revenue_share_waiver_requests').insert({
      creator_id: creatorId,
      invoice_id: invoiceId,
      reason: reason || null,
      status: 'pending',
    })
    if (insertErr) throw insertErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/revenue-share/waiver-request POST')
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('revenue_share_waiver_requests')
      .select('id, invoice_id, reason, status, requested_at, reviewed_at, admin_note')
      .eq('creator_id', userData.user.id)
      .order('requested_at', { ascending: false })
      .limit(12)
    if (error) throw error
    return NextResponse.json({ requests: data || [] })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'creator/revenue-share/waiver-request GET')
  }
}