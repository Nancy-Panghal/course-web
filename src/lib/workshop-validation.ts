// src/lib/workshop-validation.ts
//
// ONE set of rules for workshop fields, used by BOTH the create page and the
// workshop settings page, so the two can never disagree about what is valid.
// Pure functions: no Supabase, no React.

import { WORKSHOP_LIMITS, istDateTimeToISO } from './workshops'
import {
  cleanWorkshopLandingConfig,
  cleanWorkshopTagline,
  normalizeAgenda,
  type WorkshopAgendaItem,
  type WorkshopLandingConfig,
} from './workshop-landing-config'
import { MAX_ENROLL_BUTTON_CHARS, MAX_ENROLL_BUTTON_WORDS, MAX_FINAL_CTA_WORDS, getVideoEmbedUrl } from './landing-config'
import { DEFAULT_LANDING_THEME_ID, LANDING_THEMES } from './landing-themes'
import { FONT_PAIR_OPTIONS } from './landing-themes/fontPairs'
import { LANDING_LANGUAGES, LANDING_LEVELS } from './landing-options'
import { getContactDetailsErrors, cleanContactDetails, type ContactDetail } from './contact-details'
import { getSocialLinksErrors, cleanSocialLinks, type SocialLink } from './social-links'

export const WORKSHOP_CONTENT_LIMITS = {
  aboutHost: 600,
  listItems: 6,
  listItemLength: 120,
  faqItems: 10,
  faqQuestion: 150,
  faqAnswer: 600,
  coHosts: 6,
  coHostName: 60,
  coHostTitle: 80,
  coHostBio: 400,
  testimonials: 15,
  testimonialName: 60,
  testimonialText: 500,
  brandName: 60,
  promoVideos: 3,
  videoHeading: 80,
} as const

/** Which settings tab a validation problem belongs to. */
export type WorkshopSection = 'details' | 'content' | 'branding' | 'design'

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; /** which settings tab the problem is on */ section: WorkshopSection }

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

const trimTo = (raw: unknown, max: number) => (typeof raw === 'string' ? raw.trim().slice(0, max) : '')

// ─── Core fields (title, schedule, price, seats, host, link, takeaways) ─────

export type WorkshopFormValues = {
  title: string
  tagline: string
  description: string
  date: string // YYYY-MM-DD, IST
  time: string // HH:MM, IST
  duration: string // minutes
  pricing: 'free' | 'paid'
  price: string
  originalPrice: string
  capacity: string
  hostName: string
  hostTitle: string
  zoomLink: string
  takeaways: string[]
}

/** Exactly the workshops columns these fields write. */
export type WorkshopFieldsPatch = {
  title: string
  tagline: string | null
  description: string | null
  date_time: string
  duration_minutes: number
  price: number
  original_price: number | null
  capacity: number | null
  zoom_link: string | null
  host_name: string
  instructor_title: string | null
  what_you_will_learn: string[]
}

