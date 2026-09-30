// src/components/MetaPixel.tsx
// Loads the creator's Meta Pixel on the public workshop page ONLY.
// Rendered only when the creator saved a pixel id; the id is re-validated
// here (digits only) before it goes anywhere near a script.
'use client'
import { useEffect } from 'react'

declare global {
  interface Window {
    fbq?: any
    _fbq?: any
  }
}

const PIXEL_ID_RE = /^\d{8,20}$/

/**
 * Browser-side Lead. `eventId` MUST be the id the server used for its own
 * Lead (returned by the register API) — that shared id is what makes Meta
 * count one lead instead of two. Fires once per registration per tab session.
 * No value/currency on purpose: a signup is not a sale.
 */
export function trackMetaLead(eventId: string, contentName: string) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  const key = `kurso_meta_lead_${eventId}`
  let alreadySent = false
  try {
    alreadySent = !!window.sessionStorage.getItem(key)
    if (!alreadySent) window.sessionStorage.setItem(key, '1')
  } catch {
    // Storage blocked (private mode) — fall through and send.
  }
  if (alreadySent) return
  window.fbq('track', 'Lead', { content_name: contentName, content_category: 'workshop' }, { eventID: eventId })
}

export default function MetaPixel({ pixelId }: { pixelId: string }) {
  useEffect(() => {
    if (!PIXEL_ID_RE.test(pixelId)) return
    if (typeof window.fbq === 'function') return // already initialised

    // Meta's standard base code.
    const fbq: any = function (...args: any[]) {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, args)
      else fbq.queue.push(args)
    }
    window.fbq = fbq
    if (!window._fbq) window._fbq = fbq
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)

    window.fbq('init', pixelId)
    window.fbq('track', 'PageView')
  }, [pixelId])

  return null
}