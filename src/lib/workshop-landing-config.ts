// src/lib/workshop-landing-config.ts
//
// ============================================================================
// WORKSHOP LANDING PAGE CONFIG — workshop-only.
//
// Course landing pages NEVER import this file, and this file never changes how
// a course page behaves. It exists because the course config's
// normalizeLandingConfig() appends every type in LANDING_SECTION_TYPES to every
// course — adding workshop-only sections (like "agenda") there would silently
// show up in every existing course. Keeping the workshop section list here
// means the two page types can evolve independently.
//
// What is SHARED (imported from landing-config.ts / customSectionText.ts —
// never copied here, so a fix in one place fixes both):
//   - the custom-section type + its sanitiser (normalizeCustomSection)
//   - bonus / disclaimer types
//   - button-label cleaning (cleanButtonText), pickEnum, text sanitising
// What is WORKSHOP-ONLY (defined below):
//   - the section list, its metadata and default order
//   - the config shape (auto countdown + seats instead of manual "urgency")
//   - agenda + tagline helpers
//
// Stored in workshops.landing_config (jsonb). null / garbage / stale values
// all normalise to safe defaults, same contract as the course config.
// ============================================================================

import {
  MAX_CUSTOM_SECTION_IMAGES,
  MAX_FINAL_CTA_WORDS,
  cleanButtonText,
  normalizeCustomSection,
  pickEnum,
  type LandingBonusItem,
  type LandingCustomSection,
  type LandingDisclaimerConfig,
} from './landing-config'
import {
  MAX_CUSTOM_BODY_LENGTH,
  MAX_CUSTOM_HEADING_LENGTH,
  MAX_CUSTOM_SECTIONS_PER_COURSE,
  sanitizeCustomSectionText,
} from './customSectionText'

// ─── WORKSHOP-ONLY: sections ────────────────────────────────────────────────

/** Order here is the DEFAULT page order for a workshop that was never
 *  customised. 'hero' and 'finalCta' are pinned by the renderer. */
export const WORKSHOP_SECTION_TYPES = [
  'hero',
  'videos',
  'stats',
  'learn',
  'agenda',
  'instructor',
  'target',
  'bonuses',
  'testimonials',
  'custom',
  'faq',
  'requirements',
  'howToJoin',
  'disclaimer',
  'finalCta',
] as const

export type WorkshopSectionType = (typeof WORKSHOP_SECTION_TYPES)[number]

export type WorkshopSectionEntry = {
  type: WorkshopSectionType
  enabled: boolean
  /** Only for type === 'custom' — links this entry to one customSections row. */
  customId?: string
}

/** Labels/descriptions for the workshop designer. `locked` sections can be
 *  reordered but never switched off (a page with no hero or no register
 *  button is broken, not a creator choice).
 *  RENDER RULE (for the public page): a section with no content renders
 *  nothing, even if enabled — no hollow headings. */
export const WORKSHOP_SECTION_META: Record<
  WorkshopSectionType,
  { label: string; description: string; icon: string; locked?: boolean; category: 'core' | 'engagement' | 'growth' | 'compliance' }
> = {
  hero: { label: 'Hero', description: 'Title, tagline, date, price and the register button', icon: 'Rocket', locked: true, category: 'core' },
  videos: { label: 'Videos', description: 'Up to 3 YouTube or Vimeo videos, shown after the hero', icon: 'PlayCircle', category: 'core' },
  stats: { label: 'Quick facts', description: 'Date, duration, language and level pills', icon: 'BarChart3', category: 'core' },
  learn: { label: "What you'll learn", description: 'Takeaways checklist', icon: 'CheckCircle2', category: 'engagement' },
  agenda: { label: 'Agenda', description: 'What happens during the session, step by step', icon: 'ListOrdered', category: 'core' },
  instructor: { label: 'Host', description: 'Photo, title and bio (plus co-hosts)', icon: 'UserCircle', category: 'core' },
  target: { label: 'Who is this for?', description: 'Target audience bullet list', icon: 'Target', category: 'engagement' },
  bonuses: { label: 'Bonuses', description: 'Extra resources, templates or perks included', icon: 'Gift', category: 'growth' },
  testimonials: { label: 'Testimonials', description: 'Reviews from past attendees', icon: 'Star', category: 'growth' },
  custom: { label: 'Custom section', description: 'A text section you write yourself', icon: 'FileText', category: 'engagement' },
  faq: { label: 'FAQ', description: 'Frequently asked questions', icon: 'HelpCircle', category: 'engagement' },
  requirements: { label: 'What to bring', description: 'Things to prepare or have ready before the session', icon: 'ListChecks', category: 'engagement' },
  howToJoin: { label: 'How to join', description: 'How attendees receive the joining link after registering', icon: 'Video', category: 'engagement' },
  disclaimer: { label: 'Disclaimer', description: 'Optional compliance / legal / safety notice', icon: 'AlertTriangle', category: 'compliance' },
  finalCta: { label: 'Register bar', description: 'Sticky register button (bottom of the screen on mobile)', icon: 'Zap', locked: true, category: 'core' },
}