export function validateWorkshopFields(
  v: WorkshopFormValues,
  opts: {
    /** Reject a start time that has already passed (true when creating, or when
     *  the date/time was changed; false when only other fields were edited). */
    requireFutureStart: boolean
    /** Seats can't be set below the number of spots already taken. */
    minSeats?: number
  }
): ValidationResult<WorkshopFieldsPatch> {
  const fail = (error: string, section: WorkshopSection = 'details'): ValidationResult<WorkshopFieldsPatch> =>
    ({ ok: false, error, section })

  const title = v.title.trim()
  if (!title) return fail('Give your workshop a title.')

  const startsAt = istDateTimeToISO(v.date, v.time)
  if (!startsAt) return fail('Pick the date and start time (IST).')
  if (opts.requireFutureStart && new Date(startsAt).getTime() <= Date.now()) {
    return fail('That start time has already passed. Pick a time in the future (IST).')
  }

  const duration = parseInt(v.duration, 10)
  if (!Number.isFinite(duration) || duration < 15 || duration > 600) return fail('Pick how long the workshop runs.')

  const hostName = v.hostName.trim()
  if (!hostName) return fail('Add the host name. It is shown on your workshop page.', 'content')

  let price = 0
  if (v.pricing === 'paid') {
    price = parseInt(v.price, 10)
    if (!Number.isFinite(price) || price < 1) return fail('Enter a price of ₹1 or more, or switch to Free.')
  }

  let originalPrice: number | null = null
  if (v.pricing === 'paid' && v.originalPrice.trim()) {
    originalPrice = parseInt(v.originalPrice, 10)
    if (!Number.isFinite(originalPrice) || originalPrice <= price) {
      return fail('The original price must be higher than the price. It is shown crossed out.')
    }
  }

  let capacity: number | null = null
  if (v.capacity.trim()) {
    capacity = parseInt(v.capacity, 10)
    if (!Number.isFinite(capacity) || capacity < 1) return fail('Seats must be a whole number, 1 or more.')
    if (opts.minSeats && capacity < opts.minSeats) {
      return fail(`${opts.minSeats} seats are already taken, so seats can't be fewer than that.`)
    }
  }

  const zoom = v.zoomLink.trim()
  if (zoom && !isHttpUrl(zoom)) return fail('The joining link must start with https:// (Zoom, Google Meet, etc.).')

  return {
    ok: true,
    data: {
      title: title.slice(0, WORKSHOP_LIMITS.title),
      tagline: cleanWorkshopTagline(v.tagline) || null,
      description: trimTo(v.description, WORKSHOP_LIMITS.description) || null,
      date_time: startsAt,
      duration_minutes: duration,
      price,
      original_price: price > 0 ? originalPrice : null,
      capacity,
      zoom_link: zoom || null,
      host_name: hostName.slice(0, WORKSHOP_LIMITS.hostName),
      instructor_title: trimTo(v.hostTitle, WORKSHOP_LIMITS.hostTitle) || null,
      what_you_will_learn: cleanStringList(v.takeaways, WORKSHOP_LIMITS.takeaways, WORKSHOP_LIMITS.takeawayLength),
    },
  }
}

// ─── Page content (host details, lists, agenda, FAQ) ────────────────────────

export type WorkshopFaqItem = { question: string; answer: string }
export type WorkshopCoHost = { name: string; title: string; image: string; bio: string }

/** Trim, drop blanks, clamp length and count. */
export function cleanStringList(
  list: unknown,
  max: number = WORKSHOP_CONTENT_LIMITS.listItems,
  itemMax: number = WORKSHOP_CONTENT_LIMITS.listItemLength
): string[] {
  if (!Array.isArray(list)) return []
  return list.map(item => trimTo(item, itemMax)).filter(Boolean).slice(0, max)
}

/** A question is only kept when it has an answer, and vice versa. */
export function cleanFaq(value: unknown): WorkshopFaqItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      question: trimTo(item?.question, WORKSHOP_CONTENT_LIMITS.faqQuestion),
      answer: trimTo(item?.answer, WORKSHOP_CONTENT_LIMITS.faqAnswer),
    }))
    .filter(item => item.question && item.answer)
    .slice(0, WORKSHOP_CONTENT_LIMITS.faqItems)
}

export function cleanCoHosts(value: unknown): WorkshopCoHost[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      name: trimTo(item?.name, WORKSHOP_CONTENT_LIMITS.coHostName),
      title: trimTo(item?.title, WORKSHOP_CONTENT_LIMITS.coHostTitle),
      image: typeof item?.image === 'string' && isHttpUrl(item.image) ? item.image : '',
      bio: trimTo(item?.bio, WORKSHOP_CONTENT_LIMITS.coHostBio),
    }))
    .filter(item => item.name)
}

export type WorkshopTestimonial =
  | { type: 'written'; name: string; text: string; rating: number; photo_url?: string }
  | { type: 'screenshot'; image_url: string }

