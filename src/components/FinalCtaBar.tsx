'use client'

import { useEffect, useRef, useState } from 'react'
import CoursePageClient from '@/components/CoursePageClient'
import CountdownTimer from '@/components/CountdownTimer'
import type { LandingThemeColors } from '@/lib/landing-themes/types'
import type { FinalCtaCountdown } from '@/lib/landing-config'

/**
 * FinalCtaBar — the "Final CTA" landing-page section.
 *
 * This is the sticky, full-width row pinned to the bottom of the viewport
 * while a visitor scrolls the course landing page, showing either a short
 * nudge message or a live countdown, plus an Enroll button at all times.
 * Gated by the `finalCta` entry in landing-config.ts's `sections` list —
 * same toggle system as every other section, no separate on/off flag. The
 * toggle itself is surfaced in course settings, next to the free-course
 * toggle.
 *
 * Two modes, chosen in course settings (`finalCtaMode`):
 *  - 'text' (default): the creator's message (default: "Enroll to polish
 *    your skills!").
 *  - 'countdown': the closing countdown and/or seats-left counter that used
 *    to be its own "Countdown & Seats" section. The parent passes `countdown`
 *    only when there is something live to show; otherwise this falls back to
 *    the static message. If a live countdown reaches zero while the page is
 *    open, the bar drops back to seats-only / the static message too.
 *
 * Themed using the SAME LandingThemeColors object every other section on
 * this page uses (`navBg`/`navBorder`/`textPrimary`/`textMuted` — the same
 * tokens the page's own sticky top nav uses, plus the accent tokens for the
 * countdown tiles), so it matches whichever of the 12 landing themes the
 * creator picked instead of always being a flat black bar. The Enroll button
 * (via CoursePageClient) uses the theme's accent gradient too, through the
 * brand variables set on the landing page root (see brandVars.ts).
 *
 * Mobile: the message (or the countdown block) and the Enroll button each
 * take their own row below the `sm` breakpoint. In countdown mode the label
 * + seats text sit on the left and the timer tiles on the right of ONE row,
 * and the tiles scale down fluidly with screen width, so the bar stays about
 * as tall as a two-line static message instead of growing.
 *
 * Spacer: the bar is position:fixed, so the page needs empty room at its very
 * bottom or the bar would cover the footer. The bar's height changes with
 * mode, message length and screen width, so it measures itself and publishes
 * the result as the CSS variable `--final-cta-h` on <html>; the landing page's
 * spacer div reads that variable instead of guessing a fixed height.
 *
 * Reuses CoursePageClient's `nav` variant for the actual button so the
 * creator/enrolled/loading/guest states (and the enroll modal itself)
 * stay in exactly one place instead of being reimplemented here.
 */

type FinalCtaColors = Pick<LandingThemeColors, 'navBg' | 'navBorder' | 'textPrimary' | 'textMuted' | 'accentText' | 'accentSoft' | 'accentBorder'>
type FinalCtaCourse = {
    id: string
    name: string
    price: number
    creatorSlug: string
    creatorName: string
    creatorId: string
    telegramBotUsername?: string
    is_free_course?: boolean
    isPublished?: boolean
    moreCoursesSlug?: string
}

