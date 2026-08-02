import type { LandingTheme, LandingThemeId } from './types'
import { midnightViolet } from './midnightViolet'
import { emeraldNoir } from './emeraldNoir'
import { sunriseEditorial } from './sunriseEditorial'
import { carbonBlack } from './carbonBlack'
import { cherryBlossom } from './cherryBlossom'
import { oceanBreeze } from './oceanBreeze'
import { orchidBloom } from './orchidBloom'
import { paperWhite } from './paperWhite'
import { sageMeadow } from './sageMeadow'
import { amberForge } from './amberForge'
import { indigoSlate } from './indigoSlate'
import { lagoonTeal } from './lagoonTeal'

export type { LandingTheme, LandingThemeId } from './types'

export const DEFAULT_LANDING_THEME_ID: LandingThemeId = 'midnight-violet'

/** Ordered list — this order is what the theme picker grid renders. */
export const LANDING_THEMES: LandingTheme[] = [
  midnightViolet,
  emeraldNoir,
  sunriseEditorial,
  carbonBlack,
  cherryBlossom,
  oceanBreeze,
  orchidBloom,
  paperWhite,
  sageMeadow,
  amberForge,
  indigoSlate,
  lagoonTeal,
]

const THEME_MAP: Record<LandingThemeId, LandingTheme> = {
  'midnight-violet': midnightViolet,
  'emerald-noir': emeraldNoir,
  'sunrise-editorial': sunriseEditorial,
  'carbon-black': carbonBlack,
  'cherry-blossom': cherryBlossom,
  'ocean-breeze': oceanBreeze,
  'orchid-bloom': orchidBloom,
  'paper-white': paperWhite,
  'sage-meadow': sageMeadow,
  'amber-forge': amberForge,
  'indigo-slate': indigoSlate,
  'lagoon-teal': lagoonTeal,
}

/** Safe lookup — always falls back to the default theme for unknown/blank ids. */
export function getLandingTheme(id?: string | null): LandingTheme {
  if (id && id in THEME_MAP) return THEME_MAP[id as LandingThemeId]
  return THEME_MAP[DEFAULT_LANDING_THEME_ID]
}
