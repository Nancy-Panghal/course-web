// src/app/api/workshops/referrals/route.ts
// GET (creator auth) — referral stats across all of this creator's workshops:
//   counts:     { [workshopId]: number of CONFIRMED registrations that came via a student's link }
//   referredBy: { [registrationId]: name of the student who referred them } (any payment status)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { creator, error } = await getAuthenticatedCreator(req)
    if (error || !creator) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })

    const { data: workshops, error: workshopsError } = await supabaseAdmin
      .from('workshops')
      .select('id')
      .eq('creator_id', creator.id)
    if (workshopsError) throw workshopsError

    const workshopIds = (workshops || []).map(w => w.id)
    const counts: Record<string, number> = {}
    const referredBy: Record<string, string> = {}
    if (workshopIds.length === 0) return NextResponse.json({ counts, referredBy })

    const { data: referred, error: referredError } = await supabaseAdmin
      .from('workshop_registrations')
      .select('id, workshop_id, payment_status, referred_by_code_id')
      .in('workshop_id', workshopIds)
      .not('referred_by_code_id', 'is', null)
    if (referredError) throw referredError
    if (!referred || referred.length === 0) return NextResponse.json({ counts, referredBy })

    const codeIds = [...new Set(referred.map(r => r.referred_by_code_id as string))]
    const { data: codes, error: codesError } = await supabaseAdmin
      .from('workshop_referral_codes')
      .select('id, registration_id')
      .in('id', codeIds)
    if (codesError) throw codesError

    const ownerRegIds = [...new Set((codes || []).map(c => c.registration_id))]
    const { data: owners, error: ownersError } = await supabaseAdmin
      .from('workshop_registrations')
      .select('id, name')
      .in('id', ownerRegIds)
    if (ownersError) throw ownersError

    const ownerNameByRegId = new Map((owners || []).map(o => [o.id, o.name as string]))
    const ownerNameByCodeId = new Map(
      (codes || []).map(c => [c.id, ownerNameByRegId.get(c.registration_id) || 'a student'])
    )

    for (const r of referred) {
      referredBy[r.id] = ownerNameByCodeId.get(r.referred_by_code_id as string) || 'a student'
      if (r.payment_status === 'confirmed') counts[r.workshop_id] = (counts[r.workshop_id] || 0) + 1
    }

    return NextResponse.json({ counts, referredBy })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'workshops/referrals GET')
  }
}