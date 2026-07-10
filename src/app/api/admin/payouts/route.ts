/**
 * Admin-only. Lets you log a manual payout (linked to the specific sale it
 * pays out) and see payout history + any refund clawbacks for a creator.
 * Kurso doesn't store bank/UPI details, so this does NOT tell you where to
 * send money — confirm that with the creator directly before logging.
 */

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

    const creatorId = req.nextUrl.searchParams.get('creatorId')
    if (!creatorId) return NextResponse.json({ error: 'Missing creatorId' }, { status: 400 })

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, name, payout_account_status')
      .eq('id', creatorId)
      .maybeSingle()

    if (creatorError) throw creatorError
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    // Sales not yet paid out — "log a payout" defaults against these
    const { data: unpaidSales, error: unpaidError } = await supabase
      .from('payments')
      .select('id, net_amount, paid_at, course_id, courses(name)')
      .eq('creator_id', creatorId)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(100)

    if (unpaidError) throw unpaidError

    const { data: existingPayouts } = await supabase
      .from('payouts')
      .select('payment_id')
      .eq('creator_id', creatorId)
      .not('payment_id', 'is', null)

    const paidPaymentIds = new Set((existingPayouts || []).map((p: any) => p.payment_id))
    const unpaid = (unpaidSales || []).filter((p: any) => !paidPaymentIds.has(p.id))

    const { data: history, error: historyError } = await supabase
      .from('payouts')
      .select('id, amount, payout_date, status, method, reference_note, recorded_by, payment_id')
      .eq('creator_id', creatorId)
      .order('payout_date', { ascending: false })
      .limit(50)

    if (historyError) throw historyError

    // Outstanding clawbacks — refunds on sales already paid out, not yet resolved
    const { data: clawbacks, error: clawbackError } = await supabase
      .from('refunds')
      .select('id, clawback_amount, created_at, payment_id, payments!inner(creator_id)')
      .eq('clawback_owed', true)
      .eq('clawback_resolved', false)
      .eq('payments.creator_id', creatorId)

    if (clawbackError) throw clawbackError

    return NextResponse.json({
      creator: { id: creator.id, name: creator.name, status: creator.payout_account_status || 'not_connected' },
      unpaidSales: unpaid,
      history: history || [],
      outstandingClawbacks: clawbacks || [],
    })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/payouts GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { creatorId, amount, method, referenceNote, payoutDate, paymentId } = body as {
      creatorId?: string
      amount?: number
      method?: string
      referenceNote?: string
      payoutDate?: string
      paymentId?: string | null
    }

    if (!creatorId) return NextResponse.json({ error: 'Missing creatorId' }, { status: 400 })
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Enter a payout amount greater than zero.' }, { status: 400 })
    }
    if (!method || !['manual_bank_transfer', 'manual_upi'].includes(method)) {
      return NextResponse.json({ error: 'Select a valid payout method.' }, { status: 400 })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('payouts')
      .insert({
        creator_id: creatorId,
        payment_id: paymentId || null,
        amount: Number(amount),
        platform_fee: 0,
        net_amount: Number(amount),
        payout_date: payoutDate || new Date().toISOString(),
        status: 'paid',
        method,
        reference_note: referenceNote?.trim() || null,
        recorded_by: 'admin',
      })
      .select('id')
      .single()

    if (insertError) throw insertError
    return NextResponse.json({ ok: true, payoutId: inserted?.id })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'admin/payouts POST')
  }
}