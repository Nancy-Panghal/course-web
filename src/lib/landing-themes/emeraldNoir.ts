import type { LandingTheme } from './types'

// EMERALD NOIR — a dark, focused alternative for finance/health/productivity
// creators who want something calmer than violet but still premium.
export const emeraldNoir: LandingTheme = {
  id: 'emerald-noir',
  name: 'Emerald Noir',
  tagline: 'Dark and focused, with a calm emerald accent. Great for finance, health, and productivity courses.',
  swatch: ['#0a0f0d', '#10b981', '#6ee7b7'],
  fonts: {
    heading: "'Fraunces', serif",
    body: "'Inter', sans-serif",
    googleFontsImportUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap",
  },
  colors: {
    bg: '#0a0f0d',
    heroGlowRgba: 'rgba(16,185,129,0.18)',
    ctaGlowRgba: 'rgba(16,185,129,0.10)',
    navBg: 'rgba(10,15,13,0.9)',
    navBorder: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.05)',
    borderSoft: 'rgba(255,255,255,0.07)',
    sectionAltBg: 'rgba(255,255,255,0.015)',
    cardBg: 'rgba(255,255,255,0.03)',
    pillBg: 'rgba(255,255,255,0.045)',
    textPrimary: '#ffffff',
    textSecondary: '#a8b3ae',
    textMuted: '#6b7a73',
    textFaint: '#37423d',
    accent: '#10b981',
    accentSoft: 'rgba(16,185,129,0.1)',
    accentBorder: 'rgba(16,185,129,0.25)',
    accentBorderStrong: 'rgba(16,185,129,0.32)',
    accentText: '#6ee7b7',
    accentGradient: 'linear-gradient(135deg,#10b981,#0d9488)',
    accentGradientShadow: 'rgba(16,185,129,0.4)',
    numberGhost: 'rgba(255,255,255,0.045)',
    curriculumPanelBg: '#0a0f0d',
  },
}