/** Hidden until the creator opts in — everything else defaults to visible
 *  (and simply renders nothing while it has no content). */
const OPT_IN_BY_DEFAULT: WorkshopSectionType[] = ['bonuses', 'disclaimer']

// ─── WORKSHOP-ONLY: config shape ────────────────────────────────────────────

export const DEFAULT_REGISTER_BUTTON_TEXT = 'Register Now'
export const DEFAULT_WORKSHOP_FINAL_CTA_TEXT = 'Save your seat for the live workshop'
export const MAX_CUSTOM_SECTIONS_PER_WORKSHOP = MAX_CUSTOM_SECTIONS_PER_COURSE

export type WorkshopLandingConfig = {
  sections: WorkshopSectionEntry[]
  bonuses: LandingBonusItem[]
  disclaimer: LandingDisclaimerConfig
  customSections: LandingCustomSection[]
  instructorLayout: 'square' | 'rectangle'
  /** One-line message on the sticky register bar. */
  finalCtaText: string
  /** Label on the register buttons. '' = DEFAULT_REGISTER_BUTTON_TEXT. */
  registerButtonText: string
  /** Label on the sticky bar's button only. '' = same as registerButtonText. */
  finalCtaButtonText: string
  /** Countdown to the start time — computed from workshops.date_time, so the
   *  creator never types a date twice and it can never be wrong. */
  showCountdown: boolean
  /** Seats left — computed from workshops.capacity (ignored when no cap). */
  showSeatsLeft: boolean
  /** Global text size for the page. 'standard' is the default; there is no
   *  "small" option on purpose — small text is hard to read on phones. */
  textSize: 'standard' | 'large'
}

export const DEFAULT_WORKSHOP_LANDING_CONFIG: WorkshopLandingConfig = {
  sections: WORKSHOP_SECTION_TYPES.filter(type => type !== 'custom').map(type => ({
    type,
    enabled: !OPT_IN_BY_DEFAULT.includes(type),
  })),
  bonuses: [],
  disclaimer: { title: 'Important information', text: '' },
  customSections: [],
  instructorLayout: 'square',
  finalCtaText: DEFAULT_WORKSHOP_FINAL_CTA_TEXT,
  registerButtonText: '',
  finalCtaButtonText: '',
  showCountdown: true,
  showSeatsLeft: true,
  textSize: 'standard',
}

/**
 * Makes ANY stored value safe to render (null, partial, stale, hand-edited).
 * Same rules as the course normaliser, minus the course-only legacy migrations:
 *  - unknown / duplicate section types dropped (first occurrence wins)
 *  - missing section types appended in default order
 *  - locked sections (hero, finalCta) forced on
 *  - custom sections kept only when their content row exists
 */
