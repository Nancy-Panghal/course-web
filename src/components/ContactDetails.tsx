// src/components/ContactDetails.tsx
//
// Renders a creator's contact entries on the public landing page, in one of
// two places:
//   variant="block"  — icon cards below the course description
//   variant="footer" — a vertical list inside the footer's "Contact" column
//
// When two phones (or two emails) share the exact same custom message, they
// are grouped into one visual unit: the message is shown once, with both
// numbers/addresses listed under it — instead of repeating the message.
//
// Renders NOTHING (no wrapper, no spacing) when `entries` is empty, so a
// creator with nothing configured never gets a stray empty container.
// Not a client component — it works inside the server-rendered landing page.

import { Phone, Mail } from 'lucide-react'
import { contactHref, groupContactDetails, type ContactDetail } from '@/lib/contact-details'
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
  const groups = groupContactDetails(entries)

   if (variant === 'footer') {
    return (
      <div className="flex flex-col gap-3.5">
        {groups.map((group, gi) => {
          const Icon = group.type === 'phone' ? Phone : Mail
          return (
            <div
              key={gi}
              className="flex items-start gap-2.5 text-left"
              style={{ fontSize: '0.88rem', lineHeight: 1.6 }}
            >
              <span
                className="flex flex-shrink-0 items-center justify-center rounded-full"
                style={{ width: 22, height: 22, marginTop: '0.05rem', background: colors.accentSoft }}
              >
                <Icon aria-hidden style={{ width: 12, height: 12, color: colors.accentText }} />
              </span>
              <span className="flex flex-col gap-0.5" style={{ overflowWrap: 'anywhere' }}>
                {group.message && (
                  <span style={{ color: mutedColor || colors.textMuted }}>{group.message}</span>
                )}
                {group.entries.map((entry, i) => (
                  <a
                    key={i}
                    href={contactHref(entry)}
                    className="ak-footer-link"
                    style={{ color: colors.textSecondary, fontWeight: 600 }}
                  >
                    <ValueText entry={entry} />
                  </a>
                ))}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`mt-2 mb-2 flex w-full max-w-[720px] flex-wrap justify-center gap-3 ${className || ''}`}>
      {groups.map((group, gi) => {
        const Icon = group.type === 'phone' ? Phone : Mail
        const iconChip = (
          <span
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: colors.accentSoft, border: `1px solid ${colors.accentBorder}` }}
          >
            <Icon aria-hidden style={{ width: 18, height: 18, color: colors.accentText }} />
          </span>
        )
        const messageNode = group.message && (
          <span
            style={{
              fontFamily: headingFont,
              fontSize: '0.95rem',
              fontWeight: 700,
              lineHeight: 1.3,
              color: colors.textPrimary,
              overflowWrap: 'anywhere',
            }}
          >
            {group.message}
          </span>
        )

        // Single entry (the common case): the whole card is one link, exactly as before.
        if (group.entries.length === 1) {
          const entry = group.entries[0]
          return (
            <a
              key={gi}
              href={contactHref(entry)}
              className="flex w-full min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-opacity hover:opacity-90 sm:w-[calc(50%_-_6px)]"
              style={{ background: colors.pillBg, border: `1px solid ${colors.borderSoft}` }}
            >
              {iconChip}
              <span className="flex min-w-0 flex-col">
                {messageNode}
                <span
                  style={{
                    fontSize: '0.9rem',
                    lineHeight: 1.4,
                    fontWeight: group.message ? 500 : 600,
                    color: colors.accentText,
                    overflowWrap: 'anywhere',
                  }}
                >
                  <ValueText entry={entry} />
                </span>
              </span>
            </a>
          )
        }

        // Two entries sharing one message: one card, message shown once, each
        // number/address is its own tap target underneath it.
        return (
          <div
            key={gi}
            className="flex w-full min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left sm:w-[calc(50%_-_6px)]"
            style={{ background: colors.pillBg, border: `1px solid ${colors.borderSoft}` }}
          >
            {iconChip}
            <span className="flex min-w-0 flex-col gap-0.5">
              {messageNode}
              <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                {group.entries.map((entry, i) => (
                  <a
                    key={i}
                    href={contactHref(entry)}
                    className="transition-opacity hover:opacity-80"
                    style={{
                      fontSize: '0.9rem',
                      lineHeight: 1.4,
                      fontWeight: group.message ? 500 : 600,
                      color: colors.accentText,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <ValueText entry={entry} />
                  </a>
                ))}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}