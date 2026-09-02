import type { LandingTheme } from './types'

// OCEAN BREEZE — a crisp, light-blue coastal theme. Perfect for travel,
// wellness, swimming, fitness, and lifestyle creators.
export const oceanBreeze: LandingTheme = {
  id: 'ocean-breeze',
  name: 'Ocean Breeze',
  tagline: 'Fresh and coastal. Great for wellness, fitness, travel, and lifestyle courses.',
  swatch: ['#f0f9ff', '#0284c7', '#38bdf8'],
  fonts: {
    heading: "'Outfit', sans-serif",
    body: "'Inter', sans-serif",
    googleFontsImportUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@600;700;800;900&display=swap",
  },
  colors: {
    bg: '#f0f9ff',
    heroGlowRgba: 'rgba(2,132,199,0.12)',
    ctaGlowRgba: 'rgba(2,132,199,0.08)',
    navBg: 'rgba(240,249,255,0.9)',
    navBorder: 'rgba(2,132,199,0.1)',
    border: 'rgba(2,132,199,0.08)',
    borderSoft: 'rgba(2,132,199,0.12)',
    sectionAltBg: 'rgba(2,132,199,0.03)',
    cardBg: 'rgba(255,255,255,0.7)',
    pillBg: 'rgba(2,132,199,0.06)',
    textPrimary: '#0c1a26',
    textSecondary: '#273e54',
    textMuted: '#4c647c',
    textFaint: '#bcccdc',
    accent: '#0284c7',
    accentSoft: 'rgba(2,132,199,0.08)',
    accentBorder: 'rgba(2,132,199,0.22)',
    accentBorderStrong: 'rgba(2,132,199,0.35)',
    accentText: '#0284c7',
    accentGradient: 'linear-gradient(135deg,#0284c7,#0ea5e9)',
    accentGradientShadow: 'rgba(2,132,199,0.30)',
    numberGhost: 'rgba(2,132,199,0.06)',
    curriculumPanelBg: '#0c1a26',
  },
}
