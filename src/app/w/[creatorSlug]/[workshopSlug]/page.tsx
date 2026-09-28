// src/app/w/[creatorSlug]/[workshopSlug]/page.tsx
//
// Public workshop registration page. Mirrors src/app/creator/[slug]/page.tsx:
// server component, direct service-role Supabase read, notFound() when
// missing. Unlike course enrollment, this needs no Supabase Auth signup —
// WorkshopRegisterForm captures name/email/WhatsApp directly.
//
// zoom_link is intentionally NEVER selected here — it's only ever sent to a
// CONFIRMED registrant via WhatsApp (see /api/workshops/register and
// /api/workshops/registrations/confirm), never exposed on this public page.

import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import WorkshopRegisterForm from '@/components/WorkshopRegisterForm'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ creatorSlug: string; workshopSlug: string }>
}): Promise<Metadata> {
  const { creatorSlug, workshopSlug } = await params

  const { data: creator } = await supabase
    .from('creators')
    .select('id, name')
    .eq('creator_slug', creatorSlug)
    .maybeSingle()

  if (!creator) return { title: 'Workshop not found' }

  const { data: workshop } = await supabase
    .from('workshops')
    .select('title, description')
    .eq('creator_id', creator.id)
    .eq('slug', workshopSlug)
    .eq('status', 'published')
    .maybeSingle()

  if (!workshop) return { title: 'Workshop not found' }

  return {
    title: `${workshop.title} — ${creator.name} | Kurso`,
    description: workshop.description?.slice(0, 155) || `Join ${workshop.title} by ${creator.name}.`,
  }
}

export default async function WorkshopRegisterPage({
  params,
}: {
  params: Promise<{ creatorSlug: string; workshopSlug: string }>
}) {
  const { creatorSlug, workshopSlug } = await params

  const { data: creator } = await supabase
    .from('creators')
    .select('id, name, upi_id, upi_display_name')
    .eq('creator_slug', creatorSlug)
    .maybeSingle()

  if (!creator) notFound()

  const { data: workshop } = await supabase
    .from('workshops')
    .select('id, title, description, date_time, price, capacity')
    .eq('creator_id', creator.id)
    .eq('slug', workshopSlug)
    .eq('status', 'published')
    .maybeSingle()

  if (!workshop) notFound()

  let spotsLeft: number | null = null
  if (workshop.capacity != null) {
    const { count } = await supabase
      .from('workshop_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('workshop_id', workshop.id)
      .in('payment_status', ['confirmed', 'pending_confirmation'])
    spotsLeft = Math.max(0, workshop.capacity - (count || 0))
  }

  const dateLabel = new Date(workshop.date_time).toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl p-6 md:p-8 glass" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--kurso-primary-light)' }}>
            Live Workshop by {creator.name}
          </p>
          <h1 className="text-2xl font-bold text-white mb-2">{workshop.title}</h1>
          <p className="text-sm mb-1" style={{ color: '#a1a1aa' }}>{dateLabel} IST</p>
          {workshop.description && (
            <p className="text-sm mb-4 mt-3" style={{ color: '#d4d4d8' }}>{workshop.description}</p>
          )}

          <div className="flex items-center justify-between mb-6 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-lg font-bold text-white">
              {workshop.price > 0 ? `₹${workshop.price.toLocaleString()}` : 'Free'}
            </span>
            {spotsLeft != null && (
              <span className="text-xs" style={{ color: spotsLeft === 0 ? '#ef4444' : '#52525b' }}>
                {spotsLeft === 0 ? 'Fully booked' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
              </span>
            )}
          </div>

          <WorkshopRegisterForm
            workshopId={workshop.id}
            price={workshop.price}
            isFull={spotsLeft === 0}
            upiId={creator.upi_id}
            upiDisplayName={creator.upi_display_name || creator.name}
          />
        </div>
      </div>
    </div>
  )
}