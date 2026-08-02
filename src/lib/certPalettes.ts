export type CertPalette = {
  id: string
  label: string
  accent: string
  accentDark: string
  accentLight: string
  background: string
  surface: string
  textPrimary: string
  textMuted: string
  textSecondary: string
  textLight: string
  divider: string
}

export const CERT_PALETTES: CertPalette[] = [
  { id: 'classic-gold', label: 'Classic Gold', accent: '#c9a227', accentDark: '#8b6914', accentLight: '#f0d060', background: '#ffffff', surface: '#ffffff', textPrimary: '#1a2744', textMuted: '#555555', textSecondary: '#777777', textLight: '#ffffff', divider: '#cccccc' },
  { id: 'emerald-prestige', label: 'Emerald Prestige', accent: '#145c3f', accentDark: '#0d402b', accentLight: '#86c5a6', background: '#fffdf6', surface: '#ffffff', textPrimary: '#123d2b', textMuted: '#52685d', textSecondary: '#718176', textLight: '#fffdf6', divider: '#d7dfd5' },
  { id: 'slate-monochrome', label: 'Slate Monochrome', accent: '#2b2b2e', accentDark: '#4b4b50', accentLight: '#d4d4d8', background: '#ffffff', surface: '#ffffff', textPrimary: '#2b2b2e', textMuted: '#5f6368', textSecondary: '#7b8087', textLight: '#ffffff', divider: '#d1d5db' },
  { id: 'bronze-heritage', label: 'Bronze Heritage', accent: '#8b5a2b', accentDark: '#5d371b', accentLight: '#d9ae7a', background: '#fff8ec', surface: '#ffffff', textPrimary: '#3e281b', textMuted: '#6e5745', textSecondary: '#88715f', textLight: '#fffaf2', divider: '#dfd0bc' },
  { id: 'deep-burgundy', label: 'Deep Burgundy', accent: '#6b1f3a', accentDark: '#451225', accentLight: '#d7a7b6', background: '#fffaf4', surface: '#ffffff', textPrimary: '#4b1730', textMuted: '#70555f', textSecondary: '#8b6d77', textLight: '#fffaf4', divider: '#e5d4d8' },
  { id: 'teal-executive', label: 'Teal Executive', accent: '#0f4c4c', accentDark: '#083536', accentLight: '#78bcbc', background: '#ffffff', surface: '#ffffff', textPrimary: '#173536', textMuted: '#52696a', textSecondary: '#708485', textLight: '#ffffff', divider: '#d1dddd' },
  { id: 'platinum-minimal', label: 'Platinum Minimal', accent: '#8a94a6', accentDark: '#626b78', accentLight: '#c5cedc', background: '#ffffff', surface: '#ffffff', textPrimary: '#3f3f46', textMuted: '#6b7280', textSecondary: '#8a94a6', textLight: '#ffffff', divider: '#e5e7eb' },
]

export const DEFAULT_CERT_PALETTE_ID = 'classic-gold'

export function getCertPalette(id?: string | null): CertPalette {
  return CERT_PALETTES.find(palette => palette.id === id) ?? CERT_PALETTES[0]
}

/** Layout owns the page treatment; palettes only recolor the content within it. */
export function getCertLayoutPalette(template: string, id?: string | null): CertPalette {
  const palette = getCertPalette(id)
  const darkLayout = template === 'modern' || template === 'royal'
  const layoutBackground = template === 'modern' ? '#0f0f1a'
    : template === 'royal' ? '#060d2e'
      : template === 'gold' ? '#fdf8ed'
        : '#ffffff'

  return {
    ...palette,
    background: layoutBackground,
    surface: '#ffffff',
    textPrimary: darkLayout ? palette.textLight : palette.textPrimary,
    textMuted: darkLayout ? palette.accentLight : palette.textMuted,
    textSecondary: darkLayout ? palette.textLight : palette.textSecondary,
    divider: darkLayout ? palette.accentDark : palette.divider,
  }
}
