import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { encryptSecret } from '@/lib/creator-secrets'
import { friendlyErrorResponse } from '@/lib/payment-errors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { creator, error } = await getAuthenticatedCreator(req)
    if (error || !creator) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('creators')
      .select('vyapar_onboarding_status, vyapar_connected_at')
      .eq('id', creator.id)
      .maybeSingle()

    return NextResponse.json({
      status: data?.vyapar_onboarding_status || 'not_connected',
      connectedAt: data?.vyapar_connected_at || null,
    })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'vyapar-connect GET')
  }
}

export async function POST(req: NextRequest) {
  try {
    const { creator, error } = await getAuthenticatedCreator(req)
    if (error || !creator) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })

    const { apiKey, webhookSecret } = await req.json()
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return NextResponse.json({ error: 'Please paste a valid Vyapar Gateway API key.' }, { status: 400 })
    }
    if (!webhookSecret || typeof webhookSecret !== 'string' || webhookSecret.trim().length < 10) {
      return NextResponse.json({ error: 'Please paste your Vyapar Gateway webhook secret.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('creators')
      .update({
        vyapar_api_key_encrypted: encryptSecret(apiKey.trim()),
        vyapar_webhook_secret_encrypted: encryptSecret(webhookSecret.trim()),
        vyapar_onboarding_status: 'connected',
        vyapar_connected_at: new Date().toISOString(),
      })
      .eq('id', creator.id)
    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'vyapar-connect POST')
  }
}