// src/lib/workshop-notify.ts
// One place that tells a registrant "you're in" — used by the free-registration
// route, the creator "Mark Paid" route, and the payment webhook.
// Sends WhatsApp always, and Telegram too if the registrant linked their chat.
import { createClient } from '@supabase/supabase-js'
import { formatWorkshopDateTime } from '@/lib/workshops'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function postToBot(
  baseUrl: string | undefined,
  path: string,
  payload: Record<string, unknown>,
  label: string
): Promise<boolean> {
  const secret = process.env.INTERNAL_BOT_SECRET
  if (!baseUrl || !secret) {
    console.warn(`[workshop-notify] ${label}: bot URL/secret not configured, skipping`)
    return false
  }
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[workshop-notify] ${label}: bot rejected send:`, res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error(`[workshop-notify] ${label}: failed to reach bot:`, err)
    return false
  }
}

export async function notifyWorkshopConfirmed(
  registrationId: string
): Promise<{ whatsapp: boolean; telegram: boolean }> {
  const { data: reg, error } = await supabaseAdmin
    .from('workshop_registrations')
    .select('id, phone, telegram_chat_id, workshops!inner(title, date_time, zoom_link)')
    .eq('id', registrationId)
    .maybeSingle()

  const rawWorkshop = (reg as any)?.workshops
  const workshop = Array.isArray(rawWorkshop) ? rawWorkshop[0] : rawWorkshop
  if (error || !reg || !workshop) {
    console.error('[workshop-notify] registration lookup failed for', registrationId, error)
    return { whatsapp: false, telegram: false }
  }

  const dateTimeLabel = formatWorkshopDateTime(workshop.date_time)

  const [whatsapp, telegram] = await Promise.all([
    postToBot(
      process.env.WHATSAPP_BOT_URL,
      '/internal/send-workshop-confirmation',
      {
        phone: reg.phone,
        workshopTitle: workshop.title,
        dateTimeLabel,
        zoomLink: workshop.zoom_link || 'Link will follow shortly',
      },
      'whatsapp'
    ),
    reg.telegram_chat_id
      ? postToBot(
          process.env.TELEGRAM_BOT_URL,
          '/internal/send-workshop-message',
          {
            chatId: reg.telegram_chat_id,
            kind: 'confirmation',
            workshopTitle: workshop.title,
            dateTimeLabel,
            zoomLink: workshop.zoom_link || null,
          },
          'telegram'
        )
      : Promise.resolve(false),
  ])

  return { whatsapp, telegram }
}