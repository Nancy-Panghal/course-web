// src/app/w/[creatorSlug]/[workshopSlug]/page.tsx
//
// Public workshop registration page (server component). zoom_link is
// intentionally NEVER selected here — it only goes to a CONFIRMED registrant
// via WhatsApp/Telegram.

import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import WorkshopRegisterForm from '@/components/WorkshopRegisterForm'
import { getCreatorCheckoutGateway } from '@/lib/gateway-checkout'
import { countHeldSpots } from '@/lib/workshops'
import MetaPixel from '@/components/MetaPixel'

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
    .select('id, name, upi_id, upi_display_name, telegram_bot_username')
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
    const held = await countHeldSpots(supabase, workshop.id)
    spotsLeft = Math.max(0, workshop.capacity - held)
  }

  // Only matters for paid workshops. A misconfigured/undecryptable gateway
  // must not take the whole page down — it just disables the online option.
  let gatewayEnabled = false
  if (workshop.price > 0) {
    try {
      gatewayEnabled = !!(await getCreatorCheckoutGateway(creator.id))
    } catch (err) {
      console.error('[workshop page] gateway lookup failed for creator', creator.id, err)
    }
  }

  // Creator's Meta Pixel (optional). A settings problem must never take the page down.
  let metaPixelId: string | null = null
  try {
    const { data: metaSettings } = await supabase
      .from('creator_meta_settings')
      .select('pixel_id')
      .eq('creator_id', creator.id)
      .maybeSingle()
    metaPixelId = metaSettings?.pixel_id ?? null
  } catch (err) {
    console.error('[workshop page] meta pixel lookup failed for creator', creator.id, err)
  }

  const dateLabel = new Date(workshop.date_time).toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  })

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {metaPixelId && <MetaPixel pixelId={metaPixelId} />}
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
            workshopTitle={workshop.title}
            price={workshop.price}
            isFull={spotsLeft === 0}
            upiId={creator.upi_id}
            upiDisplayName={creator.upi_display_name || creator.name}
            gatewayEnabled={gatewayEnabled}
            telegramBotUsername={creator.telegram_bot_username || null}
          />
        </div>
      </div>
    </div>
  )
}