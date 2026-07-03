/**
 * Font pair overrides for the landing page design tab.
 * When a creator picks a font pair, it replaces the theme's default heading
 * font while keeping body text on Inter for readability.
 */

export type FontPairId =
  | 'theme-default'
  | 'playfair-dm'
  | 'fraunces-inter'
  | 'space-inter'
  | 'outfit-inter'
  | 'dm-inter'

export interface FontPairOverride {
  heading: string
  body: string
  googleFontsImportUrl: string
}

const FONT_PAIR_MAP: Record<Exclude<FontPairId, 'theme-default'>, FontPairOverride> = {
  'playfair-dm': {
    heading: "'Playfair Display', serif",
    body: "'DM Sans', sans-serif",
    googleFontsImportUrl:
      'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700;800;900&display=swap',
  },
  'fraunces-inter': {
    heading: "'Fraunces', serif",
    body: "'Inter', sans-serif",
    googleFontsImportUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap',
  },
  'space-inter': {
    heading: "'Space Grotesk', sans-serif",
    body: "'Inter', sans-serif",
    googleFontsImportUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700;800&display=swap',
  },
  'outfit-inter': {
    heading: "'Outfit', sans-serif",
    body: "'Inter', sans-serif",
    googleFontsImportUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@600;700;800;900&display=swap',
  },
  'dm-inter': {
    heading: "'DM Serif Display', serif",
    body: "'Inter', sans-serif",
    googleFontsImportUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap',
  },
}

/**
 * Returns the font override for a given font pair ID.
 * Returns null when 'theme-default' is selected (meaning use the theme's own fonts).
 */
export function getFontPairOverride(id?: string | null): FontPairOverride | null {
  if (!id || id === 'theme-default') return null
  return FONT_PAIR_MAP[id as Exclude<FontPairId, 'theme-default'>] ?? null
}
