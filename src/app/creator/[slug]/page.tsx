// src/app/creator/[slug]/page.tsx
//
// Public creator storefront ("All Courses") — lists every published course
// by one creator.
//
// Theming: this page has no theme of its own. It borrows the landing theme
// + font pair of ONE of the creator's courses so it reads as part of the
// same branded site:
//   1. the course the visitor came from, when the link carries `?from=<courseId>`
//      (the "More Courses" links on the course landing page and enroll modal do)
//   2. otherwise the creator's newest published course
//   3. otherwise the default theme (creator has no courses yet)
// Same pattern as src/app/contact/[courseId]/page.tsx and the policy pages.
//
// Card images, in order: the thumbnail the creator uploaded in Dashboard →
// Settings → Public Profile (`cover_image_url`), else the YouTube thumbnail of
// the course's first promo video, else a generated tile painted in that
// course's own landing theme with the course name on it.
//
// Courses the creator switched off ("Show on courses page") are left out of
// the list; they stay live and reachable by their own link.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ArrowRight, ArrowLeft, Shield, Play } from 'lucide-react'
import type { Metadata } from 'next'
import { getLandingTheme } from '@/lib/landing-themes'
import { getFontPairOverride } from '@/lib/landing-themes/fontPairs'
import { getCourseCardImage } from '@/lib/landing-config'
import CourseFallbackTile, { resolveTileFonts } from '@/components/CourseFallbackTile'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COURSE_FIELDS =
  'id, name, slug, description, price, original_price, is_free_course, host_name, brand_name, brand_logo_url, landing_theme, landing_font_pair, promo_video_urls, promo_video_url, cover_image_url, hide_from_storefront'

