// src/components/SocialLinks.tsx
//
// Row of social-media logo buttons, plus the reusable <SocialIcon> (also
// used by the settings editor).
//
// Deliberately NOT themed with the course's accent color — every icon
// always shows its own real platform color (Instagram pink, YouTube red,
// WhatsApp green, etc.), the same on every course regardless of theme.
// The one exception: X and Threads' official color is pure black, which
// disappears on a dark page, so those two swap to the page's own text
// color (near-white on dark themes, near-black on light themes).
//
// Renders NOTHING (no wrapper, no spacing) when there are no links, so a
// creator who hasn't added any never gets an empty gap in the footer.
// Not a client component — works inside the server-rendered landing page.

import type { CSSProperties } from 'react'
import { getSocialPlatform, type SocialLink, type SocialPlatformId } from '@/lib/social-links'

export function SocialIcon({
  platform,
  size = 20,
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
  width: 38px; height: 38px; border-radius: 9999px; flex-shrink: 0;
  color: var(--sl-color); background: transparent;
  transition: background-color .18s ease, transform .18s ease, opacity .18s ease;
}
.sl-chip:hover, .sl-chip:focus-visible {
  background: color-mix(in srgb, var(--sl-color) 12%, transparent);
  transform: translateY(-2px);
}
.sl-chip:focus-visible { outline: 2px solid var(--sl-color); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .sl-chip { transition: none; } .sl-chip:hover, .sl-chip:focus-visible { transform: none; } }
`

export default function SocialLinks({
  links,
  /** The page's own primary text color — only used for X/Threads' black
   *  logo, so it stays visible on dark themes. Not used for anything else. */
  textColor = '#18181b',
  className,
}: {
  links: SocialLink[]
  textColor?: string
  className?: string
}) {
  if (!links || links.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className || ''}`}>
      <style>{CSS}</style>
      {links.map(link => {
        const p = getSocialPlatform(link.platform)
        if (!p) return null
        const color = p.color === '#000000' ? textColor : p.color
        return (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="sl-chip"
            style={{ '--sl-color': color } as CSSProperties}
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