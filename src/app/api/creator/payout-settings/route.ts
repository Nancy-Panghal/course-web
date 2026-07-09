/**
 * src/app/api/creator/payout-settings/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET — returns the creator's payout CONNECTION STATUS only.
 *
 * Kurso does not collect or store raw bank account numbers, UPI IDs,
 * or PAN details. That KYC is handled entirely by Razorpay via Route —
 * we only ever get back a status and an opaque account reference.
 * See /api/creator/payout-connect for starting that flow.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCreator(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCreator(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('creators')
      .select('payout_account_status, payout_provider_account_id')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      status: data?.payout_account_status || 'not_connected',
      connected: !!data?.payout_provider_account_id,
    })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'payout-settings GET')
  }
}