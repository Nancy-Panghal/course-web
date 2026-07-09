import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOnboardingUrl, isRouteLive } from '@/lib/payout-onboarding'
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

export async function POST(req: NextRequest) {
  try {
    const user = await getCreator(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!isRouteLive()) {
      return NextResponse.json({
        available: false,
        message: 'Payout setup via Razorpay is opening soon — check back shortly.',
      })
    }

    const url = await getOnboardingUrl(user.id)
    if (!url) {
      return NextResponse.json({
        available: false,
        message: 'Payout setup is being configured — check back shortly.',
      })
    }

    await supabase.from('creators').update({ payout_account_status: 'pending' }).eq('id', user.id)
    return NextResponse.json({ available: true, url })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'payout-connect POST')
  }
}