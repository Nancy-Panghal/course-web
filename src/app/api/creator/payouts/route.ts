/**
 * src/app/api/creator/payouts/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET — returns payout history for the authenticated creator.
 *       Only returns records owned by the authenticated creator.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      .from('payouts')
      .select('id, amount, platform_fee, net_amount, payout_date, status, razorpay_payout_id, notes')
      .eq('creator_id', user.id)
      .order('payout_date', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ payouts: data || [] })
  } catch (err: any) {
    console.error('[payouts GET]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