// `?from=` is user-controlled — only let something id-shaped reach a query.
const ID_SHAPE = /^[A-Za-z0-9-]{8,64}$/

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  const { data: creator } = await supabase
    .from('creators')
    .select('name, creator_bio, creator_photo_url')
    .eq('creator_slug', slug)
    .maybeSingle()

  if (!creator) {
    return { title: 'Creator not found' }
  }

  const title = `${creator.name} on Kurso`
  const description = creator.creator_bio
    ? creator.creator_bio.replace(/\s+/g, ' ').trim().slice(0, 155)
    : `Courses by ${creator.name}, delivered through WhatsApp and Telegram.`
  const image = creator.creator_photo_url || '/icon.jpg'

  return {
    title,
    description,
    // `?from=<courseId>` only changes the theme, not the content — point
    // search engines at the one clean URL.
    alternates: { canonical: `/creator/${slug}` },
    openGraph: { type: 'profile', title, description, images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function CreatorStorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const { from } = await searchParams
  const fromId = typeof from === 'string' && ID_SHAPE.test(from) ? from : null

  const { data: creator } = await supabase
    .from('creators')
    .select('id, name, creator_slug')
    .eq('creator_slug', slug)
    .maybeSingle()

  if (!creator) notFound()

  const { data: publishedCourses } = await supabase
    .from('courses')
    .select(COURSE_FIELDS)
    .eq('creator_id', creator.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // What gets LISTED — hidden courses are filtered out here, but they stay
  // in `publishedCourses` so `?from=<hidden course>` can still lend its theme.
  const courses = (publishedCourses || []).filter((co: any) => co.hide_from_storefront !== true)

  // Which course lends its theme. A creator previewing a draft course can
  // arrive with a `from` that isn't in the published list, so fall back to
  // a direct lookup — always scoped to THIS creator so `?from=` can't be
  // used to read another creator's course.
  let sourceCourse: any = fromId ? (publishedCourses || []).find((co: any) => co.id === fromId) || null : null
  if (fromId && !sourceCourse) {
    const { data } = await supabase
      .from('courses')
      .select(COURSE_FIELDS)
      .eq('id', fromId)
      .eq('creator_id', creator.id)
      .maybeSingle()
    sourceCourse = data || null
  }
  const themeCourse = sourceCourse || courses[0] || publishedCourses?.[0] || null

  const theme = getLandingTheme(themeCourse?.landing_theme)
  const c = theme.colors
  const fontOverride = getFontPairOverride(themeCourse?.landing_font_pair)
  const fonts = fontOverride
    ? { heading: fontOverride.heading, body: fontOverride.body, googleFontsImportUrl: fontOverride.googleFontsImportUrl }
    : theme.fonts

  const displayName = creator.name || courses?.[0]?.host_name || 'Instructor'
  const brandName = themeCourse?.brand_name || themeCourse?.host_name || displayName
  const brandLogo = themeCourse?.brand_logo_url || ''

  const backHref = sourceCourse
    ? `/about-course/${creator.creator_slug}/${slugify(sourceCourse.slug || sourceCourse.name)}/${sourceCourse.id}`
    : null

  const courseCount = courses.length

  // Each generated tile is painted in ITS course's theme, so besides the page's
  // own fonts we import the heading font of every card that needs a tile.
  const fontImportUrls = Array.from(new Set([
    fonts.googleFontsImportUrl,
    ...courses
      .filter((co: any) => !getCourseCardImage(co))
      .map((co: any) => resolveTileFonts(co.landing_theme, co.landing_font_pair).googleFontsImportUrl),
  ]))

  return (
    <div className="min-h-screen" style={{ background: c.bg, color: c.textPrimary, fontFamily: fonts.body }}>
      <style>{`
        ${fontImportUrls.map(url => `@import url('${url}');`).join('\n        ')}
        .sf-heading { font-family: ${fonts.heading}; }
        .sf-card {
          background: ${c.cardBg};
          border: 1px solid ${c.borderSoft};
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .sf-card:hover {
          transform: translateY(-3px);
          border-color: ${c.accentBorderStrong};
          box-shadow: 0 14px 34px -14px ${c.accentGradientShadow};
        }
        .sf-card:focus-visible { outline: 2px solid ${c.accent}; outline-offset: 3px; }
        .sf-arrow { transition: transform 0.2s ease; }
        .sf-card:hover .sf-arrow { transform: translateX(4px); }
        .sf-media { transition: transform 0.5s ease; }
        .sf-card:hover .sf-media { transform: scale(1.04); }
        @media (prefers-reduced-motion: reduce) {
          .sf-card, .sf-arrow, .sf-media { transition: none; }
          .sf-card:hover { transform: none; }
          .sf-card:hover .sf-arrow, .sf-card:hover .sf-media { transform: none; }
        }
      `}</style>

      {/* Nav — brand on the left, way back to the course on the right */}
      <nav
        className="sticky top-0 z-50 px-4 sm:px-6 py-4 flex items-center justify-between gap-3"
        style={{ background: c.navBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${c.navBorder}` }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {brandLogo ? (
            <img src={brandLogo} alt={brandName} className="h-7 max-w-[140px] object-contain flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: c.accentGradient }}>
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <span className="text-sm font-bold tracking-tight truncate hidden min-[400px]:block" style={{ color: c.textPrimary }}>
            {brandName}
          </span>
        </div>

        {backHref && (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm font-medium flex-shrink-0 whitespace-nowrap"
            style={{ color: c.textMuted }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to course
          </Link>
        )}
      </nav>

      <div style={{ background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${c.heroGlowRgba}, transparent 70%)` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20">
          

          <h2 className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: c.textMuted }}>
            {courseCount} course{courseCount !== 1 ? 's' : ''}
          </h2>

          {/* Course cards — 1 column on phones, 2 from tablet up, 3 on wide screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course: any) => {
              const courseSlug = slugify(course.slug || course.name)
              const href = `/about-course/${creator.creator_slug}/${courseSlug}/${course.id}`
              const isFree = course.is_free_course === true || !course.price
              const discount =
                !isFree && course.original_price && course.original_price > course.price
                  ? Math.round(((course.original_price - course.price) / course.original_price) * 100)
                  : 0
              const image = getCourseCardImage(course)

              return (
                <Link key={course.id} href={href} className="sf-card group flex flex-col rounded-2xl overflow-hidden">
                  {/* Image area — uploaded thumbnail, else video still, else a tile in the course's own theme */}
                  <div className="relative w-full aspect-video overflow-hidden"
                    style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
                    <div className="sf-media absolute inset-0">
                      {image ? (
                        <img src={image.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <CourseFallbackTile name={course.name} themeId={course.landing_theme} fontPairId={course.landing_font_pair} />
                      )}
                    </div>
                    {/* Play badge only on video stills, not on uploaded images or generated tiles */}
                    {image?.kind === 'video' && (
                      <span className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
                        <Play className="w-3.5 h-3.5 text-white" fill="currentColor" />
                      </span>
                    )}
                    {discount > 0 && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
                        {discount}% off
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col flex-1 p-5">
                    <h3 className="sf-heading text-lg font-bold leading-snug line-clamp-2" style={{ color: c.textPrimary }}>
                      {course.name}
                    </h3>
                    {course.description && (
                      <p className="text-sm mt-2 leading-relaxed line-clamp-2" style={{ color: c.textMuted }}>
                        {course.description}
                      </p>
                    )}

                    <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-base font-bold" style={{ color: c.accentText }}>
                          {isFree ? 'Free' : `₹${(course.price ?? 0).toLocaleString('en-IN')}`}
                        </span>
                        {discount > 0 && (
                          <span className="text-xs line-through" style={{ color: c.textMuted, opacity: 0.8 }}>
                            ₹{course.original_price.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1.5 text-sm font-semibold flex-shrink-0" style={{ color: c.accentText }}>
                        View course
                        <ArrowRight className="sf-arrow w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {courseCount === 0 && (
            <p className="text-sm text-center py-12" style={{ color: c.textMuted }}>No published courses yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}