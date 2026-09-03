import CoursePageClient from '@/components/CoursePageClient'
import type { LandingThemeColors } from '@/lib/landing-themes/types'

/**
 * FinalCtaBar — the "Final CTA" landing-page section.
 *
 * This is the sticky, full-width row pinned to the bottom of the viewport
 * while a visitor scrolls the course landing page, showing a short nudge
 * message plus the price and an Enroll button at all times. Gated by the
 * `finalCta` entry in landing-config.ts's `sections` list — same toggle
 * system as every other section, no separate on/off flag. The toggle
 * itself is surfaced in course settings, next to the free-course toggle,
 * along with an editable message field (default: "Enroll to polish your
 * skills!").
 *
 * Themed using the SAME LandingThemeColors object every other section on
 * this page uses (`navBg`/`navBorder`/`textPrimary`/`textMuted` — the same
 * tokens the page's own sticky top nav uses), so it matches whichever of
 * the 12 landing themes the creator picked instead of always being a flat
 * black bar. The Enroll button itself intentionally stays Kurso's brand
 * orange gradient (via CoursePageClient) regardless of theme, matching
 * every other Enroll button on this page.
 *
 * Mobile: the message and the price+button group each wrap independently
 * (flex-wrap on the outer row) so on narrow screens the message drops to
 * its own line above price+button, rather than truncating or overflowing.
 * Neither price nor the button ever wrap away from each other.
 *
 * Reuses CoursePageClient's `nav` variant for the actual button so the
 * creator/enrolled/loading/guest states (and the enroll modal itself)
 * stay in exactly one place instead of being reimplemented here.
 */

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
}

export default function FinalCtaBar({
    course,
    text,
    colors,
}: {
    course: FinalCtaCourse
    text: string
    colors: Pick<LandingThemeColors, 'navBg' | 'navBorder' | 'textPrimary' | 'textMuted'>
}) {
    return (
        <div
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
            }}
        >
                        <div
                className="mx-auto flex flex-col sm:flex-row items-center justify-center gap-x-10 gap-y-3"
                style={{ maxWidth: 1080, padding: '16px 20px' }}
            >
                                <span
                    className="font-semibold text-center sm:text-left w-full sm:w-auto sm:flex-1 sm:max-w-[620px] min-w-0"
                    style={{
                        fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                        lineHeight: 1.42,
                        color: colors.textPrimary,
                    }}
                >
                    {text}
                </span>

                                <div className="w-full sm:w-auto sm:max-w-xs [&>a]:w-full [&>a]:!py-3 [&>a]:!text-base [&>a]:justify-center [&>button]:w-full [&>button]:!py-3 [&>button]:!text-base [&>button]:justify-center [&>div]:w-full">
                    <CoursePageClient course={course} variant="nav" />
                </div>
            </div>
        </div>
    )
}