// src/app/api/workshops/registrations/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { friendlyErrorResponse } from '@/lib/payment-errors'
import { isImpersonationActive, IMPERSONATION_BLOCK_MESSAGE } from '@/lib/impersonation-guard'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendWorkshopConfirmation(
  phone: string,
  workshop: { title: string; date_time: string; zoom_link: string | null }
) {
  const baseUrl = process.env.WHATSAPP_BOT_URL
  const secret = process.env.INTERNAL_BOT_SECRET
  if (!baseUrl || !secret) {
    console.warn(`[workshops/confirm] bot URL/secret not configured, skipping send to ${phone}`)
    return
  }
  const dateTimeLabel = new Date(workshop.date_time).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
  try {
    const res = await fetch(`${baseUrl}/internal/send-workshop-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ phone, workshopTitle: workshop.title, dateTimeLabel, zoomLink: workshop.zoom_link || 'Link will follow shortly' }),
    })
    if (!res.ok) console.error('[workshops/confirm] bot rejected send:', res.status, await res.text().catch(() => ''))
  } catch (err) {
    console.error('[workshops/confirm] failed to reach whatsapp bot:', err)
  }
}

// POST — creator manually marks a pending UPI registration as paid.
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

    // Ownership check goes through the workshop — registrations don't
    // carry creator_id themselves.
    const { data: registration, error: fetchError } = await supabaseAdmin
      .from('workshop_registrations')
      .select('id, phone, payment_status, workshops!inner(id, creator_id, title, date_time, zoom_link)')
      .eq('id', registrationId)
      .maybeSingle()
    if (fetchError) throw fetchError

    const workshop = (registration as any)?.workshops
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

    await sendWorkshopConfirmation(registration.phone, workshop)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'workshops/registrations/confirm POST')
  }
}