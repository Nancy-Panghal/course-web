/**
 * Admin-only. GET returns one creator's decrypted payout destination
 * (needed to actually send the money) plus their payout history.
 * POST logs a payout — this is the audit-trail row the creator will
 * see in their own dashboard immediately, since it reads the same table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { decryptSecret } from '@/lib/payout-crypto'
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
      .select(
        'id, name, payout_account_holder, payout_bank_account_encrypted, payout_ifsc, payout_upi_id, payout_account_status'
      )
      .eq('id', creatorId)
      .maybeSingle()

    if (creatorError) throw creatorError
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    let bankAccountNumber = ''
    if (creator.payout_bank_account_encrypted) {
      try {
        bankAccountNumber = decryptSecret(creator.payout_bank_account_encrypted)
      } catch (e) {
        console.error('[admin/payouts] could not decrypt bank account for', creatorId, e)
      }
    }

    const { data: history, error: historyError } = await supabase
      .from('payouts')
      .select('id, amount, platform_fee, net_amount, payout_date, status, method, reference_note, recorded_by')
      .eq('creator_id', creatorId)
      .order('payout_date', { ascending: false })
      .limit(50)

    if (historyError) throw historyError

    return NextResponse.json({
      creator: {
        id: creator.id,
        name: creator.name,
        accountHolder: creator.payout_account_holder || '',
        bankAccountNumber, // full, decrypted — admin-only, never exposed to the creator's own view
        ifsc: creator.payout_ifsc || '',
        upiId: creator.payout_upi_id || '',
        status: creator.payout_account_status || 'not_set',
      },
      history: history || [],
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
    const { creatorId, amount, method, referenceNote, payoutDate } = body as {
      creatorId?: string
      amount?: number
      method?: string
      referenceNote?: string
      payoutDate?: string
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