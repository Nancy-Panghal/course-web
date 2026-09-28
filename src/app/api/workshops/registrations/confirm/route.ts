// src/app/api/workshops/registrations/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { friendlyErrorResponse } from '@/lib/payment-errors'
import { isImpersonationActive, IMPERSONATION_BLOCK_MESSAGE } from '@/lib/impersonation-guard'
import { notifyWorkshopConfirmed } from '@/lib/workshop-notify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — creator manually marks a pending registration as paid.
export async function POST(req: NextRequest) {
  try {
    const { creator, error } = await getAuthenticatedCreator(req)
    if (error || !creator) return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })
    if (await isImpersonationActive(creator.id)) {
      return NextResponse.json({ error: IMPERSONATION_BLOCK_MESSAGE }, { status: 403 })
    }

    const { registrationId } = await req.json()
    if (!registrationId) {
      return NextResponse.json({ error: 'Missing registration ID' }, { status: 400 })
    }

    // Ownership goes through the workshop — registrations don't carry creator_id.
    const { data: registration, error: fetchError } = await supabaseAdmin
      .from('workshop_registrations')
      .select('id, payment_status, workshops!inner(creator_id)')
      .eq('id', registrationId)
      .maybeSingle()
    if (fetchError) throw fetchError

    const rawWorkshop = (registration as any)?.workshops
    const workshop = Array.isArray(rawWorkshop) ? rawWorkshop[0] : rawWorkshop
    if (!registration || !workshop || workshop.creator_id !== creator.id) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }
    if (registration.payment_status === 'confirmed') {
      return NextResponse.json({ ok: true, alreadyConfirmed: true })
    }

    const { error: updateError } = await supabaseAdmin
      .from('workshop_registrations')
      .update({ payment_status: 'confirmed', confirmed_by: creator.id, confirmed_at: new Date().toISOString() })
      .eq('id', registrationId)
    if (updateError) throw updateError

    await notifyWorkshopConfirmed(registrationId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'workshops/registrations/confirm POST')
  }
}