import type { LandingTheme, LandingThemeId } from './types'
import { midnightViolet } from './midnightViolet'
import { emeraldNoir } from './emeraldNoir'
import { sunriseEditorial } from './sunriseEditorial'

export type { LandingTheme, LandingThemeId } from './types'

export const DEFAULT_LANDING_THEME_ID: LandingThemeId = 'midnight-violet'

/** Ordered list — this order is what the theme picker grid renders. */
export const LANDING_THEMES: LandingTheme[] = [midnightViolet, emeraldNoir, sunriseEditorial]

const THEME_MAP: Record<LandingThemeId, LandingTheme> = {
  'midnight-violet': midnightViolet,
  'emerald-noir': emeraldNoir,
  'sunrise-editorial': sunriseEditorial,
}

/** Safe lookup — always falls back to the default theme for unknown/blank ids. */
export function getLandingTheme(id?: string | null): LandingTheme {
  if (id && id in THEME_MAP) return THEME_MAP[id as LandingThemeId]
  return THEME_MAP[DEFAULT_LANDING_THEME_ID]
}