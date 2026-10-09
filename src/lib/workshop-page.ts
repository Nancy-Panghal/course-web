// src/lib/workshop-page.ts
//
// Pure helpers for the public workshop page: theme-derived CSS variables,
// IST date labels, discount math and the Google "Event" structured data.
// No React, no Supabase, so it is easy to test.

import type { CSSProperties } from 'react'
import type { LandingThemeColors } from './landing-themes/types'

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** True for a light page background (paper-white, sage-meadow, ...). */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const [r, g, b] = rgb.map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5
}

/** "#0a0a0a" + 0.6 -> "rgba(10, 10, 10, 0.6)". Falls back to the input. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : hex
}

/**
 * The --ws-* variables the page and WorkshopRegisterForm read. Muted text is
 * pulled toward the primary text color (never toward white), so small helper
 * text keeps its contrast on BOTH dark and light themes.
 */
export function getWorkshopPageVars(c: LandingThemeColors): CSSProperties {
  const light = isLightColor(c.bg)
  return {
    '--ws-text': c.textPrimary,
    '--ws-secondary': c.textSecondary,
    '--ws-muted': `color-mix(in srgb, ${c.textMuted} 70%, ${c.textPrimary} 30%)`,
    '--ws-field-bg': c.cardBg,
    '--ws-field-border': c.borderSoft,
    '--ws-success': light ? '#166534' : '#4ade80',
    '--ws-success-bg': light ? 'rgba(22, 101, 52, 0.10)' : 'rgba(74, 222, 128, 0.10)',
    '--ws-success-border': light ? 'rgba(22, 101, 52, 0.30)' : 'rgba(74, 222, 128, 0.25)',
    '--ws-danger': light ? '#b91c1c' : '#f87171',
  } as CSSProperties
}

export type WorkshopDateParts = { weekday: string; date: string; time: string }

/** All labels are IST, the same zone creators schedule in. */
export function formatWorkshopDateParts(iso: string): WorkshopDateParts {
  const d = new Date(iso)
  const f = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...opts }).format(d)
  return {
    weekday: f({ weekday: 'long' }),
    date: f({ day: 'numeric', month: 'long', year: 'numeric' }),
    time: f({ hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase(),
  }
}

/** Whole-number percent off, or null when there is no real discount. */
export function discountPercent(price: number, originalPrice?: number | null): number | null {
  if (!originalPrice || originalPrice <= price || price < 0) return null
  return Math.round(((originalPrice - price) / originalPrice) * 100)
}

/** JSON for a <script type="application/ld+json">; "<" is escaped so user text
 *  can never close the script tag. */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function buildEventJsonLd(input: {
  name: string
  description: string
  startIso: string
  endIso: string
  url: string | null
  images: string[]
  organizer: string
  price: number
  seatsLeft: number | null
  open: boolean
}) {
  const soldOut = input.seatsLeft === 0
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    description: input.description,
    startDate: input.startIso,
    endDate: input.endIso,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: { '@type': 'VirtualLocation', ...(input.url ? { url: input.url } : {}) },
    ...(input.images.length ? { image: input.images } : {}),
    organizer: { '@type': 'Person', name: input.organizer },
    offers: {
      '@type': 'Offer',
      price: String(input.price),
      priceCurrency: 'INR',
      availability: !input.open || soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      ...(input.url ? { url: input.url } : {}),
    },
  }
}