/** Written testimonials need a name and text; screenshots need an image. */
export function cleanTestimonials(value: unknown): WorkshopTestimonial[] {
  if (!Array.isArray(value)) return []
  const out: WorkshopTestimonial[] = []
  for (const t of value as any[]) {
    if (t?.type === 'screenshot') {
      if (typeof t.image_url === 'string' && isHttpUrl(t.image_url)) out.push({ type: 'screenshot', image_url: t.image_url })
      continue
    }
    const name = trimTo(t?.name, WORKSHOP_CONTENT_LIMITS.testimonialName)
    const text = trimTo(t?.text, WORKSHOP_CONTENT_LIMITS.testimonialText)
    if (!name || !text) continue
    const rating = Math.min(5, Math.max(1, Math.round(Number(t?.rating)) || 5))
    const item: WorkshopTestimonial = { type: 'written', name, text, rating }
    if (typeof t?.photo_url === 'string' && isHttpUrl(t.photo_url)) item.photo_url = t.photo_url
    out.push(item)
  }
  return out.slice(0, WORKSHOP_CONTENT_LIMITS.testimonials)
}

export type WorkshopContentValues = {
  hostImage: string
  aboutHost: string
  coHosts: WorkshopCoHost[]
  audience: string[]
  bring: string[]
  agenda: WorkshopAgendaItem[]
  faq: WorkshopFaqItem[]
  testimonials: WorkshopTestimonial[]
  languages: string[]
  level: string
  videoUrls: string[]
  videoHeading: string
}

/** Exactly the workshops columns these fields write. */
export type WorkshopContentPatch = {
  host_image: string | null
  about_creator: string | null
  co_instructors: WorkshopCoHost[]
  target_audience: string[]
  requirements: string[]
  agenda: WorkshopAgendaItem[]
  faq: WorkshopFaqItem[]
  testimonials: WorkshopTestimonial[]
  language: string[]
  level: string | null
  promo_video_urls: string[]
  promo_video_heading: string | null
}

export function validateWorkshopContent(v: WorkshopContentValues): ValidationResult<WorkshopContentPatch> {
  const fail = (error: string): ValidationResult<WorkshopContentPatch> => ({ ok: false, error, section: 'content' })

  if (v.coHosts.length > WORKSHOP_CONTENT_LIMITS.coHosts) {
    return fail(`You can add up to ${WORKSHOP_CONTENT_LIMITS.coHosts} co-hosts.`)
  }
  if (v.coHosts.some(h => !h.name.trim() && (h.title.trim() || h.bio.trim() || h.image))) {
    return fail('Each co-host needs a name. Add one or remove the empty co-host.')
  }
  if (v.hostImage && !isHttpUrl(v.hostImage)) return fail('The host photo link is not valid. Upload the photo again.')

  const videoUrls = v.videoUrls.map(u => u.trim()).filter(Boolean)
  if (videoUrls.length > WORKSHOP_CONTENT_LIMITS.promoVideos) {
    return fail(`You can add up to ${WORKSHOP_CONTENT_LIMITS.promoVideos} videos.`)
  }
  const badVideo = videoUrls.find(u => !getVideoEmbedUrl(u))
  if (badVideo) return fail(`"${badVideo.slice(0, 60)}" is not a YouTube or Vimeo link.`)

  return {
    ok: true,
    data: {
      host_image: v.hostImage || null,
      about_creator: trimTo(v.aboutHost, WORKSHOP_CONTENT_LIMITS.aboutHost) || null,
      co_instructors: cleanCoHosts(v.coHosts),
      target_audience: cleanStringList(v.audience),
      requirements: cleanStringList(v.bring),
      agenda: normalizeAgenda(v.agenda),
      faq: cleanFaq(v.faq),
      testimonials: cleanTestimonials(v.testimonials),
      language: Array.from(new Set(v.languages)).filter(l => (LANDING_LANGUAGES as readonly string[]).includes(l)),
      level: (LANDING_LEVELS as readonly string[]).includes(v.level) ? v.level : null,
      promo_video_urls: videoUrls,
      promo_video_heading: trimTo(v.videoHeading, WORKSHOP_CONTENT_LIMITS.videoHeading) || null,
    },
  }
}

// ─── Branding, contact, social links, policy documents ──────────────────────

