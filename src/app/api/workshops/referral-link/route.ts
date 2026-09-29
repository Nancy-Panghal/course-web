// src/app/api/workshops/referral-link/route.ts
// GET — returns the referral link for a CONFIRMED registration, minting the
// code on first call. Used by the workshop page's success screen.
//
// Public on purpose: the caller must already hold the registration's UUID (or
// the payment order id from the gateway redirect), and all this reveals is a
// share link that is meant to be public anyway. Unconfirmed registrations
// get { link: null }.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOrCreateReferralLink } from '@/lib/referrals'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    let registrationId = params.get('registrationId')
    const orderId = params.get('orderId')

    if (registrationId && !UUID_RE.test(registrationId)) registrationId = null

    // Gateway redirect-back only knows the transaction id.
    if (!registrationId && orderId && UUID_RE.test(orderId)) {
      const { data } = await supabaseAdmin
        .from('workshop_registrations')
        .select('id')
        .eq('transaction_id', orderId)
        .maybeSingle()
      registrationId = data?.id ?? null
    }

    if (!registrationId) {
      return NextResponse.json({ link: null }, { headers: NO_STORE })
    }

    const result = await getOrCreateReferralLink(supabaseAdmin, registrationId)
    return NextResponse.json(
      { link: result?.link ?? null, code: result?.code ?? null },
      { headers: NO_STORE }
    )
  } catch (err) {
    // The share link is a bonus — never surface an error to a student who just registered.
    console.error('[workshops/referral-link GET]', err)
    return NextResponse.json({ link: null }, { headers: NO_STORE })
  }
}