// src/components/ContactDetails.tsx
//
// Renders a creator's contact entries on the public landing page, in one of
// two places:
//   variant="block"  — icon cards below the course description
//   variant="footer" — inline items that sit in the footer link row
//
// Renders NOTHING (no wrapper, no spacing) when `entries` is empty, so a
// creator with nothing configured never gets a stray empty container.
// Not a client component — it works inside the server-rendered landing page.

import { Phone, Mail } from 'lucide-react'
import { contactHref, type ContactDetail } from '@/lib/contact-details'
import type { LandingThemeColors } from '@/lib/landing-themes/types'

type ContactColors = Pick<
  LandingThemeColors,
  'accentText' | 'accentSoft' | 'accentBorder' | 'textPrimary' | 'textSecondary' | 'textMuted' | 'pillBg' | 'borderSoft'
>

// Lets a long email break at the "@" (instead of mid-word) on narrow screens.
function ValueText({ entry }: { entry: ContactDetail }) {
  if (entry.type === 'email') {
    const at = entry.value.indexOf('@')
    if (at > 0) {
      return (
        <>
          {entry.value.slice(0, at)}
          <wbr />
          {entry.value.slice(at)}
        </>
      )
    }
  }
  return <>{entry.value}</>
}

export default function ContactDetails({
  entries,
  variant,
  colors,
  headingFont,
  mutedColor,
  className,
}: {
  entries: ContactDetail[]
  variant: 'block' | 'footer'
  colors: ContactColors
  /** Course's heading font stack — used for the message text in the block. */
  headingFont: string
  /** Footer only: the muted text color the other footer links use. */
  mutedColor?: string
  /** Block only: extra classes for the wrapper (e.g. the hero's fade-in). */
  className?: string
}) {
  if (!entries || entries.length === 0) return null

  if (variant === 'footer') {
    return (
      <>
        {entries.map((entry, i) => {
          const Icon = entry.type === 'phone' ? Phone : Mail
          return (
            <a
              key={`${entry.type}-${i}`}
              href={contactHref(entry)}
              className="inline-flex max-w-full items-start gap-2 text-left"
              style={{ fontSize: '0.88rem', lineHeight: 1.5 }}
            >
              <Icon
                className="flex-shrink-0"
                aria-hidden
                style={{ width: 14, height: 14, marginTop: '0.22rem', color: colors.accentText }}
              />
              <span style={{ overflowWrap: 'anywhere' }}>
                {entry.message && (
                  <span style={{ color: mutedColor || colors.textMuted }}>{entry.message} · </span>
                )}
                <span style={{ color: colors.textSecondary, fontWeight: 600 }}>
                  <ValueText entry={entry} />
                </span>
              </span>
            </a>
          )
        })}
      </>
    )
  }

  return (
    <div className={`mt-2 mb-2 flex w-full max-w-[720px] flex-wrap justify-center gap-3 ${className || ''}`}>
      {entries.map((entry, i) => {
        const Icon = entry.type === 'phone' ? Phone : Mail
        return (
          <a
            key={`${entry.type}-${i}`}
            href={contactHref(entry)}
            className="flex w-full min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-opacity hover:opacity-90 sm:w-[calc(50%_-_6px)]"
            style={{ background: colors.pillBg, border: `1px solid ${colors.borderSoft}` }}
          >
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: colors.accentSoft, border: `1px solid ${colors.accentBorder}` }}
            >
              <Icon aria-hidden style={{ width: 18, height: 18, color: colors.accentText }} />
            </span>
            <span className="flex min-w-0 flex-col">
              {entry.message && (
                <span
                  style={{
                    fontFamily: headingFont,
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    lineHeight: 1.25,
                    color: colors.textPrimary,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {entry.message}
                </span>
              )}
              <span
                style={{
                  fontSize: '0.9rem',
                  lineHeight: 1.4,
                  fontWeight: entry.message ? 500 : 600,
                  color: colors.accentText,
                  overflowWrap: 'anywhere',
                }}
              >
                <ValueText entry={entry} />
              </span>
            </span>
          </a>
        )
      })}
    </div>
  )
}