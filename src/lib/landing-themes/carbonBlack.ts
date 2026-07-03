import type { LandingTheme } from './types'

// CARBON BLACK — an ultra-minimal, high-contrast monochrome theme.
// Perfect for tech, coding, business, and professional development courses.
export const carbonBlack: LandingTheme = {
  id: 'carbon-black',
  name: 'Carbon Black',
  tagline: 'Ultra-minimal monochrome. Perfect for tech, coding, and business courses.',
  swatch: ['#0a0a0a', '#e5e5e5', '#ffffff'],
  fonts: {
    heading: "'Space Grotesk', sans-serif",
    body: "'Inter', sans-serif",
    googleFontsImportUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700;800&display=swap",
  },
  colors: {
    bg: '#0a0a0a',
    heroGlowRgba: 'rgba(255,255,255,0.04)',
    ctaGlowRgba: 'rgba(255,255,255,0.03)',
    navBg: 'rgba(10,10,10,0.95)',
    navBorder: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.06)',
    borderSoft: 'rgba(255,255,255,0.09)',
    sectionAltBg: 'rgba(255,255,255,0.02)',
    cardBg: 'rgba(255,255,255,0.04)',
    pillBg: 'rgba(255,255,255,0.06)',
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#737373',
    textFaint: '#404040',
    accent: '#e5e5e5',
    accentSoft: 'rgba(229,229,229,0.08)',
    accentBorder: 'rgba(229,229,229,0.18)',
    accentBorderStrong: 'rgba(229,229,229,0.28)',
    accentText: '#e5e5e5',
    accentGradient: 'linear-gradient(135deg,#e5e5e5,#ffffff)',
    accentGradientShadow: 'rgba(255,255,255,0.15)',
    numberGhost: 'rgba(255,255,255,0.04)',
    curriculumPanelBg: '#0a0a0a',
  },
}