export function normalizeWorkshopLandingConfig(value: unknown): WorkshopLandingConfig {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, any>

  // Custom sections are instance-based — normalise content rows FIRST so the
  // order list below can check customId against real ids.
  const customSections: LandingCustomSection[] = (Array.isArray(input.customSections) ? input.customSections : [])
    .filter((item: any): item is Record<string, unknown> => !!item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim().length > 0)
    .map((item: Record<string, unknown>) => normalizeCustomSection(item))
    .slice(0, MAX_CUSTOM_SECTIONS_PER_WORKSHOP)
  const customIds = new Set(customSections.map(s => s.id))

  const configured: any[] = Array.isArray(input.sections) ? input.sections : []
  const seenTypes = new Set<string>()
  const seenCustomIds = new Set<string>()
  const sections: WorkshopSectionEntry[] = []

  for (const item of configured) {
    if (!item || typeof item !== 'object' || !(WORKSHOP_SECTION_TYPES as readonly string[]).includes(item.type)) continue
    if (item.type === 'custom') {
      if (!item.customId || !customIds.has(item.customId) || seenCustomIds.has(item.customId)) continue
      seenCustomIds.add(item.customId)
      sections.push({ type: 'custom', enabled: item.enabled !== false, customId: item.customId })
      continue
    }
    if (seenTypes.has(item.type)) continue
    seenTypes.add(item.type)
    const type = item.type as WorkshopSectionType
    sections.push({ type, enabled: WORKSHOP_SECTION_META[type].locked ? true : item.enabled !== false })
  }

  // Append any singleton type not already present (new workshops land here:
  // an empty config yields the full default order).
  for (const type of WORKSHOP_SECTION_TYPES) {
    if (type === 'custom' || seenTypes.has(type)) continue
    sections.push({ type, enabled: WORKSHOP_SECTION_META[type].locked ? true : !OPT_IN_BY_DEFAULT.includes(type) })
  }

  // A custom content row with no order entry still gets placed (just before
  // finalCta) so valid content can never silently disappear.
  for (const cs of customSections) {
    if (!seenCustomIds.has(cs.id)) {
      const entry: WorkshopSectionEntry = { type: 'custom', enabled: true, customId: cs.id }
      const finalCtaIdx = sections.findIndex(s => s.type === 'finalCta')
      if (finalCtaIdx === -1) sections.push(entry)
      else sections.splice(finalCtaIdx, 0, entry)
    }
  }

  const finalCtaText = sanitizeCustomSectionText(typeof input.finalCtaText === 'string' ? input.finalCtaText : '')
    .replace(/\n/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, MAX_FINAL_CTA_WORDS)
    .join(' ')

  return {
    sections,
    bonuses: Array.isArray(input.bonuses)
      ? input.bonuses
        .filter((item: any): item is LandingBonusItem => !!item && typeof item.title === 'string' && item.title.trim().length > 0)
        .map((item: LandingBonusItem) => ({ title: item.title, description: item.description || '' }))
      : [],
    disclaimer: {
      title: (input.disclaimer?.title || DEFAULT_WORKSHOP_LANDING_CONFIG.disclaimer.title).toString(),
      text: (input.disclaimer?.text || '').toString(),
    },
    customSections,
    instructorLayout: pickEnum(input.instructorLayout, ['square', 'rectangle'] as const, 'square'),
    finalCtaText: finalCtaText || DEFAULT_WORKSHOP_FINAL_CTA_TEXT,
    registerButtonText: cleanButtonText(input.registerButtonText),
    finalCtaButtonText: cleanButtonText(input.finalCtaButtonText),
    showCountdown: typeof input.showCountdown === 'boolean' ? input.showCountdown : true,
    showSeatsLeft: typeof input.showSeatsLeft === 'boolean' ? input.showSeatsLeft : true,
    textSize: pickEnum(input.textSize, ['standard', 'large'] as const, 'standard'),
  }
}

/** Ordered, enabled-only entries — what the public workshop page renders. */
export function getRenderableWorkshopSectionEntries(config: WorkshopLandingConfig): WorkshopSectionEntry[] {
  return config.sections.filter(s => s.enabled)
}

/** Label for the register buttons (nav, hero). */
export function getRegisterButtonText(config: WorkshopLandingConfig): string {
  return config.registerButtonText || DEFAULT_REGISTER_BUTTON_TEXT
}

/** Label for the sticky bar's button: its own text, else the shared one. */
export function getRegisterBarButtonText(config: WorkshopLandingConfig): string {
  return config.finalCtaButtonText || getRegisterButtonText(config)
}

// ─── WORKSHOP-ONLY: agenda + tagline ────────────────────────────────────────

export const MAX_TAGLINE_LENGTH = 140
export const MAX_AGENDA_ITEMS = 12
export const MAX_AGENDA_TITLE_LENGTH = 80
export const MAX_AGENDA_DESCRIPTION_LENGTH = 200

