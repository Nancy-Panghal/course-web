import type { LandingTheme } from './types'

// MIDNIGHT VIOLET — the original AcademyKit/Kurso design.
// This is the default theme. Every color value here is copied 1:1 from the
// previous hardcoded about-course page, so existing published courses look
// pixel-identical after the theme system ships.
export const midnightViolet: LandingTheme = {
  id: 'midnight-violet',
  name: 'Midnight Violet',
  tagline: 'Dark, premium, SaaS-native. Our original signature look.',
  swatch: ['#080808', '#7c3aed', '#a78bfa'],
  fonts: {
    heading: "'Playfair Display', serif",
    body: "'DM Sans', sans-serif",
    googleFontsImportUrl:
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700;800;900&display=swap",
  },
  colors: {
    bg: '#080808',
    heroGlowRgba: 'rgba(124,58,237,0.2)',
    ctaGlowRgba: 'rgba(124,58,237,0.11)',
    navBg: 'rgba(8,8,8,0.9)',
    navBorder: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.05)',
    borderSoft: 'rgba(255,255,255,0.07)',
    sectionAltBg: 'rgba(255,255,255,0.01)',
    cardBg: 'rgba(255,255,255,0.025)',
    pillBg: 'rgba(255,255,255,0.04)',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#3f3f46',
    accent: '#7c3aed',
    accentSoft: 'rgba(124,58,237,0.1)',
    accentBorder: 'rgba(124,58,237,0.25)',
    accentBorderStrong: 'rgba(124,58,237,0.3)',
    accentText: '#a78bfa',
    accentGradient: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
    accentGradientShadow: 'rgba(124,58,237,0.4)',
    numberGhost: 'rgba(255,255,255,0.04)',
    curriculumPanelBg: '#080808',
  },
}