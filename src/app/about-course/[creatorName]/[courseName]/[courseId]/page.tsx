import { Shield, CheckCircle, Lock, BookOpen, Play, Zap, Globe, Calendar, Timer, Send, Star, Users, Award, ChevronRight, Target, Gift, AlertTriangle } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { normalizeLandingConfig, getRenderableSections, hasUrgencyContent, type LandingSectionType } from '@/lib/landing-config'
import CountdownTimer from '@/components/CountdownTimer'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CoursePageClient from '@/components/CoursePageClient'
import CurriculumAccordion from './Curriculumaccordion'
import DraftGate from '@/components/DraftGate'
import { getLandingTheme } from '@/lib/landing-themes'
import { getFontPairOverride } from '@/lib/landing-themes/fontPairs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function freePreviewLabel(config?: string) {
  const labels: Record<string, string> = {
    'nothing free': 'Paid only',
    'completely free': 'Completely free',
    'lesson 1 free': '1 lesson free',
    '2 lessons free': '2 lessons free',
    '3 lessons free': '3 lessons free',
    'module 1 free': 'Module 1 free',
    '2 modules free': '2 modules free',
  }
  return labels[config || 'nothing free'] || 'Paid only'
}

/** Extract YouTube video ID from any youtube URL format */
function getYoutubeId(url?: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
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

  // ── PER-CREATOR RAW HTML OVERRIDE ──────────────────────────────────────
  // Fully opt-in per course row — set by Nancy via the admin-only custom
  // page editor, never a creator self-serve feature. Short-circuits BEFORE
  // any of the theme/lesson/module/live-session queries below, since none
  // of that data is used when a custom page is active. Rendered inside a
  // sandboxed iframe with NO `allow-same-origin`: the custom HTML/CSS/JS
  // runs in a unique opaque origin that cannot read this site's cookies,
  // localStorage, or DOM, and cannot make credentialed requests to the API
  // as the visiting user — that containment, not the CSP header, is the
  // real security boundary here. Still wrapped in DraftGate so draft/live
  // gating applies exactly as it does to every other course.
  if (course.use_custom_override === true && typeof course.custom_page_override === 'string' && course.custom_page_override.trim().length > 0) {
    return (
      <DraftGate
        isPublished={course.is_published}
        courseData={{ id: course.id, name: course.name, creatorSlug: course.slug, creatorName: course.host_name || 'Instructor' }}
      >
        <iframe
          title={`${course.name} — custom page`}
          srcDoc={course.custom_page_override}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          style={{ width: '100%', minHeight: '100vh', border: 'none', display: 'block' }}
        />
      </DraftGate>
    )
  }

  const theme = getLandingTheme(previewThemeId || course.landing_theme)
  const c = theme.colors

  // Font pair override — merges on top of theme's default fonts
  const fontOverride = getFontPairOverride(course.landing_font_pair)
  const fonts = fontOverride
    ? { heading: fontOverride.heading, body: fontOverride.body, googleFontsImportUrl: fontOverride.googleFontsImportUrl }
    : theme.fonts

  // Section visibility + order — driven by landing_config. course.landing_sections
  // (the old flat boolean map) is passed as a legacy fallback so courses configured
  // before this feature existed keep rendering exactly as before until re-saved.
  const landingConfig = normalizeLandingConfig(course.landing_config, course.landing_sections)
  const enabledTypes = new Set(getRenderableSections(landingConfig))
  const show = (key: LandingSectionType) => enabledTypes.has(key)
  const middleOrder = getRenderableSections(landingConfig).filter(
    (t) => t !== 'hero' && t !== 'finalCta'
  )

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
  const promoVideoId = getYoutubeId(course.promo_video_url)
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
    free_preview_config: course.free_preview_config,
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
              <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>{s.label}</div>
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
            <p className="text-center mb-10" style={{ color: c.textMuted, fontSize: '0.95rem' }}>
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
            <p className="text-center mb-10" style={{ color: c.textMuted, fontSize: '0.95rem' }}>
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
                  <span style={{ color: c.textSecondary, fontSize: '0.93rem', lineHeight: 1.65 }}>{item}</span>
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
  const instructorNode = (
    show('instructor') && (
      <section className="ak-section py-18 px-6" style={{ background: c.bg }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="ak-section-title text-center mb-12">Meet your instructor</h2>

          <div className="ak-glow rounded-3xl overflow-hidden"
            style={{ background: c.cardBg, border: `1px solid ${c.accentBorder}` }}>
            <div className="flex flex-col md:flex-row">

              {/* Left accent strip + photo */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center p-8 md:p-10"
                style={{ background: c.accentSoft, borderRight: `1px solid ${c.accentBorder}`, minWidth: 200 }}>
                <div className="w-28 h-28 rounded-2xl overflow-hidden mb-4"
                  style={{ border: `3px solid ${c.accentBorderStrong}` }}>
                  {course.host_image ? (
                    <img src={course.host_image} alt={course.host_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-3xl"
                      style={{ background: c.accentGradient }}>
                      {(course.host_name || creatorProfile?.name || 'C').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p style={{ fontFamily: fonts.heading, fontSize: '1rem', fontWeight: 800, color: c.textPrimary }}>
                    {course.host_name || creatorProfile?.name || 'Course Creator'}
                  </p>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: c.accentText, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>
                    {course.instructor_title || 'Course Instructor'}
                  </p>
                </div>
              </div>

              {/* Right: bio */}
              <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
                <p style={{ color: c.textSecondary, fontSize: '0.95rem', lineHeight: 1.8 }}>
                  {course.about_creator || 'Expert instructor dedicated to helping you master this subject and achieve your goals.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      )
  );
  const testimonialsNode = (
    show('testimonials') && testimonials.length > 0 && (
        <section className="ak-section py-16 px-6" style={{ background: c.sectionAltBg }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="ak-section-title text-center mb-3">What students say</h2>
            <p className="text-center mb-10" style={{ color: c.textMuted, fontSize: '0.95rem' }}>
              Real feedback from people who've taken this course
            </p>
            {testimonials.length <= 2 ? (
              /* 1 or 2 testimonials — centered grid */
              <div className={`grid gap-4 mx-auto ${testimonials.length === 1 ? 'max-w-md' : 'max-w-2xl grid-cols-1 sm:grid-cols-2'}`}>
                {testimonials.map((t, i) => (
                  <div key={i} className="ak-card p-6 flex flex-col gap-3">
                    <div className="ak-stars">{'★'.repeat(t.rating ?? 5)}{'☆'.repeat(5 - (t.rating ?? 5))}</div>
                    <p style={{ color: c.textSecondary, fontSize: '0.9rem', lineHeight: 1.7, flex: 1 }}>"{t.text}"</p>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: c.textPrimary }}>— {t.name}</p>
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
                      <p style={{ color: c.textSecondary, fontSize: '0.9rem', lineHeight: 1.7, flex: 1 }}>"{t.text}"</p>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: c.textPrimary }}>— {t.name}</p>
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
          <p className="text-center mb-10" style={{ color: c.textMuted, fontSize: '0.95rem' }}>
            Lessons arrive directly on Telegram or WhatsApp — no extra app needed
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <CheckCircle className="w-5 h-5" style={{ color: '#4ade80' }} />, title: 'Enroll & Pay', desc: 'Secure Razorpay payment. Your spot is confirmed instantly.' },
              { icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#25D366' }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, title: 'Start on WhatsApp or Telegram', desc: 'Message the bot or tap the Telegram link — lesson 1 arrives straight to your chat.' },
              { icon: <Play className="w-5 h-5" style={{ color: c.accentText }} />, title: 'Learn at Your Pace', desc: 'Mark done, unlock next. Progress syncs across WhatsApp, Telegram, and the web.' },
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
                  <p style={{ fontSize: '0.87rem', color: c.textMuted, lineHeight: 1.65 }}>{step.desc}</p>
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
            <p className="text-center mb-10" style={{ color: c.textMuted, fontSize: '0.95rem' }}>
              Still have questions? Reach out through Telegram or WhatsApp.
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
                    <p style={{ color: c.textSecondary, fontSize: '0.88rem', lineHeight: 1.75 }}>{item.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )
  );
  const refundNode = (
    show('refund') && (course.refund_window_days > 0 || course.refund_policy_text) && (
        <section className="ak-section py-12 px-6">
          <div className="max-w-2xl mx-auto rounded-2xl p-6"
            style={{ background: c.cardBg, border: `1px solid ${c.borderSoft}` }}>
            <h3 style={{ fontWeight: 600, color: c.textPrimary, fontSize: '0.95rem', marginBottom: 8 }}>
              Refund Policy
            </h3>
            <p style={{ color: c.textSecondary, fontSize: '0.85rem', lineHeight: 1.7 }}>
              {course.refund_policy_text
                ? course.refund_policy_text
                : `Refunds accepted within ${course.refund_window_days} day${course.refund_window_days === 1 ? '' : 's'} of purchase.`}
            </p>
          </div>
        </section>
      )
  );

  const bonusesNode = (
    show('bonuses') && landingConfig.bonuses.length > 0 && (
      <section className="ak-section py-16 px-6" style={{ background: c.sectionAltBg }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="ak-section-title text-center mb-3">What's included</h2>
          <p className="text-center mb-10" style={{ color: c.textMuted, fontSize: '0.95rem' }}>
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
                    <p style={{ color: c.textSecondary, fontSize: '0.85rem', lineHeight: 1.65 }}>{bonus.description}</p>
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
              <p style={{ color: c.textSecondary, fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {landingConfig.disclaimer.text}
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  )

const urgencyNode = (
    show('urgency') && hasUrgencyContent(landingConfig.urgency) && (
      <section className="ak-section py-5 px-6" style={{ background: c.accentSoft, borderTop: `1px solid ${c.accentBorder}`, borderBottom: `1px solid ${c.accentBorder}` }}>
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {landingConfig.urgency.endAt && (
            <div className="flex items-center gap-2.5">
              <Timer className="w-4 h-4" style={{ color: c.accentText }} />
              <span style={{ fontSize: '0.85rem', color: c.textSecondary, fontWeight: 500 }}>{landingConfig.urgency.label}</span>
              <CountdownTimer endAt={landingConfig.urgency.endAt} textColor={c.textPrimary} />
            </div>
          )}
          {typeof landingConfig.urgency.seatsAvailable === 'number' && (
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" style={{ color: c.accentText }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: c.textPrimary }}>
                {landingConfig.urgency.seatsAvailable}
              </span>
              <span style={{ fontSize: '0.85rem', color: c.textSecondary, fontWeight: 500 }}>{landingConfig.urgency.seatsLabel}</span>
            </div>
          )}
        </div>
      </section>
    )
  )

const sectionNodes: Partial<Record<LandingSectionType, ReactNode>> = {
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
    refund: refundNode,
    disclaimer: disclaimerNode,
  }

  return (
    <DraftGate isPublished={course.is_published} courseData={courseData}>
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
        .ak-stars { color: #f59e0b; letter-spacing: 1px; font-size: 13px; }
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
              {(course.free_preview_config === 'completely free' ||
                freePreviewLabel(course.free_preview_config) !== 'Paid only' ||
                course.category) && (
                <div className="fu fu1 flex mb-5" style={{ justifyContent: promoVideoId ? 'flex-start' : 'center' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                    fontWeight: 700, color: c.accentText,
                    background: c.accentSoft, border: `1px solid ${c.accentBorder}`,
                    padding: '5px 16px', borderRadius: 999,
                  }}>
                    {course.free_preview_config === 'completely free'
                      ? '✦ Completely free — Enroll now'
                      : freePreviewLabel(course.free_preview_config) !== 'Paid only'
                        ? `✦ ${freePreviewLabel(course.free_preview_config)} — Try before you buy`
                        : course.category}
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
                  {course.free_preview_config === 'completely free' ? 'Free' : `₹${course.price?.toLocaleString()}`}
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
              <div className="fu fu5 flex flex-col gap-3 mb-5" style={{ width: '100%' }}>
                <div style={{ width: '100%', maxWidth: 360 }}>
                  <CoursePageClient course={courseData} variant="cta" />
                </div>
                <p style={{ fontSize: 12, color: c.textFaint }}>🔒 Secure payment · Instant access · Anti-piracy protected</p>
              </div>
              )}

              {/* Channel badges — only shown here when there's NO video */}
              {!promoVideoId && (
              <div className="fu fu5 flex flex-wrap gap-2">
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
              <div className="flex flex-wrap justify-center gap-5">
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
                    {course.free_preview_config === 'completely free' ? 'Free' : `₹${course.price?.toLocaleString()}`}
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
                <div style={{ width: '100%', maxWidth: 360 }}>
                  <CoursePageClient course={courseData} variant="cta" />
                </div>
                <p style={{ fontSize: 12, color: c.textFaint }}>🔒 Secure payment · Instant access · Anti-piracy protected</p>
              </div>

              {/* WhatsApp / Telegram / Web Access pills */}
              <div className="flex flex-wrap justify-center gap-5">
                {[
                  { icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, label: 'WhatsApp', color: '#25D366' },
                  { icon: <Send className="w-3.5 h-3.5" />, label: 'Telegram', color: '#38bdf8' },
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
      
      {middleOrder.map((type) => (
        <Fragment key={type}>{sectionNodes[type]}</Fragment>
      ))}

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
          <p className="mb-8" style={{ color: c.textMuted, fontSize: '1rem', lineHeight: 1.65 }}>
            Enroll now — get instant access on Telegram and the web.
          </p>

          {/* Price */}
          <div className="flex items-baseline justify-center gap-3 mb-7">
            <span style={{ fontFamily: fonts.heading, fontSize: 'clamp(2rem, 5vw, 2.6rem)', fontWeight: 900, color: c.textPrimary, lineHeight: 1 }}>
              {course.free_preview_config === 'completely free' ? 'Free' : `₹${course.price?.toLocaleString()}`}
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

          <div style={{ width: '100%', maxWidth: 380, margin: '0 auto 24px' }}>
            <CoursePageClient course={courseData} variant="cta" />
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center flex-wrap gap-5">
            {[
              { icon: <Lock className="w-3.5 h-3.5" />, label: 'Secure payment' },
              { icon: <Send className="w-3.5 h-3.5" />, label: 'Telegram & WhatsApp' },
              { icon: <Shield className="w-3.5 h-3.5" />, label: 'Anti-piracy' },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-1.5" style={{ fontSize: '0.82rem', color: c.textFaint }}>
                <span style={{ color: c.textMuted }}>{b.icon}</span>{b.label}
              </div>
            ))}
          </div>
        </div>
      </section>

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
        {creatorProfile?.creator_slug && (
          <div className="mb-4 text-center">
            <a href={`/creator/${creatorProfile.creator_slug}`}
              style={{ color: c.accentText, fontSize: '0.9rem', fontWeight: 600 }}>
              See more courses from {course.host_name || 'this creator'} →
            </a>
          </div>
        )}
        <p style={{ fontSize: 11, color: c.textFaint }}>
          Powered by Kurso · Anti-piracy protected · Telegram delivery
        </p>
      </footer>
    </div>
    </DraftGate>
  )
}