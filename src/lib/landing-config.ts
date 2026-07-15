export const LANDING_SECTION_TYPES = [
  'hero', 'stats', 'target', 'learn', 'requirements', 'bonuses', 'curriculum',
  'instructor', 'testimonials', 'howItWorks', 'faq', 'refund', 'disclaimer', 'finalCta',
] as const

export type LandingSectionType = (typeof LANDING_SECTION_TYPES)[number]

export type LandingConfig = {
  sections: { type: LandingSectionType; enabled: boolean }[]
  bonuses: { title: string; description: string }[]
  disclaimer: { title: string; text: string }
  urgency: { enabled: boolean; endAt: string; seatsAvailable: number | null; label: string }
}

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  sections: LANDING_SECTION_TYPES.map(type => ({ type, enabled: !['bonuses', 'disclaimer'].includes(type) })),
  bonuses: [],
  disclaimer: { title: 'Important information', text: '' },
  urgency: { enabled: false, endAt: '', seatsAvailable: null, label: 'Enrollment closes in' },
}

/** Makes legacy and partially configured course rows safe to render. */
export function normalizeLandingConfig(value: unknown, legacySections?: Record<string, boolean>): LandingConfig {
  const input = value && typeof value === 'object' ? value as Partial<LandingConfig> : {}
  const configured = Array.isArray(input.sections) ? input.sections : []
  const seen = new Set<string>()
  const sections = configured
    .filter((item): item is { type: LandingSectionType; enabled: boolean } =>
      !!item && LANDING_SECTION_TYPES.includes(item.type as LandingSectionType) && !seen.has(item.type) && (seen.add(item.type), true))
    .map(item => ({ type: item.type, enabled: item.enabled !== false }))

  for (const type of LANDING_SECTION_TYPES) {
    if (!seen.has(type)) sections.push({ type, enabled: legacySections?.[type] !== false && !['bonuses', 'disclaimer'].includes(type) })
  }

  return {
    sections,
    bonuses: Array.isArray(input.bonuses) ? input.bonuses.filter(item => item && typeof item.title === 'string').map(item => ({ title: item.title, description: item.description || '' })) : [],
    disclaimer: { title: input.disclaimer?.title || DEFAULT_LANDING_CONFIG.disclaimer.title, text: input.disclaimer?.text || '' },
    urgency: {
      enabled: input.urgency?.enabled === true,
      endAt: input.urgency?.endAt || '',
      seatsAvailable: typeof input.urgency?.seatsAvailable === 'number' && input.urgency.seatsAvailable >= 0 ? input.urgency.seatsAvailable : null,
      label: input.urgency?.label || DEFAULT_LANDING_CONFIG.urgency.label,
    },
  }
}
