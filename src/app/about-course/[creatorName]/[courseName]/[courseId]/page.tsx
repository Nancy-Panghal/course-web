import { Shield, CheckCircle, Lock, BookOpen, Play, Zap, Globe, Calendar, Timer, Send, Star, Users, Award, ChevronRight, Target, Gift, AlertTriangle } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import type { Metadata } from 'next'
import { normalizeLandingConfig, getRenderableSectionEntries, hasUrgencyContent, getVideoEmbedUrl, type LandingSectionType, type LandingCustomSection } from '@/lib/landing-config'
import CountdownTimer from '@/components/CountdownTimer'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CoursePageClient from '@/components/CoursePageClient'
import FinalCtaBar from '@/components/FinalCtaBar'
import CurriculumAccordion from './Curriculumaccordion'
import DraftGate from '@/components/DraftGate'
import { getLandingTheme } from '@/lib/landing-themes'
import { getFontPairOverride } from '@/lib/landing-themes/fontPairs'

function getYoutubeId(url?: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Strips HTML/markdown-ish characters and clamps length — course
// descriptions are free text a creator wrote for the page body, not
// written with a search-result snippet's ~155-char limit in mind.
function toMetaDescription(raw: string | null | undefined, fallback: string): string {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length > 155 ? `${text.slice(0, 152)}...` : text
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ creatorName: string; courseName: string; courseId: string }>
}): Promise<Metadata> {
  const { courseId } = await params

  const { data: course } = await supabase
    .from('courses')
    .select('name, description, host_name, host_image, brand_logo_url, is_published, price')
    .eq('id', courseId)
    .single()

  if (!course) {
    return { title: 'Course not found' }
  }

  const title = course.host_name ? `${course.name} by ${course.host_name}` : course.name
  const description = toMetaDescription(
    course.description,
    `Learn ${course.name} on Kurso — delivered straight to your WhatsApp or Telegram, no app to download.`
  )
  // Courses have no dedicated cover-image field yet — falls back to the
  // creator's brand logo, then their profile photo, then the site default.
  const image = course.brand_logo_url || course.host_image || '/icon.jpg'

  return {
    title,
    description,
    // Draft/unpublished courses can still be reached by a guessed or old
    // URL even though they're excluded from the sitemap — this keeps
    // Google from indexing them if that happens.
    robots: course.is_published ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'website',
      title,
      description,
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function AboutCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ creatorName: string; courseName: string; courseId: string }>
  searchParams: Promise<{ theme?: string }>
}) {
  const { courseId } = await params
  const { theme: previewThemeId } = await searchParams

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (!course || courseError) notFound()

  const deliveryMethod = course.delivery || 'both'
  const showTelegramChannel = deliveryMethod === 'telegram' || deliveryMethod === 'both'
  const showWhatsappChannel = deliveryMethod === 'whatsapp' || deliveryMethod === 'both'
  const deliveryChannelCopy = showTelegramChannel && showWhatsappChannel
  ? 'WhatsApp or Telegram'
    : showTelegramChannel
    ? 'Telegram'
    : 'WhatsApp'

  


  const theme = getLandingTheme(previewThemeId || course.landing_theme)
  const c = theme.colors
  // Slightly lighter variants of the two muted text colors, used only on the
  // small/secondary text that was reading too dark/tiny — not applied
  // page-wide, so nothing else on the page shifts.
  const mutedSoft = `color-mix(in srgb, ${c.textMuted} 100%, white 14%)`
  const faintSoft = `color-mix(in srgb, ${c.textFaint} 100%, white 18%)`

  // Font pair override — merges on top of theme's default fonts
  const fontOverride = getFontPairOverride(course.landing_font_pair)
  const fonts = fontOverride
    ? { heading: fontOverride.heading, body: fontOverride.body, googleFontsImportUrl: fontOverride.googleFontsImportUrl }
    : theme.fonts

  // Section visibility + order — driven by landing_config. course.landing_sections
  // (the old flat boolean map) is passed as a legacy fallback so courses configured
  // before this feature existed keep rendering exactly as before until re-saved.
  const landingConfig = normalizeLandingConfig(course.landing_config, course.landing_sections)
  const renderableEntries = getRenderableSectionEntries(landingConfig)
  const enabledTypes = new Set(renderableEntries.map(e => e.type))
  const show = (key: LandingSectionType) => enabledTypes.has(key)
  const middleEntries = renderableEntries.filter(
    (e) => e.type !== 'hero' && e.type !== 'finalCta'
  )
  const customSectionsById = new Map(landingConfig.customSections.map(cs => [cs.id, cs]))

  const { data: creatorProfile } = await supabase
    .from('creators')
    .select('id, name, email, whatsapp_number, telegram_bot_username, creator_slug')
    .eq('id', course.creator_id)
    .single()

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, content_type, order_num, duration, is_published, content_url, module_id')
    .eq('course_id', course.id)
    .eq('is_published', true)
    .order('order_num', { ascending: true })

  const { data: courseModules } = await supabase
    .from('course_modules')
    .select('*')
    .eq('course_id', course.id)
    .order('order_num', { ascending: true })

  const { data: liveSessions } = await supabase
    .from('live_sessions')
    .select('id, title, description, scheduled_at, duration_minutes, join_url, recording_url')
    .eq('course_id', course.id)
    .order('scheduled_at', { ascending: true })

  const publishedLessons = lessons || []
  const modules = courseModules || []

  const groupedModules =
    modules.length > 0
      ? modules.map(mod => ({
        name: mod.name,
        lessons: publishedLessons.filter((l: any) => l.module_id === mod.id),
      }))
      : publishedLessons.length > 0
        ? [{ name: 'Course Content', lessons: publishedLessons }]
        : []

  if (modules.length > 0) {
    const unassigned = publishedLessons.filter((l: any) => !l.module_id)
    if (unassigned.length > 0)
      groupedModules.push({ name: 'Additional Lessons', lessons: unassigned })
  }

  const discount =
    course.original_price && course.original_price > course.price
      ? Math.round(((course.original_price - course.price) / course.original_price) * 100)
      : 0

  const brandDisplayName = course.brand_name || course.host_name || creatorProfile?.name || 'Kurso'
  // Hero no longer embeds a video directly — videos now render in their own
  // section (videosNode) right after the hero. Keeping this at `null` (instead
  // of removing the ~15 `promoVideoId ? ... : ...` branches inside the hero
  // JSX below) makes the hero always render its single, no-video layout with
  // a one-line change instead of hand-editing a large block of nested JSX.
  const promoVideoId = null
  // promo_video_urls is the source of truth; promo_video_url (singular) is
  // read only as a fallback for courses configured before this feature existed.
  const promoVideos: string[] = (Array.isArray(course.promo_video_urls) && course.promo_video_urls.length > 0
    ? course.promo_video_urls
    : course.promo_video_url ? [course.promo_video_url] : []
  ).slice(0, 3)
  const testimonials: { name: string; text: string; rating?: number }[] = course.testimonials || []
  const targetAudience: string[] = course.target_audience || []

  const courseData = {
    id: course.id,
    name: course.name,
    price: course.price,
    creatorSlug: course.slug,
    creatorName: course.host_name || creatorProfile?.name || '',
    creatorId: creatorProfile?.id || '',
    waNumber: creatorProfile?.whatsapp_number || '',
    telegramBotUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || creatorProfile?.telegram_bot_username || '',
    is_free_course: course.is_free_course ?? false,
    isPublished: course.is_published,
  }

  const statsNode = (
    show('stats') && (
      <section className="ak-section py-10 px-6" style={{ background: c.sectionAltBg }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { num: course.duration || 'Self-paced', label: 'Total Duration' },
            { num: course.language?.join(' & ') || 'English', label: 'Language' },
            { num: course.level || 'All Levels', label: 'Difficulty' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="ak-stat-num mb-1">{s.num}</div>
              <div style={{ fontSize: 13, color: mutedSoft, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    )
  );
  const targetNode = (
    show('target') && targetAudience.length > 0 && (
      <section className="ak-section py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="ak-section-title text-center mb-3">Who is this course for?</h2>
          <p className="text-center mb-10" style={{ color: mutedSoft, fontSize: '1rem' }}>
            This course is designed for people who match one or more of these descriptions
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {targetAudience.map((item: string, i: number) => (
              <div key={i} className="ak-card flex items-start gap-4 p-5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: c.accentSoft, border: `1px solid ${c.accentBorder}` }}>
                  <Target className="w-4 h-4" style={{ color: c.accentText }} />
                </div>
                <p style={{ color: c.textSecondary, fontSize: '0.92rem', lineHeight: 1.7 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  );
  const learnNode = (
    show('learn') && course.what_you_will_learn && course.what_you_will_learn.length > 0 && (
      <section className="ak-section py-16 px-6" style={{ background: c.sectionAltBg }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="ak-section-title text-center mb-3">What you'll walk away with</h2>
          <p className="text-center mb-10" style={{ color: mutedSoft, fontSize: '1rem' }}>
            Concrete skills and knowledge you'll have after completing this course
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {course.what_you_will_learn.map((item: string, i: number) => (
              <div key={i} className="ak-card flex items-start gap-4 p-5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: c.accentSoft, border: `1px solid ${c.accentBorder}` }}>
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: c.accentText }} />
                </div>
                <p style={{ color: c.textSecondary, fontSize: '0.92rem', lineHeight: 1.7 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  );
  const requirementsNode = (
    show('requirements') && course.requirements && course.requirements.length > 0 && (
      <section className="ak-section py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="ak-section-title mb-8">Requirements</h2>
          <ul className="flex flex-col gap-3">
            {course.requirements.map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: c.accentText }} />
                <span style={{ color: c.textSecondary, fontSize: '0.96rem', lineHeight: 1.65 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    )
  );
  const curriculumNode = (
    show('curriculum') && groupedModules.length > 0 && (
      <section className="ak-section" style={{ background: c.sectionAltBg }}>
        <CurriculumAccordion
          modules={groupedModules}
          totalLessons={publishedLessons.length}
          liveSessions={liveSessions || []}
          themeColors={c}
          themeFonts={{ heading: fonts.heading, body: fonts.body }}
        />
      </section>
    )
  );
  // Instructor #1 always comes from the original host_name/about_creator/
  // host_image/instructor_title columns — those are left untouched since
  // they're relied on elsewhere (certificates, slugs, emails). Any extra
  // instructors a creator adds live in the separate `co_instructors` column
  // and are appended after the primary one, display-only.
  const primaryInstructor = {
    name: course.host_name || creatorProfile?.name || 'Course Creator',
    title: course.instructor_title || 'Course Instructor',
    image: course.host_image || '',
    bio: course.about_creator || 'Expert instructor dedicated to helping you master this subject and achieve your goals.',
  }
  const coInstructors: (typeof primaryInstructor)[] = Array.isArray(course.co_instructors)
    ? course.co_instructors
      .filter((i: any) => i && typeof i.name === 'string' && i.name.trim().length > 0)
      .map((i: any) => ({
        name: i.name.trim(),
        title: (i.title || 'Co-Instructor').toString(),
        image: (i.image || '').toString(),
        bio: (i.bio || '').toString(),
      }))
    : []
  const allInstructors = [primaryInstructor, ...coInstructors]

  const instructorNode = (
    show('instructor') && (
      <section className="ak-section py-18 px-6" style={{ background: c.bg }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="ak-section-title text-center mb-12">
            {allInstructors.length > 1 ? 'Meet your instructors' : 'Meet your instructor'}
          </h2>

          {landingConfig.instructorLayout === 'rectangle' ? (
            /* Rectangle: fixed wide width, height grows with the bio text,
               one per row — never side by side, regardless of count. */
            <div className="flex flex-col gap-5">
              {allInstructors.map((inst, i) => (
                <div key={i} className="ak-glow rounded-3xl overflow-hidden"
                  style={{ background: c.cardBg, border: `1px solid ${c.accentBorder}` }}>
                  <div className="flex flex-col md:flex-row">
                    <div className="flex-shrink-0 flex flex-col items-center justify-center p-8 md:p-10"
                      style={{ background: c.accentSoft, borderRight: `1px solid ${c.accentBorder}`, minWidth: 200 }}>
                      <div className="w-28 h-28 rounded-2xl overflow-hidden mb-4"
                        style={{ border: `3px solid ${c.accentBorderStrong}` }}>
                        {inst.image ? (
                          <img src={inst.image} alt={inst.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-bold text-3xl"
                            style={{ background: c.accentGradient }}>
                            {inst.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p style={{ fontFamily: fonts.heading, fontSize: '1rem', fontWeight: 800, color: c.textPrimary }}>
                          {inst.name}
                        </p>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: c.accentText, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>
                          {inst.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
                      <p style={{ color: c.textSecondary, fontSize: '0.98rem', lineHeight: 1.8 }}>
                        {inst.bio}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Square: compact cards that sit in one row and only wrap onto a
               second row if the screen is too narrow to fit them all. */
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
              {allInstructors.map((inst, i) => (
                <div key={i} className="ak-card flex flex-col items-center text-center p-7">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4 flex-shrink-0"
                    style={{ border: `3px solid ${c.accentBorderStrong}` }}>
                    {inst.image ? (
                      <img src={inst.image} alt={inst.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl"
                        style={{ background: c.accentGradient }}>
                        {inst.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <p style={{ fontFamily: fonts.heading, fontSize: '0.95rem', fontWeight: 800, color: c.textPrimary }}>
                    {inst.name}
                  </p>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: c.accentText, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4, marginBottom: 10 }}>
                    {inst.title}
                  </p>
                  {inst.bio && (
                    <p style={{ color: c.textSecondary, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      {inst.bio}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    )
  );
  const testimonialsNode = (
    show('testimonials') && testimonials.length > 0 && (
      <section className="ak-section py-16 px-6" style={{ background: c.sectionAltBg }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="ak-section-title text-center mb-3">What students say</h2>
          <p className="text-center mb-10" style={{ color: mutedSoft, fontSize: '1rem' }}>
            Real feedback from people who've taken this course
          </p>
          {testimonials.length <= 2 ? (
            /* 1 or 2 testimonials — centered grid */
            <div className={`grid gap-4 mx-auto ${testimonials.length === 1 ? 'max-w-md' : 'max-w-2xl grid-cols-1 sm:grid-cols-2'}`}>
              {testimonials.map((t, i) => (
                <div key={i} className="ak-card p-6 flex flex-col gap-3">
                  <div className="ak-stars">{'★'.repeat(t.rating ?? 5)}{'☆'.repeat(5 - (t.rating ?? 5))}</div>
                  <p style={{ color: c.textSecondary, fontSize: '0.93rem', lineHeight: 1.7, flex: 1 }}>"{t.text}"</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: c.textPrimary }}>— {t.name}</p>
                </div>
              ))}
            </div>
          ) : (
            /* 3+ testimonials — horizontal scroll */
            <div style={{ overflowX: 'auto', paddingBottom: 12, marginLeft: -8, marginRight: -8 }}>
              <div style={{ display: 'flex', gap: 16, paddingLeft: 8, paddingRight: 8, width: 'max-content' }}>
                {testimonials.map((t, i) => (
                  <div key={i} className="ak-card p-6 flex flex-col gap-3"
                    style={{ width: 300, flexShrink: 0 }}>
                   <div className="ak-stars">{'★'.repeat(t.rating ?? 5)}{'☆'.repeat(5 - (t.rating ?? 5))}</div>
                    <p style={{ color: c.textSecondary, fontSize: '0.93rem', lineHeight: 1.7, flex: 1 }}>"{t.text}"</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: c.textPrimary }}>— {t.name}</p> 


                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    )
  );
  const howItWorksNode = (
    show('howItWorks') && (
      <section className="ak-section py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="ak-section-title text-center mb-3">How course delivery works</h2>
          <p className="text-center mb-10" style={{ color: mutedSoft, fontSize: '1rem' }}>
            Lessons arrive directly on {deliveryChannelCopy} — no extra app needed
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <CheckCircle className="w-5 h-5" style={{ color: '#4ade80' }} />, title: 'Enroll & Pay', desc: 'Secure Razorpay payment. Your spot is confirmed instantly.' },
              { icon: showWhatsappChannel
                  ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#25D366' }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  : <Send className="w-5 h-5" style={{ color: '#38bdf8' }} />,
                title: `Start on ${deliveryChannelCopy}`, desc: `Message the bot${showTelegramChannel ? ' or tap the Telegram link' : ''} — lesson 1 arrives straight to your chat.` },
              { icon: <Play className="w-5 h-5" style={{ color: c.accentText }} />, title: 'Learn at Your Pace', desc: `Mark done, unlock next. Progress syncs across ${deliveryChannelCopy} and the web.` },
            ].map((step, i) => (
              <div key={i} className="ak-card p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: c.pillBg, border: `1px solid ${c.borderSoft}` }}>
                    {step.icon}
                  </div>
                  <span style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1, color: c.numberGhost, fontFamily: fonts.heading }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>{step.title}</p>
                  <p style={{ fontSize: '0.92rem', color: mutedSoft, lineHeight: 1.65 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  );
  const faqNode = (
    show('faq') && course.faq && course.faq.length > 0 && (
      <section className="ak-section py-16 px-6" style={{ background: c.sectionAltBg }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="ak-section-title text-center mb-3">Frequently asked questions</h2>
          <p className="text-center mb-10" style={{ color: mutedSoft, fontSize: '1rem' }}>
            Still have questions? Reach out through {deliveryChannelCopy}.
          </p>
          <div className="flex flex-col gap-2">
            {course.faq.map((item: any, i: number) => (
              <details key={i} className="group rounded-2xl overflow-hidden"
                style={{ background: c.cardBg, border: `1px solid ${c.borderSoft}` }}>
                <summary className="flex items-center justify-between p-5 cursor-pointer list-none select-none gap-4">
                  <span style={{ fontWeight: 600, color: c.textPrimary, fontSize: '0.92rem', lineHeight: 1.5 }}>{item.question}</span>
                  <span className="faq-icon flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-lg"
                    style={{ background: c.accentSoft, color: c.accentText, lineHeight: 1 }}>+</span>
                </summary>
                <div className="px-5 pb-5">
                  <div style={{ height: 1, background: c.border, marginBottom: 14 }} />
                  <p style={{ color: c.textSecondary, fontSize: '0.93rem', lineHeight: 1.75 }}>{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    )
  );
  

  const bonusesNode = (
    show('bonuses') && landingConfig.bonuses.length > 0 && (
      <section className="ak-section py-16 px-6" style={{ background: c.sectionAltBg }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="ak-section-title text-center mb-3">What's included</h2>
          <p className="text-center mb-10" style={{ color: mutedSoft, fontSize: '1rem' }}>
            Extra resources and bonuses that come with this course
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {landingConfig.bonuses.map((bonus, i) => (
              <div key={i} className="ak-card flex items-start gap-4 p-5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: c.accentSoft, border: `1px solid ${c.accentBorder}` }}>
                  <Gift className="w-4 h-4" style={{ color: c.accentText }} />
                </div>
                <div>
                  <p style={{ color: c.textPrimary, fontSize: '0.92rem', fontWeight: 700, marginBottom: bonus.description ? 4 : 0 }}>{bonus.title}</p>
                  {bonus.description && (
                    <p style={{ color: c.textSecondary, fontSize: '0.9rem', lineHeight: 1.65 }}>{bonus.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  )

  const disclaimerNode = (
    show('disclaimer') && landingConfig.disclaimer.text.trim().length > 0 && (
      <section className="ak-section py-12 px-6">
        <div className="max-w-2xl mx-auto rounded-2xl p-6"
          style={{ background: c.cardBg, border: `1px solid ${c.borderSoft}` }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: c.textMuted }} />
            <div>
              <h3 style={{ fontWeight: 600, color: c.textPrimary, fontSize: '0.95rem', marginBottom: 8 }}>
                {landingConfig.disclaimer.title}
              </h3>
              <p style={{ color: c.textSecondary, fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {landingConfig.disclaimer.text}
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  )

  // Custom, creator-written text sections. Unlike every other section this
  // renders from a lookup keyed by customId (not a singleton const), since a
  // course can have several. Text only — no image/video/embed markup exists
  // anywhere in this render path. Theme colors/fonts apply automatically;
  // `background: 'custom'` is the only per-section override available.
  const customSectionNode = (cs: LandingCustomSection) => {
    if (!cs.heading.trim() && !cs.body.trim()) return null
    const headingSizePx = cs.headingSize === 'lg' ? 'clamp(1.5rem, 3.4vw, 2rem)' : cs.headingSize === 'sm' ? '1.15rem' : '1.5rem'
    const bodySizePx = cs.bodySize === 'lg' ? '1.05rem' : cs.bodySize === 'sm' ? '0.85rem' : '0.95rem'
    const paddingY = cs.spacing === 'compact' ? 40 : cs.spacing === 'roomy' ? 112 : 64
    const backgroundStyle = cs.background === 'custom' ? cs.backgroundColor : undefined
    return (
      <section className="ak-section px-6" style={{ paddingTop: paddingY, paddingBottom: paddingY, background: backgroundStyle }}>
        <div className="max-w-3xl mx-auto">
          <div className={cs.style === 'card' ? 'ak-card p-8' : ''} style={{ textAlign: cs.align }}>
            {cs.heading.trim() && (
              <h2 style={{
                fontFamily: fonts.heading, fontSize: headingSizePx, fontWeight: 800,
                color: c.textPrimary, lineHeight: 1.2, marginBottom: cs.body.trim() ? 16 : 0,
              }}>
                {cs.heading}
              </h2>
            )}
            {cs.body.trim() && (
              <p style={{ fontSize: bodySizePx, color: c.textSecondary, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                {cs.body}
              </p>
            )}
            {cs.images.length > 0 && (
              cs.images.length <= 3 ? (
                <div className="grid gap-4 mt-6" style={{ gridTemplateColumns: `repeat(${cs.images.length}, 1fr)` }}>
                  {cs.images.map((src, imgI) => (
                    <img key={imgI} src={src} alt="" className="w-full rounded-2xl object-cover"
                      style={{ aspectRatio: cs.images.length === 1 ? '16 / 9' : '4 / 3', border: `1px solid ${c.borderSoft}` }} />
                  ))}
                </div>
              ) : (
                <div className="mt-6" style={{ overflowX: 'auto', paddingBottom: 8, marginLeft: -8, marginRight: -8 }}>
                  <div style={{ display: 'flex', gap: 16, paddingLeft: 8, paddingRight: 8, width: 'max-content' }}>
                    {cs.images.map((src, imgI) => (
                      <img key={imgI} src={src} alt="" className="rounded-2xl object-cover flex-shrink-0"
                        style={{ width: 280, aspectRatio: '4 / 3', border: `1px solid ${c.borderSoft}` }} />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </section>
    )
  }

  const hasCountdown = !!landingConfig.urgency.endAt
  const hasSeats = typeof landingConfig.urgency.seatsAvailable === 'number'

  const urgencyNode = (
    show('urgency') && hasUrgencyContent(landingConfig.urgency) && (
      <section className="ak-section py-10 px-6" style={{ background: c.sectionAltBg }}>
        <div className="max-w-3xl mx-auto">
          <div className="ak-glow rounded-3xl overflow-hidden flex flex-col sm:flex-row"
            style={{ background: c.cardBg, border: `1px solid ${c.accentBorder}` }}>

            {hasCountdown && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-7">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4" style={{ color: c.accentText }} />
                  <span style={{ fontSize: '0.8rem', color: c.textSecondary, fontWeight: 600 }}>
                    {landingConfig.urgency.label}
                  </span>
                </div>
                <CountdownTimer
                  endAt={landingConfig.urgency.endAt}
                  accentGradient={c.accentGradient}
                  boxShadowColor={c.accentGradientShadow}
                  labelColor={c.textMuted}
                />
              </div>
            )}

            {hasCountdown && hasSeats && (
              <div className="w-full h-px sm:w-px sm:h-auto flex-shrink-0" style={{ background: c.border }} />
            )}

            {hasSeats && (
              <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-6 py-7">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: c.accentText }} />
                  {landingConfig.urgency.seatsAvailable! <= 5 && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ background: c.accentText }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: c.accentText }} />
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '1.9rem', fontWeight: 800, color: c.textPrimary, lineHeight: 1, fontFamily: fonts.heading }}>
                  {landingConfig.urgency.seatsAvailable}
                </p>
                <p style={{ fontSize: '0.8rem', color: c.textSecondary, fontWeight: 500, textAlign: 'center' }}>
                  {landingConfig.urgency.seatsLabel}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    )
  )

  const videosNode = (
    show('videos') && promoVideos.length > 0 && (
      <section className="ak-section py-16 px-6" style={{ background: c.sectionAltBg }}>
        <div className="max-w-5xl mx-auto">
          {course.promo_video_heading && (
            <h2 className="ak-section-title text-center mb-10">{course.promo_video_heading}</h2>
          )}
          <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${promoVideos.length === 1 ? 480 : 280}px, 1fr))` }}>
            {promoVideos.map((url, i) => {
              const embedUrl = getVideoEmbedUrl(url)
              if (!embedUrl) return null
              return (
                <div key={i} className="ak-card overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
                  <iframe
                    src={embedUrl}
                    title={`${course.name} video ${i + 1}`}
                    className="w-full h-full"
                    style={{ border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  )

  const sectionNodes: Partial<Record<LandingSectionType, ReactNode>> = {
    videos: videosNode,
    urgency: urgencyNode,
    stats: statsNode,
    target: targetNode,
    learn: learnNode,
    requirements: requirementsNode,
    bonuses: bonusesNode,
    curriculum: curriculumNode,
    instructor: instructorNode,
    testimonials: testimonialsNode,
    howItWorks: howItWorksNode,
    faq: faqNode,
    disclaimer: disclaimerNode,
  }

  // Structured data (JSON-LD) — tells Google this page is specifically a
  // "Course" with a real price and provider, which is what makes rich
  // search results (price, rating stars, etc.) possible. Doesn't help
  // ranking directly, but improves how the listing can look once it does
  // rank. Escaping "<" prevents a creator's own description text from
  // ever being able to break out of the script tag.
  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.name,
    description: (course.description || `Learn ${course.name} on Kurso.`).slice(0, 500),
    provider: {
      '@type': 'Organization',
      name: creatorProfile?.name || course.host_name || 'Kurso',
    },
    ...(course.price
      ? {
          offers: {
            '@type': 'Offer',
            price: course.price,
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  }

  return (
    <DraftGate isPublished={course.is_published} courseData={courseData}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="min-h-screen" style={{ background: c.bg, color: c.textPrimary, fontFamily: fonts.body }}>
        <style>{`
        @import url('${fonts.googleFontsImportUrl}');
        *, *::before, *::after { box-sizing: border-box; }

        .ak-hero {
          background:
            radial-gradient(ellipse 130% 70% at 50% -10%, ${c.heroGlowRgba} 0%, transparent 65%),
            ${c.bg};
        }
        .ak-nav {
          background: ${c.navBg};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${c.navBorder};
        }
        .ak-section { border-top: 1px solid ${c.border}; }
        .ak-card {
          background: ${c.cardBg};
          border: 1px solid ${c.borderSoft};
          border-radius: 16px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ak-card:hover {
          border-color: ${c.accentBorderStrong};
          box-shadow: 0 4px 28px ${c.accentSoft};
        }
        .ak-glow { box-shadow: 0 0 0 1px ${c.accentBorder}, 0 8px 48px ${c.accentSoft}; }
        details summary::-webkit-details-marker { display: none; }
        details[open] .faq-icon { transform: rotate(45deg); }
        .faq-icon { transition: transform 0.22s; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fu  { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) both; }
        .fu1 { animation-delay: 0.05s; }
        .fu2 { animation-delay: 0.15s; }
        .fu3 { animation-delay: 0.25s; }
        .fu4 { animation-delay: 0.38s; }
        .fu5 { animation-delay: 0.50s; }
        .ak-stat-num {
          font-family: ${fonts.heading};
          font-size: clamp(1.6rem, 3vw, 2.2rem);
          font-weight: 900;
          line-height: 1;
          color: ${c.textPrimary};
        }
        .ak-section-title {
          font-family: ${fonts.heading};
          font-size: clamp(1.55rem, 3.5vw, 2.1rem);
          font-weight: 800;
          letter-spacing: -0.015em;
          color: ${c.textPrimary};
          line-height: 1.2;
        }
        .ak-video-wrap {
          position: relative;
          width: 100%;
          padding-top: 56.25%;
          border-radius: 16px;
          overflow: hidden;
          background: rgba(0,0,0,0.15);
          border: 1px solid ${c.borderSoft};
        }
        .ak-video-wrap iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        /* Star rating */
        .ak-stars { color: var(--kurso-accent); letter-spacing: 1px; font-size: 13px; }
      `}</style>

        {/* ── NAV ── */}
        <nav className="ak-nav sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {course.brand_logo_url ? (
              <>
                <img src={course.brand_logo_url} alt={brandDisplayName} className="h-7 max-w-[140px] object-contain" />
                <span className="text-sm font-bold tracking-tight hidden sm:block" style={{ color: c.textPrimary }}>
                  {brandDisplayName}
                </span>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: c.accentGradient }}>
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold tracking-tight" style={{ color: c.textPrimary }}>{brandDisplayName}</span>
              </>
            )}
          </Link>
          <div style={{ maxWidth: 200 }}>
            <CoursePageClient course={courseData} variant="nav" />
          </div>
        </nav>


        {/* ══════════════════════════════════════════
          HERO — two columns on desktop when video, wide centered otherwise
      ══════════════════════════════════════════ */}
      <section className="ak-hero px-6 pt-16 pb-16">
        <div className={`mx-auto ${promoVideoId ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <div className={`flex flex-col ${promoVideoId ? 'lg:flex-row lg:items-start lg:gap-14' : ''}`}>

            {/* Left / Center: text content */}
            <div className={`flex flex-col ${promoVideoId ? 'lg:flex-1 text-left' : 'items-center text-center'}`}>

              {/* Badge */}
              {course.is_free_course && (
                <div className="fu fu1 flex mb-5" style={{ justifyContent: promoVideoId ? 'flex-start' : 'center' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                    fontWeight: 700, color: c.accentText,
                    background: c.accentSoft, border: `1px solid ${c.accentBorder}`,
                    padding: '5px 16px', borderRadius: 999,
                  }}>
                    ✦ Completely free — Enroll now
                  </span>
                </div>
              )}

              {/* Title */}
              <h1 className="fu fu2 mb-5" style={{
                fontFamily: fonts.heading,
                fontSize: promoVideoId ? 'clamp(1.7rem, 3.5vw, 2.8rem)' : 'clamp(2rem, 5vw, 3.2rem)',
                fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.022em', color: c.textPrimary,
              }}>
                {course.name}
              </h1>

              {/* Description */}
              {course.description && (
                <p className="fu fu3 mb-7" style={{
                  color: c.textSecondary,
                  fontSize: 'clamp(0.95rem, 1.8vw, 1.05rem)',
                  lineHeight: 1.75,
                  maxWidth: promoVideoId ? '100%' : 680,
                }}>
                  {course.description}
                </p>
              )}

              {/* Meta pills — only shown here when there's NO video (no-video layout keeps everything in this column) */}
              {!promoVideoId && (
              <div className="fu fu3 flex flex-wrap gap-2 mb-7" style={{ justifyContent: 'center' }}>
                {[
                  { icon: <Calendar className="w-3.5 h-3.5" />, text: course.start_date || 'Instant Access' },
                  ...(course.duration ? [{ icon: <Timer className="w-3.5 h-3.5" />, text: course.duration }] : []),
                  { icon: <Globe className="w-3.5 h-3.5" />, text: course.language?.join(', ') || 'English' },
                  ...(course.level ? [{ icon: <Star className="w-3.5 h-3.5" />, text: course.level }] : []),
                ].map((p, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                    background: c.pillBg, border: `1px solid ${c.borderSoft}`, color: c.textSecondary,
                  }}>
                    <span style={{ color: c.accent }}>{p.icon}</span>{p.text}
                  </span>
                ))}
              </div>
              )}

              {/* Price row — only shown here when there's NO video */}
              {!promoVideoId && (
              <div className="fu fu4 flex items-baseline gap-3 mb-5" style={{ justifyContent: 'center' }}>
                <span style={{
                  fontFamily: fonts.heading,
                  fontSize: 'clamp(1.9rem, 3.5vw, 2.6rem)', fontWeight: 900, color: c.textPrimary, lineHeight: 1,
                }}>
                  {course.is_free_course ? 'Free' : `₹${course.price?.toLocaleString()}`}
                </span>
                {discount > 0 && (
                  <>
                    <span style={{ fontSize: '1.05rem', color: c.textFaint, textDecoration: 'line-through' }}>₹{course.original_price?.toLocaleString()}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.22)' }}>
                      {discount}% OFF
                    </span>
                  </>
                )}
              </div>
              )}

              {/* CTA — only shown here when there's NO video */}
              {!promoVideoId && (
              <div className="fu fu5 flex flex-col items-center gap-3 mb-5" style={{ width: '100%' }}>
                <div className="flex justify-center" style={{ width: '100%', maxWidth: 360 }}>
                  <CoursePageClient course={courseData} variant="cta" />
                </div>
                <p style={{ fontSize: 13, color: faintSoft }}>🔒 Secure payment · Instant access · Anti-piracy protected</p>
              </div>
              )}

              {/* Channel badges — only shown here when there's NO video */}
              {!promoVideoId && (
              <div className="flex flex-wrap justify-center gap-5">
                {[
                  { icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, label: 'WhatsApp', color: '#25D366' },
                  { icon: <Send className="w-3.5 h-3.5" />, label: 'Telegram', color: '#38bdf8' },
                  { icon: <Globe className="w-3.5 h-3.5" />, label: 'Web Access', color: c.accentText },
                ].map((t, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${c.borderSoft}`, background: c.pillBg, color: t.color,
                  }}>
                    {t.icon} {t.label}
                  </span>
                ))}
              </div>
              )}
            </div>

            {/* Right: promo video */}
            {promoVideoId && (
              <div className="lg:w-[44%] mt-10 lg:mt-0 flex-shrink-0">
                <div className="ak-video-wrap" style={{ boxShadow: `0 24px 80px ${c.accentGradientShadow}` }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${promoVideoId}?rel=0&modestbranding=1`}
                    title={`${course.name} — preview`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pills + price/CTA + channel badges — full width, centered, ONLY when video is present */}
          {promoVideoId && (
            <div className="fu fu5 flex flex-col items-center gap-5 mt-12">

              {/* Date / Duration / Language pills */}
              <div className="fu fu5 flex flex-wrap justify-center gap-x-3 gap-y-3 py-2">
                {[
                  { icon: <Calendar className="w-3.5 h-3.5" />, text: course.start_date || 'Instant Access' },
                  ...(course.duration ? [{ icon: <Timer className="w-3.5 h-3.5" />, text: course.duration }] : []),
                  { icon: <Globe className="w-3.5 h-3.5" />, text: course.language?.join(', ') || 'English' },
                  ...(course.level ? [{ icon: <Star className="w-3.5 h-3.5" />, text: course.level }] : []),
                ].map((p, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 16px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                    background: c.pillBg, border: `1px solid ${c.borderSoft}`, color: c.textSecondary,
                  }}>
                    <span style={{ color: c.accent }}>{p.icon}</span>{p.text}
                  </span>
                ))}
              </div>

              {/* Price + Enroll button + secure payment text */}
              <div className="flex flex-col items-center gap-3" style={{ width: '100%', maxWidth: 380 }}>
                <div className="flex items-baseline justify-center gap-3">
                  <span style={{
                    fontFamily: fonts.heading,
                    fontSize: 'clamp(1.9rem, 3.5vw, 2.6rem)', fontWeight: 900, color: c.textPrimary, lineHeight: 1,
                  }}>
                    {course.is_free_course ? 'Free' : `₹${course.price?.toLocaleString()}`}
                  </span>
                  {discount > 0 && (
                    <>
                      <span style={{ fontSize: '1.05rem', color: c.textFaint, textDecoration: 'line-through' }}>₹{course.original_price?.toLocaleString()}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.22)' }}>
                        {discount}% OFF
                      </span>
                    </>
                  )}
                </div>
                <div className="flex justify-center" style={{ width: '100%', maxWidth: 360 }}>
                  <CoursePageClient course={courseData} variant="cta" />
                </div>
                <p style={{ fontSize: 13, color: faintSoft }}>🔒 Secure payment · Instant access · Anti-piracy protected</p>
              </div>

              {/* WhatsApp / Telegram / Web Access pills — gated by course.delivery, no leakage */}
              <div className="fu fu5 flex flex-wrap justify-center gap-x-3 gap-y-3 py-2">
                {[
                  ...(showWhatsappChannel ? [{ icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, label: 'WhatsApp', color: '#25D366' }] : []),
                  ...(showTelegramChannel ? [{ icon: <Send className="w-3.5 h-3.5" />, label: 'Telegram', color: '#38bdf8' }] : []),
                  { icon: <Globe className="w-3.5 h-3.5" />, label: 'Web Access', color: c.accentText },
                ].map((t, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${c.borderSoft}`, background: c.pillBg, color: t.color,
                  }}>
                    {t.icon} {t.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>



        {middleEntries.map((entry) => {
          if (entry.type === 'custom') {
            const cs = entry.customId ? customSectionsById.get(entry.customId) : undefined
            return cs ? <Fragment key={entry.customId}>{customSectionNode(cs)}</Fragment> : null
          }
          return <Fragment key={entry.type}>{sectionNodes[entry.type]}</Fragment>
        })}

        {/* ══════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════ */}
        <section className="ak-section py-24 px-6" style={{
          background: `radial-gradient(ellipse 80% 90% at 50% 50%, ${c.ctaGlowRgba} 0%, transparent 70%), ${c.bg}`,
        }}>
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-7"
              style={{ background: c.accentGradient, boxShadow: `0 10px 40px ${c.accentGradientShadow}` }}>
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="mb-4" style={{
              fontFamily: fonts.heading,
              fontSize: 'clamp(1.8rem, 4.5vw, 2.6rem)', fontWeight: 900,
              color: c.textPrimary, lineHeight: 1.1, letterSpacing: '-0.02em',
            }}>
              Ready to start learning?
            </h2>
            <p className="mb-8" style={{ color: mutedSoft, fontSize: '1rem', lineHeight: 1.65 }}>
              Enroll now — get instant access on {deliveryChannelCopy} and the web.
            </p>

            {/* Price */}
            <div className="flex items-baseline justify-center gap-3 mb-7">
              <span style={{ fontFamily: fonts.heading, fontSize: 'clamp(2rem, 5vw, 2.6rem)', fontWeight: 900, color: c.textPrimary, lineHeight: 1 }}>
                {course.is_free_course ? 'Free' : `₹${course.price?.toLocaleString()}`}
              </span>
              {discount > 0 && (
                <>
                  <span style={{ fontSize: '1.1rem', color: c.textFaint, textDecoration: 'line-through' }}>₹{course.original_price?.toLocaleString()}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                    {discount}% OFF
                  </span>
                </>
              )}
            </div>

            <div className="flex justify-center" style={{ width: '100%', maxWidth: 380, margin: '0 auto 24px' }}>
              <CoursePageClient course={courseData} variant="cta" />
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center flex-wrap gap-5">
              {[
                { icon: <Lock className="w-3.5 h-3.5" />, label: 'Secure payment' },
                { icon: <Send className="w-3.5 h-3.5" />, label: 'Telegram & WhatsApp' },
                { icon: <Shield className="w-3.5 h-3.5" />, label: 'Anti-piracy' },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-1.5" style={{ fontSize: '0.87rem', color: faintSoft }}>
                  <span style={{ color: mutedSoft }}>{b.icon}</span>{b.label}
                </div>
              ))}
            </div>
          </div>
        </section>

                  {show('finalCta') && (
          <>
            {/* Reserves space so the fixed bar below never overlaps footer
                content/links. Sized generously since the bar can wrap to
                two lines on narrow screens. */}
            
            <FinalCtaBar
              course={courseData}
              originalPrice={course.original_price}
              discount={discount}
              text={landingConfig.finalCtaText}
              colors={{ navBg: c.navBg, navBorder: c.navBorder, textPrimary: c.textPrimary, textMuted: c.textMuted }}
            />
          </>
        )}

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: `1px solid ${c.border}`, padding: '40px 24px', textAlign: 'center' }}>
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            {course.brand_logo_url ? (
              <>
                <img src={course.brand_logo_url} alt={brandDisplayName} className="h-5 max-w-[100px] object-contain" style={{ opacity: 0.65 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: c.textFaint }}>{brandDisplayName}</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: c.accentGradient }}>
                  <Shield className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold" style={{ color: c.textPrimary }}>{brandDisplayName}</span>
              </>
            )}
          </Link>
          {(course.refund_policy_text || course.refund_window_days > 0) && (
            <p className="mb-4" style={{ color: mutedSoft, fontSize: '0.85rem', lineHeight: 1.7, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
              {course.refund_policy_text
                ? course.refund_policy_text
                : `Refunds accepted within ${course.refund_window_days} day${course.refund_window_days === 1 ? '' : 's'} of purchase.`}
            </p>
          )}
                    {(course.refund_policy_storage_path || course.terms_storage_path || course.privacy_storage_path || (course.show_contact_on_landing && (course.contact_email || course.contact_phone))) && (
            <div className="mb-4 flex items-center justify-center flex-wrap gap-x-5 gap-y-1.5">
              {course.refund_policy_storage_path && (
                <a href={`/policy/${course.id}/refund`} style={{ color: mutedSoft, fontSize: '0.82rem' }}>Refund Policy</a>
              )}
              {course.terms_storage_path && (
                <a href={`/policy/${course.id}/terms`} style={{ color: mutedSoft, fontSize: '0.82rem' }}>Terms &amp; Conditions</a>
              )}
              {course.privacy_storage_path && (
                <a href={`/policy/${course.id}/privacy`} style={{ color: mutedSoft, fontSize: '0.82rem' }}>Privacy Policy</a>
              )}
              {course.show_contact_on_landing && (course.contact_email || course.contact_phone) && (
                <a href={`/contact/${course.id}`} style={{ color: mutedSoft, fontSize: '0.82rem' }}>Contact</a>
              )}
            </div>
          )}
          {creatorProfile?.creator_slug && (
            <div className="mb-4 text-center">
              <a href={`/creator/${creatorProfile.creator_slug}`}
                style={{ color: c.accentText, fontSize: '0.9rem', fontWeight: 600 }}>
                See more courses from {course.host_name || 'this creator'} →
              </a>
            </div>
          )}
        </footer>
        <div aria-hidden className="h-[clamp(112px,18vw,180px)]" />
      </div>
    </DraftGate>
  )
}