export default function FinalCtaBar({
    course,
    text,
    colors,
    countdown = null,
    headingFont,
    buttonText,
}: {
    course: FinalCtaCourse
    text: string
    colors: FinalCtaColors
    countdown?: FinalCtaCountdown | null
    /** The landing theme's heading font stack — used for the label and the
     *  seats number so they match the rest of the page's headings. */
    headingFont?: string
    /** Label for the Enroll button in this bar (the creator's sticky-bar text). */
    buttonText?: string
}) {
    // Flips to true when a live countdown hits zero while the page is open,
    // so the bar never shows a label with no timer next to it.
    const [expired, setExpired] = useState(false)
    const barRef = useRef<HTMLDivElement>(null)

    // Publish this bar's real height so the page's bottom spacer matches it.
    useEffect(() => {
        const el = barRef.current
        if (!el) return
        const root = document.documentElement
        const publish = () => root.style.setProperty('--final-cta-h', `${el.offsetHeight}px`)
        publish()
        const observer = new ResizeObserver(publish)
        observer.observe(el)
        return () => {
            observer.disconnect()
            root.style.removeProperty('--final-cta-h')
        }
    }, [])

    const showTimer = !!countdown?.endAt && !expired
    const showSeats = countdown?.seatsAvailable != null
    const showCountdown = !!countdown && (showTimer || showSeats)

    return (
        <div
            ref={barRef}
            style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 45,
                // Safe-area padding so this never sits under a phone's home
                // indicator/gesture bar on iOS.
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                background: colors.navBg,
                backdropFilter: 'blur(16px)',
                borderTop: `1px solid ${colors.navBorder}`,
            }}>
            <div
                className={`mx-auto flex flex-col sm:flex-row items-center gap-y-3 ${showCountdown ? 'sm:justify-between sm:gap-x-10' : 'justify-center gap-x-10'}`}
                style={{ maxWidth: 1080, padding: showCountdown ? '12px 20px' : '16px 20px' }}>
                {showCountdown && countdown ? (
                    // No label anymore — just the tiles, and the seats-left count next
                    // to them when both are set. Wraps to its own line on narrow phones.
                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 w-full min-w-0 sm:w-auto sm:justify-start">
                        {showTimer && (
                            <CountdownTimer
                                endAt={countdown.endAt}
                                tileBg={colors.accentSoft}
                                tileBorder={colors.accentBorder}
                                numberColor={colors.accentText}
                                labelColor={colors.textMuted}
                                onExpire={() => setExpired(true)} />
                        )}
                        {showSeats && (
                            <p className="flex items-center gap-2" style={{ lineHeight: 1.2 }}>
                                {countdown.seatsAvailable! <= 5 && (
                                    <span className="relative inline-flex h-2.5 w-2.5 flex-shrink-0">
                                        <span
                                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                            style={{ background: colors.accentText }} />
                                        <span
                                            className="relative inline-flex rounded-full h-2.5 w-2.5"
                                            style={{ background: colors.accentText }} />
                                    </span>
                                )}
                                <span
                                    style={{
                                        fontFamily: headingFont,
                                        fontSize: showTimer ? 'clamp(1.15rem, 2.8vw, 1.4rem)' : 'clamp(1.7rem, 5vw, 2.2rem)',
                                        fontWeight: 800,
                                        lineHeight: 1,
                                        color: colors.accentText,
                                    }}>
                                    {countdown.seatsAvailable}
                                </span>
                                <span
                                    style={{
                                        fontSize: showTimer ? 'clamp(0.92rem, 2.3vw, 1.02rem)' : 'clamp(1rem, 2.6vw, 1.2rem)',
                                        fontWeight: showTimer ? 500 : 600,
                                        color: showTimer ? colors.textMuted : colors.textPrimary,
                                    }}>
                                    {countdown.seatsLabel}
                                </span>
                            </p>
                        )}
                    </div>
                ) : (
                    <span
                        className="font-semibold text-center sm:text-left w-full sm:w-auto sm:flex-1 sm:max-w-[620px] min-w-0"
                        style={{
                            fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                            lineHeight: 1.42,
                            color: colors.textPrimary,
                        }}>
                        {text}
                    </span>
                )}

                <div className="w-full sm:w-auto sm:max-w-xs [&>a]:w-full [&>a]:!py-3 [&>a]:!text-base [&>a]:justify-center [&>button]:w-full [&>button]:!py-3 [&>button]:!text-base [&>button]:justify-center [&>div]:w-full">
                    <CoursePageClient course={course} variant="nav" buttonText={buttonText} />
                </div>
            </div>
        </div>
    )
}