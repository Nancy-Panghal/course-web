// src/components/CourseFallbackTile.tsx
//
// The image area of a course card when the course has no uploaded thumbnail
// and no YouTube promo video: a tile painted in the course's own landing-page
// theme (background, glow, accent, text colour and heading font) with the
// course name written on it.
//
// Fills its parent — put it inside a `relative` box (e.g. `aspect-video`).
// No hooks, so it works from both server pages and client components.

import { getLandingTheme } from '@/lib/landing-themes'
import { getFontPairOverride } from '@/lib/landing-themes/fontPairs'

/** Heading font stack + the Google Fonts URL that provides it, for one
 *  course's theme / font-pair choice. The storefront page uses this to
 *  import each card's font; the tile uses it to set its font-family. */
export function resolveTileFonts(themeId?: string | null, fontPairId?: string | null) {
  const theme = getLandingTheme(themeId)
  const override = getFontPairOverride(fontPairId)
  return {
    heading: override ? override.heading : theme.fonts.heading,
    googleFontsImportUrl: override ? override.googleFontsImportUrl : theme.fonts.googleFontsImportUrl,
  }
}

export default function CourseFallbackTile({
  name,
  themeId,
  fontPairId,
  compact = false,
}: {
  name: string
  themeId?: string | null
  fontPairId?: string | null
  /** Smaller type + padding, for thumbnail-sized previews (dashboard). */
  compact?: boolean
}) {
  const c = getLandingTheme(themeId).colors
  const { heading } = resolveTileFonts(themeId, fontPairId)
  const title = (name || '').trim() || 'Untitled course'

  // Longer names get smaller type so most of the name stays readable; anything
  // beyond three lines is cut off with an ellipsis rather than overflowing.
  const len = title.length
  const size = compact
    ? len <= 24 ? 'text-sm' : 'text-xs'
    : len <= 22 ? 'text-2xl' : len <= 44 ? 'text-xl' : 'text-lg'

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: [
          `radial-gradient(120% 95% at 0% 0%, ${c.heroGlowRgba}, transparent 62%)`,
          `radial-gradient(90% 90% at 100% 100%, ${c.accentSoft}, transparent 65%)`,
          c.bg,
        ].join(', '),
      }}
    >
      {/* Decorative rings, cropped by the corner */}
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{ width: '58%', aspectRatio: '1', right: '-14%', top: '-30%', border: `1px solid ${c.accentBorder}` }}
      />
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{ width: '38%', aspectRatio: '1', right: '-4%', top: '-16%', border: `1px solid ${c.accentBorder}`, opacity: 0.6 }}
      />

      <div className={`relative h-full flex flex-col justify-center ${compact ? 'p-3' : 'p-5 sm:p-6'}`}>
        <span
          aria-hidden
          className="block rounded-full"
          style={{ width: compact ? 22 : 40, height: compact ? 3 : 4, background: c.accentGradient, marginBottom: compact ? 6 : 12 }}
        />
        <p
          className={`${size} font-bold leading-tight line-clamp-3 break-words`}
          style={{ color: c.textPrimary, fontFamily: heading, textWrap: 'balance' }}
        >
          {title}
        </p>
      </div>
    </div>
  )
}