export type WorkshopBrandingValues = {
  brandName: string
  brandLogo: string
  coverImage: string
  contactDetails: ContactDetail[]
  socialLinks: SocialLink[]
  refundDoc: string
  termsDoc: string
  privacyDoc: string
}

/** Exactly the workshops columns these fields write. */
export type WorkshopBrandingPatch = {
  brand_name: string | null
  brand_logo_url: string | null
  cover_image_url: string | null
  contact_details: ContactDetail[]
  social_links: SocialLink[]
  refund_policy_storage_path: string | null
  terms_storage_path: string | null
  privacy_storage_path: string | null
}

export function validateWorkshopBranding(v: WorkshopBrandingValues): ValidationResult<WorkshopBrandingPatch> {
  const fail = (error: string): ValidationResult<WorkshopBrandingPatch> => ({ ok: false, error, section: 'branding' })

  // Same checks the course settings run before saving (lib/contact-details.ts, lib/social-links.ts).
  if (getContactDetailsErrors(v.contactDetails).hasErrors) return fail('Fix the contact details marked in red before saving.')
  if (getSocialLinksErrors(v.socialLinks).hasErrors) return fail('Fix the social links marked in red before saving.')

  const urls: [string, string][] = [
    [v.brandLogo, 'brand logo'], [v.coverImage, 'cover image'],
    [v.refundDoc, 'refund policy'], [v.termsDoc, 'terms and conditions'], [v.privacyDoc, 'privacy policy'],
  ]
  for (const [url, label] of urls) {
    if (url && !isHttpUrl(url)) return fail(`The ${label} link is not valid. Upload it again.`)
  }

  return {
    ok: true,
    data: {
      brand_name: trimTo(v.brandName, WORKSHOP_CONTENT_LIMITS.brandName) || null,
      brand_logo_url: v.brandLogo || null,
      cover_image_url: v.coverImage || null,
      contact_details: cleanContactDetails(v.contactDetails),
      social_links: cleanSocialLinks(v.socialLinks),
      refund_policy_storage_path: v.refundDoc || null,
      terms_storage_path: v.termsDoc || null,
      privacy_storage_path: v.privacyDoc || null,
    },
  }
}

// ─── Design (theme, fonts, section order, bonuses, custom sections, CTA) ────

export type WorkshopDesignValues = {
  theme: string
  /** A FontPairId; 'theme-default' means "use the theme's own fonts". */
  fontPair: string
  landingConfig: WorkshopLandingConfig
}

/** Exactly the workshops columns these fields write. */
export type WorkshopDesignPatch = {
  landing_theme: string
  landing_font_pair: string | null
  landing_config: WorkshopLandingConfig
}

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

export function validateWorkshopDesign(v: WorkshopDesignValues): ValidationResult<WorkshopDesignPatch> {
  const fail = (error: string): ValidationResult<WorkshopDesignPatch> => ({ ok: false, error, section: 'design' })

  // Say so, instead of silently cutting a label in half when it is cleaned.
  for (const [text, label] of [[v.landingConfig.registerButtonText, 'Register button text'], [v.landingConfig.finalCtaButtonText, 'Register bar button text']] as const) {
    if (wordCount(text) > MAX_ENROLL_BUTTON_WORDS || text.trim().length > MAX_ENROLL_BUTTON_CHARS) {
      return fail(`${label} can be up to ${MAX_ENROLL_BUTTON_WORDS} words and ${MAX_ENROLL_BUTTON_CHARS} characters.`)
    }
  }
  if (wordCount(v.landingConfig.finalCtaText) > MAX_FINAL_CTA_WORDS) {
    return fail(`The register bar message can be up to ${MAX_FINAL_CTA_WORDS} words.`)
  }

  const themeKnown = LANDING_THEMES.some(t => t.id === v.theme)
  return {
    ok: true,
    data: {
      landing_theme: themeKnown ? v.theme : DEFAULT_LANDING_THEME_ID,
      landing_font_pair: FONT_PAIR_OPTIONS.some(o => o.id === v.fontPair && o.id !== 'theme-default') ? v.fontPair : null,
      landing_config: cleanWorkshopLandingConfig(v.landingConfig),
    },
  }
}