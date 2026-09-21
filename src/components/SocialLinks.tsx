// src/components/SocialLinks.tsx
//
// Footer row of social-media logo buttons for the public landing page, plus
// the reusable <SocialIcon> (also used by the settings editor).
//
// Look: every logo sits in a round chip tinted with the course theme's
// accent colors, so ten different brands still read as one cohesive row.
// On hover/focus the chip fills with that platform's official brand color.
//
// Renders NOTHING (no wrapper, no spacing) when there are no links, so a
// creator who hasn't added any never gets an empty gap in the footer.
// Not a client component — works inside the server-rendered landing page.

import type { CSSProperties } from 'react'
import { getSocialPlatform, type SocialLink, type SocialPlatformId } from '@/lib/social-links'
import type { LandingThemeColors } from '@/lib/landing-themes/types'

type SocialColors = Pick<LandingThemeColors, 'accentText' | 'accentSoft' | 'accentBorder'>

export function SocialIcon({
  platform,
  size = 18,
  className,
}: {
  platform: SocialPlatformId
  size?: number
  className?: string
}) {
  const p = getSocialPlatform(platform)
  if (!p) return null
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={p.path} />
    </svg>
  )
}

const CSS = `
.sl-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 9999px; flex-shrink: 0;
  color: var(--sl-fg); background: var(--sl-bg); border: 1px solid var(--sl-border);
  transition: background-color .18s ease, border-color .18s ease, color .18s ease, transform .18s ease;
}
.sl-chip:hover, .sl-chip:focus-visible {
  background: var(--sl-brand); border-color: var(--sl-brand); color: #fff; transform: translateY(-2px);
}
.sl-chip:focus-visible { outline: 2px solid var(--sl-fg); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .sl-chip { transition: none; } .sl-chip:hover, .sl-chip:focus-visible { transform: none; } }
`

export default function SocialLinks({
  links,
  colors,
  className,
}: {
  links: SocialLink[]
  colors: SocialColors
  /** Extra classes for the row wrapper (spacing is set by the caller). */
  className?: string
}) {
  if (!links || links.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2.5 ${className || ''}`}>
      <style>{CSS}</style>
      {links.map(link => {
        const p = getSocialPlatform(link.platform)
        if (!p) return null
        const vars = {
          '--sl-brand': p.color,
          '--sl-bg': colors.accentSoft,
          '--sl-border': colors.accentBorder,
          '--sl-fg': colors.accentText,
        } as CSSProperties
        return (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="sl-chip"
            style={vars}
            aria-label={`${p.label} (opens in a new tab)`}
            title={p.label}
          >
            <SocialIcon platform={link.platform} />
          </a>
        )
      })}
    </div>
  )
}