/** One step of the session. Stored in workshops.agenda (jsonb array). */
export type WorkshopAgendaItem = { title: string; description: string }

function oneLine(raw: unknown, max: number): string {
  return sanitizeCustomSectionText(typeof raw === 'string' ? raw : '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** One-line promise under the title. '' = none. */
export function cleanWorkshopTagline(raw: unknown): string {
  return oneLine(raw, MAX_TAGLINE_LENGTH)
}

/** Safe agenda list: drops rows with no title, clamps lengths and count. */
export function normalizeAgenda(value: unknown): WorkshopAgendaItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item: any) => !!item && typeof item === 'object')
    .map((item: any) => ({
      title: oneLine(item.title, MAX_AGENDA_TITLE_LENGTH),
      description: oneLine(item.description, MAX_AGENDA_DESCRIPTION_LENGTH),
    }))
    .filter(item => item.title.length > 0)
    .slice(0, MAX_AGENDA_ITEMS)
}


// ─── WORKSHOP-ONLY: saving + "does this section have anything to show?" ────

export const MAX_BONUSES = 10
export const MAX_BONUS_TITLE_LENGTH = 80
export const MAX_BONUS_DESCRIPTION_LENGTH = 200
export const MAX_DISCLAIMER_TITLE_LENGTH = 80
export const MAX_DISCLAIMER_TEXT_LENGTH = 1000

/**
 * Run on a config right before saving it. Drops anything that would render as
 * an empty block (a bonus with no title, a custom section with no heading AND
 * no text), clamps lengths, then normalises. Same behaviour the course
 * designer has, so a workshop page can never show a hollow section.
 */
export function cleanWorkshopLandingConfig(config: WorkshopLandingConfig): WorkshopLandingConfig {
  const customSections = config.customSections
    .map(cs => ({
      ...cs,
      heading: cs.heading.trim().slice(0, MAX_CUSTOM_HEADING_LENGTH),
      body: cs.body.trim().slice(0, MAX_CUSTOM_BODY_LENGTH),
      images: cs.images.filter(url => /^https:\/\//.test(url)).slice(0, MAX_CUSTOM_SECTION_IMAGES),
    }))
    .filter(cs => cs.heading.length > 0 || cs.body.length > 0 || cs.images.length > 0)

  return normalizeWorkshopLandingConfig({
    ...config,
    bonuses: config.bonuses
      .map(b => ({
        title: b.title.trim().slice(0, MAX_BONUS_TITLE_LENGTH),
        description: b.description.trim().slice(0, MAX_BONUS_DESCRIPTION_LENGTH),
      }))
      .filter(b => b.title.length > 0)
      .slice(0, MAX_BONUSES),
    disclaimer: {
      title: config.disclaimer.title.trim().slice(0, MAX_DISCLAIMER_TITLE_LENGTH),
      text: config.disclaimer.text.trim().slice(0, MAX_DISCLAIMER_TEXT_LENGTH),
    },
    customSections,
  })
}

/** What each section would show. The public page and the designer both use
 *  this, so "enabled but empty" means the same thing in both places. */
export type WorkshopSectionContent = {
  videoUrls: string[]
  takeaways: string[]
  agenda: { title: string }[]
  audience: string[]
  bring: string[]
  bonuses: { title: string }[]
  testimonialCount: number
  faqCount: number
  disclaimerText: string
}

export function workshopSectionHasContent(type: WorkshopSectionType, c: WorkshopSectionContent): boolean {
  const any = (list: string[]) => list.some(item => item.trim().length > 0)
  switch (type) {
    case 'videos': return any(c.videoUrls)
    case 'learn': return any(c.takeaways)
    case 'agenda': return c.agenda.some(item => item.title.trim().length > 0)
    case 'target': return any(c.audience)
    case 'requirements': return any(c.bring)
    case 'bonuses': return c.bonuses.some(item => item.title.trim().length > 0)
    case 'testimonials': return c.testimonialCount > 0
    case 'faq': return c.faqCount > 0
    case 'disclaimer': return c.disclaimerText.trim().length > 0
    // These always have something to show (dates, host, join note, hero, register bar).
    // 'custom' is judged per entry by the caller.
    default: return true
  }
}