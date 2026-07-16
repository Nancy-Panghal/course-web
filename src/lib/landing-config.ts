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
  'curriculum',
  'instructor',
  'testimonials',
  'howItWorks',
  'faq',
  'refund',
  'disclaimer',
  'finalCta',
] as const

export type LandingSectionType = (typeof LANDING_SECTION_TYPES)[number]

/** One row in the ordered section list a creator configures. */
export type LandingSectionEntry = {
  type: LandingSectionType
  enabled: boolean
}

export type LandingBonusItem = {
  title: string
  description: string
}

export type LandingDisclaimerConfig = {
  title: string
  text: string
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
  urgency:      { label: 'Countdown & Seats',     description: 'Optional urgency banner — closing countdown and/or seats-left counter', icon: 'Timer', category: 'growth' },
  stats:        { label: 'Quick Stats',           description: 'Duration, language and level pills',           icon: 'BarChart3',    category: 'core' },
  target:       { label: 'Who is this for?',      description: 'Target audience bullet list',                  icon: 'Target',       category: 'engagement' },
  learn:        { label: "What you'll learn",     description: 'Learning outcomes checklist',                  icon: 'CheckCircle2', category: 'engagement' },
  requirements: { label: 'Requirements',          description: 'Prerequisites list',                           icon: 'ListChecks',   category: 'engagement' },
  bonuses:      { label: 'Bonuses',                description: 'Extra resources, templates or perks included', icon: 'Gift',         category: 'growth' },
  curriculum:   { label: 'Curriculum',             description: 'Module & lesson accordion',                    icon: 'BookOpen',     category: 'core' },
  instructor:   { label: 'Instructor',             description: 'Photo, title and bio',                         icon: 'UserCircle',   category: 'core' },
  testimonials: { label: 'Testimonials',           description: 'Student reviews and star ratings',             icon: 'Star',         category: 'growth' },
  howItWorks:   { label: 'How it works',           description: 'Enroll → WhatsApp/Telegram → Learn steps',    icon: 'Workflow',     category: 'engagement' },
  faq:          { label: 'FAQ',                    description: 'Frequently asked questions',                   icon: 'HelpCircle',   category: 'engagement' },
  refund:       { label: 'Refund policy',          description: 'Course refund terms',                          icon: 'ShieldCheck',  category: 'compliance' },
  disclaimer:   { label: 'Disclaimer',             description: 'Optional compliance / legal / safety notice — place it wherever it needs to legally sit on the page', icon: 'AlertTriangle', category: 'compliance' },
  finalCta:     { label: 'Final CTA',              description: 'Closing enrollment call-to-action',            icon: 'Zap',          locked: true,  category: 'core' },
}

/** Sections that are hidden by default until a creator opts in — everything
 *  else defaults to visible so existing courses look unchanged. */
const OPT_IN_BY_DEFAULT: LandingSectionType[] = ['bonuses', 'disclaimer', 'urgency']

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  sections: LANDING_SECTION_TYPES.map(type => ({ type, enabled: !OPT_IN_BY_DEFAULT.includes(type) })),
  bonuses: [],
  disclaimer: { title: 'Important information', text: '' },
  urgency: { endAt: '', label: 'Enrollment closes in', seatsAvailable: null, seatsLabel: 'seats left at this price' },
}

/**
 * Makes ANY stored value safe to render, regardless of how partial, stale,
 * or hand-edited it is:
 *  - unknown/garbage input -> falls back to defaults
 *  - missing section types (new sections added after a course was configured,
 *    e.g. 'urgency' didn't exist before this feature) -> appended in default order
 *  - duplicate entries -> first occurrence wins, rest dropped
 *  - unrecognized section types (renamed/removed in a future version) -> dropped
 *  - locked sections (hero/curriculum/finalCta) -> forced enabled, can't be
 *    saved as disabled even by a bad API call or hand-edited row
 *  - legacyFlatSections -> the OLD boolean-map format (`landing_sections`
 *    column), used to seed sensible defaults for courses configured before
 *    this feature existed, so nobody's existing page changes on upgrade
 */
export function normalizeLandingConfig(value: unknown, legacyFlatSections?: Record<string, boolean> | null): LandingConfig {
  const input = value && typeof value === 'object' ? (value as Partial<LandingConfig>) : {}
  const configured = Array.isArray(input.sections) ? input.sections : []
  const seen = new Set<string>()

  const sections: LandingSectionEntry[] = configured
    .filter((item): item is LandingSectionEntry =>
      !!item &&
      typeof item === 'object' &&
      LANDING_SECTION_TYPES.includes(item.type as LandingSectionType) &&
      !seen.has(item.type) &&
      (seen.add(item.type), true))
    .map(item => ({
      type: item.type,
      enabled: LANDING_SECTION_META[item.type].locked ? true : item.enabled !== false,
    }))

  // Append any section type not already present — new feature rollouts and
  // never-before-configured courses land here.
  for (const type of LANDING_SECTION_TYPES) {
    if (seen.has(type)) continue
    const meta = LANDING_SECTION_META[type]
    const legacyValue = legacyFlatSections?.[type]
    const defaultEnabled = meta.locked ? true : legacyValue !== undefined ? legacyValue !== false : !OPT_IN_BY_DEFAULT.includes(type)
    sections.push({ type, enabled: defaultEnabled })
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
  }
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