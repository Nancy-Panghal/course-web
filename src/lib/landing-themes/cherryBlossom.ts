import type { LandingTheme } from './types'

// CHERRY BLOSSOM — a soft, warm-pink light theme. Ideal for art, beauty,
// personal development, journaling, and creative courses.
export const cherryBlossom: LandingTheme = {
  id: 'cherry-blossom',
  name: 'Cherry Blossom',
  tagline: 'Soft and warm. Ideal for art, beauty, personal development, and creative courses.',
  swatch: ['#fff1f2', '#e11d48', '#fb7185'],
  fonts: {
    heading: "'DM Serif Display', serif",
    body: "'Inter', sans-serif",
    googleFontsImportUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap",
  },
  colors: {
    bg: '#fff1f2',
    heroGlowRgba: 'rgba(225,29,72,0.10)',
    ctaGlowRgba: 'rgba(225,29,72,0.07)',
    navBg: 'rgba(255,241,242,0.9)',
    navBorder: 'rgba(225,29,72,0.08)',
    border: 'rgba(225,29,72,0.07)',
    borderSoft: 'rgba(225,29,72,0.10)',
    sectionAltBg: 'rgba(225,29,72,0.025)',
    cardBg: 'rgba(255,255,255,0.7)',
    pillBg: 'rgba(225,29,72,0.05)',
    textPrimary: '#1a0810',
    textSecondary: '#482230',
    textMuted: '#7b525e',
    textFaint: '#e0b8c2',
    accent: '#e11d48',
    accentSoft: 'rgba(225,29,72,0.08)',
    accentBorder: 'rgba(225,29,72,0.20)',
    accentBorderStrong: 'rgba(225,29,72,0.32)',
    accentText: '#e11d48',
    accentGradient: 'linear-gradient(135deg,#e11d48,#fb7185)',
    accentGradientShadow: 'rgba(225,29,72,0.30)',
    numberGhost: 'rgba(225,29,72,0.06)',
    curriculumPanelBg: '#1a0810',
  },
}
