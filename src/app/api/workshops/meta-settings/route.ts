// src/app/api/workshops/meta-settings/route.ts
// Creator-authenticated. The CAPI access token is encrypted at rest and is
// NEVER returned to the browser — GET only says whether one is saved.
//   GET    → pixel id, hasToken, test code, last-30-days event stats
//   PUT    → save pixel id / token / test code (token optional = keep existing)
//   DELETE → remove the whole Meta setup
//   POST   → { action: 'retry' } re-send failed events
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { friendlyErrorResponse } from '@/lib/payment-errors'
import { isImpersonationActive, IMPERSONATION_BLOCK_MESSAGE } from '@/lib/impersonation-guard'
import { encryptSecret, decryptSecret } from '@/lib/creator-secrets'
import { isValidPixelId, verifyPixelAccess } from '@/lib/meta-capi'
import { getMetaEventStats, retryFailedMetaEvents } from '@/lib/workshop-meta-events'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function authorise(req: NextRequest, { write }: { write: boolean }) {
  const { creator, error } = await getAuthenticatedCreator(req)
  if (error || !creator) return { creator: null, response: NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 }) }
  if (write && (await isImpersonationActive(creator.id))) {
    return { creator: null, response: NextResponse.json({ error: IMPERSONATION_BLOCK_MESSAGE }, { status: 403 }) }
  }
  return { creator, response: null }
}

export async function GET(req: NextRequest) {
  try {
    const { creator, response } = await authorise(req, { write: false })
    if (!creator) return response!

    const { data } = await supabaseAdmin
      .from('creator_meta_settings')
      .select('pixel_id, capi_access_token_enc, test_event_code')
      .eq('creator_id', creator.id)
      .maybeSingle()

    const stats = data ? await getMetaEventStats(creator.id) : null
    return NextResponse.json({
      pixelId: data?.pixel_id ?? '',
      hasToken: !!data?.capi_access_token_enc,
      testEventCode: data?.test_event_code ?? '',
      stats,
    })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'workshops/meta-settings GET')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { creator, response } = await authorise(req, { write: true })
    if (!creator) return response!

    const body = await req.json()
    const pixelId = String(body.pixelId ?? '').trim()
    const newToken = String(body.accessToken ?? '').trim()
    const testEventCode = String(body.testEventCode ?? '').trim()

    if (!isValidPixelId(pixelId)) {
      return NextResponse.json({ error: 'Pixel ID should be 8–20 digits (find it in Meta Events Manager).' }, { status: 400 })
    }
    if (newToken && !/^\S{20,1000}$/.test(newToken)) {
      return NextResponse.json({ error: 'That access token doesn\'t look right. Paste the whole token, with no spaces.' }, { status: 400 })
    }
    if (testEventCode && !/^[A-Za-z0-9_-]{3,40}$/.test(testEventCode)) {
      return NextResponse.json({ error: 'Test event code looks like TEST12345 — copy it from the Test Events tab.' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('creator_meta_settings')
      .select('pixel_id, capi_access_token_enc')
      .eq('creator_id', creator.id)
      .maybeSingle()

    let tokenEnc: string | null
    let tokenPlain: string | null
    if (newToken) {
      tokenPlain = newToken
      tokenEnc = encryptSecret(newToken)
    } else if (existing?.capi_access_token_enc && existing.pixel_id === pixelId) {
      tokenEnc = existing.capi_access_token_enc
      try { tokenPlain = decryptSecret(existing.capi_access_token_enc) } catch { tokenPlain = null }
    } else if (existing?.capi_access_token_enc) {
      // A token belongs to ONE pixel — never silently pair the old token with a new pixel.
      return NextResponse.json({ error: 'You changed the Pixel ID, so please paste the access token for the new pixel too.' }, { status: 400 })
    } else {
      tokenEnc = null
      tokenPlain = null
    }

    const { error: upsertError } = await supabaseAdmin
      .from('creator_meta_settings')
      .upsert({
        creator_id: creator.id,
        pixel_id: pixelId,
        capi_access_token_enc: tokenEnc,
        test_event_code: testEventCode || null,
        updated_at: new Date().toISOString(),
      })
    if (upsertError) throw upsertError

    // Verification is advisory: it reads the pixel with the token so we can warn
    // early, but a permissions quirk must never lock a creator out of saving.
    let verification: { ok: boolean; name?: string | null; error?: string } | null = null
    if (tokenPlain) {
      const v = await verifyPixelAccess({ pixelId, accessToken: tokenPlain })
      verification = v.ok ? { ok: true, name: v.name } : { ok: false, error: v.error }
    }

    return NextResponse.json({ ok: true, hasToken: !!tokenEnc, verification })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'workshops/meta-settings PUT')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { creator, response } = await authorise(req, { write: true })
    if (!creator) return response!
    const { error } = await supabaseAdmin.from('creator_meta_settings').delete().eq('creator_id', creator.id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'workshops/meta-settings DELETE')
  }
}

export async function POST(req: NextRequest) {
  try {
    const { creator, response } = await authorise(req, { write: true })
    if (!creator) return response!
    const body = await req.json().catch(() => ({}))
    if (body?.action !== 'retry') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    const result = await retryFailedMetaEvents(creator.id)
    const stats = await getMetaEventStats(creator.id)
    return NextResponse.json({ ok: true, ...result, stats })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'workshops/meta-settings POST')
  }
}