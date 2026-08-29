// ============================================================================
// LANDING PAGE CONFIG — single source of truth for section types, order,
// content, and metadata. Both the dashboard editor (Step 3) and the live
// renderer (Step 2) import from THIS file only — no separate section lists
// anywhere else. That drift (dashboard had its own ALL_SECTIONS list, the
// renderer had its own `show()` keys, this file had a third list) is exactly
// the bug that caused sections/config to go out of sync before. Don't
// recreate a fourth list — extend this one.
// ============================================================================

export const LANDING_SECTION_TYPES = [
  'hero',
  'urgency',
  'stats',
  'target',
  'learn',
  'requirements',
  'bonuses',
  'videos',
  'curriculum',
  'instructor',
  'testimonials',
  'custom',
  'howItWorks',
  'faq',
  'disclaimer',
  'finalCta',
] as const

import { sanitizeCustomSectionText, MAX_CUSTOM_HEADING_LENGTH, MAX_CUSTOM_BODY_LENGTH, MAX_CUSTOM_SECTIONS_PER_COURSE } from './customSectionText'

export type LandingSectionType = (typeof LANDING_SECTION_TYPES)[number]

/** One row in the ordered section list a creator configures. */
export type LandingSectionEntry = {
  type: LandingSectionType
  enabled: boolean
  /** Only set when type === 'custom' — links this order-list entry to one
   *  row in `customSections`. Every other section type is a singleton and
   *  never sets this. */
  customId?: string
}

export type LandingBonusItem = {
  title: string
  description: string
}

export type LandingDisclaimerConfig = {
  title: string
  text: string
}

/** One creator-written text section — heading + body only, no images, video
 *  or embeds. Sizing/spacing/style are per-section so a creator can make one
 *  feel different from another; theme colors/fonts apply automatically
 *  unless `background` is set to 'custom'. */
export const MAX_CUSTOM_SECTION_IMAGES = 10
export const MAX_PROMO_VIDEOS = 3
export const MAX_FINAL_CTA_WORDS = 50
export const DEFAULT_FINAL_CTA_TEXT = 'Enroll to polish your skills!'

export type LandingCustomSection = {
  id: string
  heading: string
  body: string
  headingSize: 'sm' | 'md' | 'lg'
  bodySize: 'sm' | 'md' | 'lg'
  align: 'left' | 'center'
  style: 'plain' | 'card'
  background: 'theme' | 'custom'
  backgroundColor: string
  spacing: 'compact' | 'normal' | 'roomy'
  /** Uploaded image URLs — 1 renders full-width, 2 side by side, 3 in one
   *  row, 4+ in one horizontally scrollable row. Rendered below the text. */
  images: string[]
}

/** Recognizes a YouTube or Vimeo URL and returns its embeddable iframe src,
 *  or null for anything else — the about-course renderer and the course
 *  settings page both call this instead of parsing URLs independently. */
