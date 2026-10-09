'use client'
// src/components/workshop-page/WorkshopRegisterBar.tsx
//
// The sticky register bar (the "finalCta" section): a short message, an
// optional live countdown and seats-left count, and a button that scrolls to
// the register card. Only rendered while registration is open.

import CountdownTimer from '@/components/CountdownTimer'
import type { LandingThemeColors } from '@/lib/landing-themes/types'

type BarColors = Pick<LandingThemeColors, 'navBg' | 'navBorder' | 'textPrimary' | 'accentText' | 'accentSoft' | 'accentBorder'>

export default function WorkshopRegisterBar({ message, buttonText, countdownEndAt, seatsLeft, colors }: {
  message: string
  buttonText: string
  /** ISO start time, or null to hide the countdown. */
  countdownEndAt: string | null
  /** null = no seat limit (or hidden). */
  seatsLeft: number | null
  colors: BarColors
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3"
      style={{ background: colors.navBg, borderTop: `1px solid ${colors.navBorder}`, backdropFilter: 'blur(12px)' }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold" style={{ color: colors.textPrimary }}>{message}</p>
          {seatsLeft != null && (
            <p className="text-[13px] font-medium" style={{ color: 'var(--ws-muted)' }}>
              {seatsLeft === 0 ? 'Fully booked' : `Only ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left`}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4">
          {countdownEndAt && (
            <CountdownTimer endAt={countdownEndAt} tileBg={colors.accentSoft} tileBorder={colors.accentBorder}
              numberColor={colors.accentText} labelColor="var(--ws-muted)" />
          )}
          <a href="#register" className="shrink-0 px-6 py-3 rounded-xl text-[15px] font-semibold text-white violet-gradient hover:opacity-90">
            {buttonText}
          </a>
        </div>
      </div>
    </div>
  )
}