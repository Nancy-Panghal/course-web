// src/app/api/workshops/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone'
import { friendlyErrorResponse } from '@/lib/payment-errors'

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
    console.warn(`[workshops/register] bot URL/secret not configured, skipping confirmation send to ${phone}`)
    return
  }
  const dateTimeLabel = new Date(workshop.date_time).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })
  try {
    const res = await fetch(`${baseUrl}/internal/send-workshop-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        phone,
        workshopTitle: workshop.title,
        dateTimeLabel,
        zoomLink: workshop.zoom_link || 'Link will follow shortly',
      }),
    })
    if (!res.ok) {
      console.error('[workshops/register] bot rejected confirmation send:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[workshops/register] failed to reach whatsapp bot:', err)
  }
}

// POST — create (or find) a registration for a workshop.
export async function POST(req: NextRequest) {
  try {
    const { workshopId, name, email, phone: rawPhone, paymentMode } = await req.json()

    if (!workshopId || !name || !rawPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!['free', 'upi_manual'].includes(paymentMode)) {
      return NextResponse.json({ error: 'Unsupported payment mode' }, { status: 400 })
    }

    const phone = normalizePhone(rawPhone)
    if (!phone) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const { data: workshop, error: workshopError } = await supabaseAdmin
      .from('workshops')
      .select('id, title, date_time, price, capacity, zoom_link, status')
      .eq('id', workshopId)
      .maybeSingle()

    if (workshopError) throw workshopError
    if (!workshop || workshop.status !== 'published') {
      return NextResponse.json({ error: 'This workshop is not open for registration' }, { status: 404 })
    }
    if (paymentMode === 'free' && workshop.price > 0) {
      return NextResponse.json({ error: 'This workshop is not free' }, { status: 400 })
    }
    if (paymentMode === 'upi_manual' && workshop.price <= 0) {
      return NextResponse.json({ error: 'This workshop does not require payment' }, { status: 400 })
    }

    // Already registered? Don't re-insert or reset an already-confirmed row.
    const { data: existing } = await supabaseAdmin
      .from('workshop_registrations')
      .select('id, payment_status')
      .eq('workshop_id', workshopId)
      .eq('phone', phone)
      .maybeSingle()

    if (existing?.payment_status === 'confirmed') {
      return NextResponse.json({ registrationId: existing.id, paymentStatus: 'confirmed', alreadyRegistered: true })
    }

    if (!existing && workshop.capacity != null) {
      // Capacity check only on a brand-new row — an existing pending/confirmed
      // registration already holds its spot regardless of later capacity edits.
      const { count } = await supabaseAdmin
        .from('workshop_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('workshop_id', workshopId)
        .in('payment_status', ['confirmed', 'pending_confirmation'])
      if ((count || 0) >= workshop.capacity) {
        return NextResponse.json({ error: 'This workshop is fully booked' }, { status: 409 })
      }
    }

    const paymentStatus = paymentMode === 'free' ? 'confirmed' : 'pending_confirmation'
    let registrationId: string

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('workshop_registrations')
        .update({ name, email: email || null, payment_mode: paymentMode, payment_status: paymentStatus })
        .eq('id', existing.id)
      if (updateError) throw updateError
      registrationId = existing.id
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('workshop_registrations')
        .insert({ workshop_id: workshopId, name, email: email || null, phone, payment_mode: paymentMode, payment_status: paymentStatus })
        .select('id')
        .single()
      if (insertError) throw insertError
      registrationId = inserted.id
    }

    if (paymentStatus === 'confirmed') {
      await sendWorkshopConfirmation(phone, workshop)
      await supabaseAdmin.from('workshop_registrations').update({ confirmed_at: new Date().toISOString() }).eq('id', registrationId)
    }

    return NextResponse.json({ registrationId, paymentStatus })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'workshops/register POST')
  }
}

// PATCH — student submits their UPI UTR after paying manually.
export async function PATCH(req: NextRequest) {
  try {
    const { registrationId, utrReference } = await req.json()
    if (!registrationId || !utrReference) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: registration, error: fetchError } = await supabaseAdmin
      .from('workshop_registrations')
      .select('id, payment_status')
      .eq('id', registrationId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }
    if (registration.payment_status === 'confirmed') {
      return NextResponse.json({ ok: true, paymentStatus: 'confirmed' })
    }

    const { error: updateError } = await supabaseAdmin
      .from('workshop_registrations')
      .update({ utr_reference: String(utrReference).trim() })
      .eq('id', registrationId)
    if (updateError) throw updateError

    return NextResponse.json({ ok: true, paymentStatus: 'pending_confirmation' })
  } catch (err: any) {
    return friendlyErrorResponse(err, 'workshops/register PATCH')
  }
}