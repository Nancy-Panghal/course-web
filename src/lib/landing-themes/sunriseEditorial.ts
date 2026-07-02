import type { LandingTheme } from './types'

// SUNRISE EDITORIAL — a warm, light theme for creators who don't want an
// all-dark page (e.g. lifestyle, design, writing courses). The curriculum
// panel intentionally stays dark for contrast — see curriculumPanelBg.
export const sunriseEditorial: LandingTheme = {
  id: 'sunrise-editorial',
  name: 'Sunrise Editorial',
  tagline: 'Warm and light, like a editorial magazine spread. Stands out from typical dark SaaS pages.',
  swatch: ['#fbf6ee', '#c2410c', '#ea580c'],
  fonts: {
    heading: "'Lora', serif",
    body: "'Inter', sans-serif",
    googleFontsImportUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Lora:wght@600;700;800&display=swap",
  },
  colors: {
    bg: '#fbf6ee',
    heroGlowRgba: 'rgba(217,119,6,0.14)',
    ctaGlowRgba: 'rgba(217,119,6,0.10)',
    navBg: 'rgba(251,246,238,0.88)',
    navBorder: 'rgba(28,25,23,0.08)',
    border: 'rgba(28,25,23,0.07)',
    borderSoft: 'rgba(28,25,23,0.1)',
    sectionAltBg: 'rgba(28,25,23,0.025)',
    cardBg: 'rgba(255,255,255,0.65)',
    pillBg: 'rgba(28,25,23,0.045)',
    textPrimary: '#1c1917',
    textSecondary: '#57534e',
    textMuted: '#78716c',
    textFaint: '#a8a29e',
    accent: '#c2410c',
    accentSoft: 'rgba(194,65,12,0.08)',
    accentBorder: 'rgba(194,65,12,0.22)',
    accentBorderStrong: 'rgba(194,65,12,0.32)',
    accentText: '#c2410c',
    accentGradient: 'linear-gradient(135deg,#ea580c,#c2410c)',
    accentGradientShadow: 'rgba(194,65,12,0.35)',
    numberGhost: 'rgba(28,25,23,0.06)',
    curriculumPanelBg: '#16130f',
  },
}