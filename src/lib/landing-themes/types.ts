// Shared type definitions for the landing page (about-course) theme system.
// Every theme file in this folder exports one object matching this shape.

export type LandingThemeId = 'midnight-violet' | 'emerald-noir' | 'sunrise-editorial'

export interface LandingThemeColors {
  /** Page background (solid hex) */
  bg: string
  /** rgba used for the soft glow behind the hero title */
  heroGlowRgba: string
  /** rgba used for the soft glow behind the final CTA section */
  ctaGlowRgba: string
  /** Sticky nav background */
  navBg: string
  /** Sticky nav bottom border */
  navBorder: string
  /** Generic hairline border used between sections */
  border: string
  /** Slightly stronger border used on cards */
  borderSoft: string
  /** Background used for "alternate" sections (FAQ, learn-list, how-it-works) */
  sectionAltBg: string
  /** Background used for stat / info cards */
  cardBg: string
  /** Background used for small pill badges (meta row) */
  pillBg: string
  /** Headline / high-emphasis text */
  textPrimary: string
  /** Body copy */
  textSecondary: string
  /** De-emphasized text (captions, helper text) */
  textMuted: string
  /** Lowest-emphasis text (fine print, strikethrough price) */
  textFaint: string
  /** Solid accent color (brand color of this theme) */
  accent: string
  /** Soft accent background (badges) */
  accentSoft: string
  /** Accent border (badges) */
  accentBorder: string
  /** Stronger accent border (hover states) */
  accentBorderStrong: string
  /** Accent used as text color (on dark or light backgrounds) */
  accentText: string
  /** Gradient used for logo / icon badges */
  accentGradient: string
  /** Shadow color cast by accentGradient badges */
  accentGradientShadow: string
  /** Faint "ghost" numerals in the How It Works section */
  numberGhost: string
  /** Background of the dark curriculum/syllabus panel — intentionally
   *  stays dark across every theme (including light ones) so it reads like
   *  a syllabus/app screenshot, and so CurriculumAccordion.tsx never needs
   *  per-theme color props. */
  curriculumPanelBg: string
}

export interface LandingThemeFonts {
  /** CSS font-family stack for headings, e.g. "'Playfair Display', serif" */
  heading: string
  /** CSS font-family stack for body copy, e.g. "'DM Sans', sans-serif" */
  body: string
  /** Google Fonts @import URL pulling in both families */
  googleFontsImportUrl: string
}

export interface LandingTheme {
  id: LandingThemeId
  /** Display name shown to creators in the theme picker */
  name: string
  /** One-line description shown under the name in the theme picker */
  tagline: string
  /** 3 hex colors used to render a small preview swatch in the picker UI */
  swatch: [string, string, string]
  fonts: LandingThemeFonts
  colors: LandingThemeColors
}