export function getVideoEmbedUrl(url: string): string | null {
  if (typeof url !== 'string') return null
  const yt = url.match(/(?:v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

/** Countdown timer + seats-remaining urgency block. Content only —
 *  whether it's shown/where it sits is controlled by its entry in
 *  `sections` (type: 'urgency'), same as every other section. */
export type LandingUrgencyConfig = {
  endAt: string // ISO datetime string, empty = no countdown shown
  label: string // e.g. "Enrollment closes in"
  seatsAvailable: number | null // null = don't show seats-left
  seatsLabel: string // e.g. "seats left at this price"
}

export type LandingConfig = {
  sections: LandingSectionEntry[]
  bonuses: LandingBonusItem[]
  disclaimer: LandingDisclaimerConfig
  urgency: LandingUrgencyConfig
  /** One-line message shown on the sticky enroll bar (the 'finalCta'
   *  section), above the price/button. Plain text only, same sanitizer as
   *  custom sections. Defaults to a friendly nudge so a course that's never
   *  touched this still shows something reasonable rather than a blank bar. */
  finalCtaText: string
  customSections: LandingCustomSection[]
  /** 'square' = compact cards side by side (today's 2+ instructor look).
   *  'rectangle' = wide fixed-width card, height grows with bio text, one
   *  per row instead of side by side. Applies regardless of how many
   *  instructors there are. */
  instructorLayout: 'square' | 'rectangle'
}

/** Metadata the dashboard editor uses to render labels/descriptions/icons,
 *  and the renderer uses to know which sections are structurally mandatory.
 *  `locked: true` means the section can be reordered but never fully
 *  disabled (a course landing page with no hero or no CTA is a broken page,
 *  not a valid creator choice). */
export const LANDING_SECTION_META: Record<
  LandingSectionType,
  { label: string; description: string; icon: string; locked?: boolean; category: 'core' | 'engagement' | 'growth' | 'compliance' }
> = {
  hero:         { label: 'Hero',                 description: 'Title, description, price and main CTA',       icon: 'Rocket',       locked: true,  category: 'core' },
  videos:       { label: 'Videos',                description: 'Up to 3 YouTube or Vimeo videos, shown after the hero', icon: 'PlayCircle', category: 'core' },
  urgency:      { label: 'Countdown & Seats',     description: 'Optional urgency banner — closing countdown and/or seats-left counter', icon: 'Timer', category: 'growth' },
  stats:        { label: 'Quick Stats',           description: 'Duration, language and level pills',           icon: 'BarChart3',    category: 'core' },
  target:       { label: 'Who is this for?',      description: 'Target audience bullet list',                  icon: 'Target',       category: 'engagement' },
  learn:        { label: "What you'll learn",     description: 'Learning outcomes checklist',                  icon: 'CheckCircle2', category: 'engagement' },
  requirements: { label: 'Requirements',          description: 'Prerequisites list',                           icon: 'ListChecks',   category: 'engagement' },
  bonuses:      { label: 'Bonuses',                description: 'Extra resources, templates or perks included', icon: 'Gift',         category: 'growth' },
  curriculum:   { label: 'Curriculum',             description: 'Module & lesson accordion',                    icon: 'BookOpen',     category: 'core' },
  instructor:   { label: 'Instructor',             description: 'Photo, title and bio',                         icon: 'UserCircle',   category: 'core' },
  testimonials: { label: 'Testimonials',           description: 'Student reviews and star ratings',             icon: 'Star',         category: 'growth' },
  custom:       { label: 'Custom section',          description: 'A text section you write yourself',           icon: 'FileText',     category: 'engagement' },
  howItWorks:   { label: 'How it works',           description: 'Enroll → WhatsApp/Telegram → Learn steps',    icon: 'Workflow',     category: 'engagement' },
  faq:          { label: 'FAQ',                    description: 'Frequently asked questions',                   icon: 'HelpCircle',   category: 'engagement' },
  
  disclaimer:   { label: 'Disclaimer',             description: 'Optional compliance / legal / safety notice — place it wherever it needs to legally sit on the page', icon: 'AlertTriangle', category: 'compliance' },
  finalCta:     { label: 'Final CTA',              description: 'Closing enrollment call-to-action',            icon: 'Zap',          category: 'core' },
}

/** Sections that are hidden by default until a creator opts in — everything
 *  else defaults to visible so existing courses look unchanged. */
const OPT_IN_BY_DEFAULT: LandingSectionType[] = ['bonuses', 'disclaimer', 'urgency']

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  // 'custom' is excluded here — unlike every other type, it isn't a fixed
  // singleton section. Entries only exist once a creator actually adds one.
  sections: LANDING_SECTION_TYPES.filter(type => type !== 'custom').map(type => ({ type, enabled: !OPT_IN_BY_DEFAULT.includes(type) })),
  bonuses: [],
  disclaimer: { title: 'Important information', text: '' },
  urgency: { endAt: '', label: 'Enrollment closes in', seatsAvailable: null, seatsLabel: 'seats left at this price' },
    customSections: [],
  instructorLayout: 'square',
  finalCtaText: DEFAULT_FINAL_CTA_TEXT,
}

/**
 * Makes ANY stored value safe to render, regardless of how partial, stale,
 * or hand-edited it is:
 *  - unknown/garbage input -> falls back to defaults
 *  - missing section types (new sections added after a course was configured,
 *    e.g. 'urgency' didn't exist before this feature) -> appended in default order
 *  - duplicate entries -> first occurrence wins, rest dropped
 *  - unrecognized section types (renamed/removed in a future version) -> dropped
 *  - locked sections (hero/finalCta) -> forced enabled, can't be
 *    saved as disabled even by a bad API call or hand-edited row
 *  - legacyFlatSections -> the OLD boolean-map format (`landing_sections`
 *    column), used to seed sensible defaults for courses configured before
 *    this feature existed, so nobody's existing page changes on upgrade
 */
const CUSTOM_HEADING_SIZES = ['sm', 'md', 'lg'] as const
const CUSTOM_BODY_SIZES = ['sm', 'md', 'lg'] as const
const CUSTOM_ALIGNS = ['left', 'center'] as const
const CUSTOM_STYLES = ['plain', 'card'] as const
const CUSTOM_BACKGROUNDS = ['theme', 'custom'] as const
const CUSTOM_SPACINGS = ['compact', 'normal', 'roomy'] as const
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function normalizeCustomSection(item: Record<string, unknown>): LandingCustomSection {
  const backgroundColor = typeof item.backgroundColor === 'string' && HEX_COLOR_RE.test(item.backgroundColor) ? item.backgroundColor : '#000000'
  const images = Array.isArray(item.images)
    ? item.images.filter((v): v is string => typeof v === 'string' && /^https:\/\//.test(v)).slice(0, MAX_CUSTOM_SECTION_IMAGES)
    : []
  return {
    id: String(item.id),
    heading: sanitizeCustomSectionText(typeof item.heading === 'string' ? item.heading : '').slice(0, MAX_CUSTOM_HEADING_LENGTH),
    body: sanitizeCustomSectionText(typeof item.body === 'string' ? item.body : '').slice(0, MAX_CUSTOM_BODY_LENGTH),
    headingSize: pickEnum(item.headingSize, CUSTOM_HEADING_SIZES, 'md'),
    bodySize: pickEnum(item.bodySize, CUSTOM_BODY_SIZES, 'md'),
    align: pickEnum(item.align, CUSTOM_ALIGNS, 'left'),
    style: pickEnum(item.style, CUSTOM_STYLES, 'plain'),
    background: pickEnum(item.background, CUSTOM_BACKGROUNDS, 'theme'),
    backgroundColor,
    spacing: pickEnum(item.spacing, CUSTOM_SPACINGS, 'normal'),
    images,
  }
}

export function normalizeLandingConfig(value: unknown, legacyFlatSections?: Record<string, boolean> | null): LandingConfig {
  const input = value && typeof value === 'object' ? (value as Partial<LandingConfig>) : {}

  // Custom sections are instance-based (many per course), unlike every other
  // type here which is a fixed singleton — normalize the content rows FIRST
  // so the order-list validation below can check customId against real ids.
  const customSections: LandingCustomSection[] = (Array.isArray((input as any).customSections)
    ? (input as any).customSections
        .filter((item: any): item is Record<string, unknown> => !!item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim().length > 0)
        .map((item: any) => normalizeCustomSection(item))
    : []
  ).slice(0, MAX_CUSTOM_SECTIONS_PER_COURSE)
  const customIds = new Set(customSections.map(s => s.id))

  const configured = Array.isArray(input.sections) ? input.sections : []
  const seenTypes = new Set<string>()
  const seenCustomIds = new Set<string>()

  const sections: LandingSectionEntry[] = configured
    .filter((item: any): item is LandingSectionEntry => {
      if (!item || typeof item !== 'object' || !LANDING_SECTION_TYPES.includes(item.type as LandingSectionType)) return false
      if (item.type === 'custom') {
        // Instance-based: keep one order-list entry per valid, non-repeated customId.
        if (!item.customId || !customIds.has(item.customId) || seenCustomIds.has(item.customId)) return false
        seenCustomIds.add(item.customId)
        return true
      }
      // Every other type is a singleton — first occurrence wins.
      if (seenTypes.has(item.type)) return false
      seenTypes.add(item.type)
      return true
    })
    .map((item: any) => ({
      type: item.type,
      enabled:
  LANDING_SECTION_META[item.type as LandingSectionType].locked
    ? true
    : item.enabled !== false,
      ...(item.type === 'custom' ? { customId: item.customId } : {}),
    }))

  // Append any singleton section type not already present — new feature
  // rollouts and never-before-configured courses land here. 'custom' is
  // excluded: it has no singleton default, only real content rows create entries.
  for (const type of LANDING_SECTION_TYPES) {
    if (type === 'custom' || seenTypes.has(type)) continue
    const meta = LANDING_SECTION_META[type]
    const legacyValue = legacyFlatSections?.[type]
    const defaultEnabled = meta.locked ? true : legacyValue !== undefined ? legacyValue !== false : !OPT_IN_BY_DEFAULT.includes(type)
    sections.push({ type, enabled: defaultEnabled })
  }

  // Any custom section content row with no matching order-list entry (e.g.
  // hand-edited/corrupted data) still gets placed — appended just before
  // finalCta — so a valid content row can never silently disappear.
  for (const cs of customSections) {
    if (!seenCustomIds.has(cs.id)) {
      const finalCtaIdx = sections.findIndex(s => s.type === 'finalCta')
      const entry: LandingSectionEntry = { type: 'custom', enabled: true, customId: cs.id }
      if (finalCtaIdx === -1) sections.push(entry)
      else sections.splice(finalCtaIdx, 0, entry)
    }
  }

  return {
    sections,
    bonuses: Array.isArray(input.bonuses)
      ? input.bonuses
          .filter((item): item is LandingBonusItem => !!item && typeof item.title === 'string' && item.title.trim().length > 0)
          .map(item => ({ title: item.title, description: item.description || '' }))
      : [],
    disclaimer: {
      title: (input.disclaimer?.title || DEFAULT_LANDING_CONFIG.disclaimer.title).toString(),
      text: (input.disclaimer?.text || '').toString(),
    },
    
    urgency: {
      endAt: typeof input.urgency?.endAt === 'string' ? input.urgency.endAt : '',
      label: (input.urgency?.label || DEFAULT_LANDING_CONFIG.urgency.label).toString(),
      seatsAvailable:
        typeof input.urgency?.seatsAvailable === 'number' && Number.isFinite(input.urgency.seatsAvailable) && input.urgency.seatsAvailable >= 0
          ? Math.floor(input.urgency.seatsAvailable)
          : null,
      seatsLabel: (input.urgency?.seatsLabel || DEFAULT_LANDING_CONFIG.urgency.seatsLabel).toString(),
    },
        customSections,
    instructorLayout: pickEnum((input as any).instructorLayout, ['square', 'rectangle'] as const, 'square'),
    finalCtaText: (() => {
      const raw = typeof (input as any).finalCtaText === 'string' ? (input as any).finalCtaText : ''
      const cleaned = sanitizeCustomSectionText(raw)
  .replace(/\n/g, ' ')
  .trim()
  .split(/\s+/)
  .slice(0, MAX_FINAL_CTA_WORDS)
  .join(' ')
      return cleaned || DEFAULT_FINAL_CTA_TEXT
    })(),
  }
}

/** Ordered, enabled-only section ENTRIES (not just types) — the live
 *  renderer needs the full entry because several custom sections can share
 *  type 'custom' and are told apart only by customId. */
export function getRenderableSectionEntries(config: LandingConfig): LandingSectionEntry[] {
  return config.sections.filter(s => s.enabled)
}

/** Ordered, enabled-only section list — what the live page actually renders,
 *  in the order the creator chose. Step 2's renderer consumes this directly. */
export function getRenderableSections(config: LandingConfig): LandingSectionType[] {
  return config.sections.filter(s => s.enabled).map(s => s.type)
}

/** True if a countdown and/or seats-left value is actually set — lets the
 *  renderer skip the urgency section even if it's "enabled" but empty. */
export function hasUrgencyContent(urgency: LandingUrgencyConfig): boolean {
  const hasCountdown = !!urgency.endAt && !Number.isNaN(new Date(urgency.endAt).getTime()) && new Date(urgency.endAt).getTime() > Date.now()
  const hasSeats = typeof urgency.seatsAvailable === 'number' && urgency.seatsAvailable >= 0
  return hasCountdown || hasSeats
}