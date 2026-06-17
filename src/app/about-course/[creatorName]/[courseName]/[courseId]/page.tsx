import { Shield, Clock, CheckCircle, Lock, BookOpen, Play, Zap, Globe, Calendar, Timer, Send } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CoursePageClient from '@/components/CoursePageClient'

import CurriculumAccordion from './Curriculumaccordion'
import DraftGate from '@/components/DraftGate'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function freePreviewLabel(config?: string) {
  const labels: Record<string, string> = {
    'nothing free': 'Paid only',
    'lesson 1 free': '1 lesson free',
    '2 lessons free': '2 lessons free',
    '3 lessons free': '3 lessons free',
    'module 1 free': 'Module 1 free',
    '2 modules free': '2 modules free',
  }
  return labels[config || 'nothing free'] || 'Paid only'
}

export default async function AboutCoursePage({
  params,
}: {
  params: Promise<{ creatorName: string; courseName: string; courseId: string }>
}) {
  const { courseId } = await params

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single()

  if (!course || courseError) notFound()

  const { data: creatorProfile } = await supabase
    .from('creators')
    .select('id, name, email, whatsapp_number, telegram_bot_username')
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

  // Fetch live sessions for this course
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
          lessons: publishedLessons.filter(l => l.module_id === mod.id),
        }))
      : publishedLessons.length > 0
      ? [{ name: 'Course Content', lessons: publishedLessons }]
      : []

  if (modules.length > 0) {
    const unassigned = publishedLessons.filter(l => !l.module_id)
    if (unassigned.length > 0)
      groupedModules.push({ name: 'Additional Lessons', lessons: unassigned })
  }

  let firstLessonVideoId = ''
  if (publishedLessons.length > 0 && publishedLessons[0].content_type === 'video') {
    const url = publishedLessons[0].content_url
    if (url.includes('v=')) firstLessonVideoId = url.split('v=')[1].split('&')[0]
    else if (url.includes('youtu.be/'))
      firstLessonVideoId = url.split('youtu.be/')[1].split('?')[0]
  }

  const discount =
    course.original_price && course.original_price > course.price
      ? Math.round(((course.original_price - course.price) / course.original_price) * 100)
      : 0

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

  return (
    <DraftGate isPublished={course.is_published} courseData={courseData}>
    <div
      className="min-h-screen text-white"
      style={{ background: '#080808', fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        /* ── hero purple glow ── */
        .ak-hero {
          background:
            radial-gradient(ellipse 100% 60% at 50% -5%, rgba(124,58,237,0.2) 0%, transparent 65%),
            #080808;
        }

        /* ── nav ── */
        .ak-nav {
          background: rgba(8,8,8,0.9);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        /* ── subtle section divider ── */
        .ak-section {
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        /* ── stat card ── */
        .ak-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          transition: border-color 0.2s;
        }
        .ak-card:hover { border-color: rgba(124,58,237,0.3); }

        /* ── glow ring for instructor card ── */
        .ak-glow {
          box-shadow: 0 0 0 1px rgba(124,58,237,0.2), 0 8px 48px rgba(124,58,237,0.06);
        }

        /* ── FAQ accordion ── */
        details summary::-webkit-details-marker { display: none; }
        details[open] .faq-icon { transform: rotate(45deg); }
        .faq-icon { transition: transform 0.22s; }

        /* ── fade-up animation ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fu  { animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        .fu1 { animation-delay: 0.05s; }
        .fu2 { animation-delay: 0.15s; }
        .fu3 { animation-delay: 0.25s; }
        .fu4 { animation-delay: 0.35s; }
        .fu5 { animation-delay: 0.45s; }
      `}</style>

      {/* ── NAV ── */}
      <nav className="ak-nav sticky top-0 z-50 px-6 py-4 flex items-center">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">AcademyKit</span>
        </Link>
      </nav>

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <section className="ak-hero px-6 pt-16 pb-0">
        <div className="max-w-2xl mx-auto text-center">

          {/* Badge */}
          <div className="fu fu1 flex justify-center mb-5">
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, letterSpacing: '0.13em', textTransform: 'uppercase',
                fontWeight: 700, color: '#a78bfa',
                background: 'rgba(124,58,237,0.1)',
                border: '1px solid rgba(124,58,237,0.25)',
                padding: '5px 14px', borderRadius: 999,
              }}
            >
              ✦{' '}
              {freePreviewLabel(course.free_preview_config) !== 'Paid only'
                ? `${freePreviewLabel(course.free_preview_config)} — Try before you buy`
                : 'Professional Course'}
            </span>
          </div>

          {/* Title */}
          <h1
            className="fu fu2 mb-5"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(2rem, 5.5vw, 3.4rem)',
              fontWeight: 900, lineHeight: 1.1,
              letterSpacing: '-0.02em', color: '#fff',
            }}
          >
            {course.name}
          </h1>

          {/* Description */}
          <p
            className="fu fu3 mx-auto mb-7"
            style={{ color: '#a1a1aa', fontSize: '1rem', lineHeight: 1.7, maxWidth: 520 }}
          >
            {course.description}
          </p>

          {/* Delivery tags */}
          <div className="fu fu3 flex flex-wrap justify-center gap-2 mb-7">
            {[
              { icon: <Send className="w-3.5 h-3.5" />, label: 'Delivered on Telegram', color: '#38bdf8' },
              { icon: <Globe className="w-3.5 h-3.5" />, label: 'Web Access Included', color: '#4ade80' },
            ].map((t, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 13px', borderRadius: 999,
                  fontSize: 12, fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.09)',
                  background: 'rgba(255,255,255,0.03)', color: t.color,
                }}
              >
                {t.icon}{t.label}
              </span>
            ))}
          </div>

          {/* Meta pills */}
          <div className="fu fu4 flex flex-wrap justify-center gap-2 mb-10">
            {[
              { icon: <Calendar className="w-3.5 h-3.5" />, text: course.start_date || 'Instant Access' },
              { icon: <Clock className="w-3.5 h-3.5" />, text: course.start_time || 'Self-paced' },
              { icon: <Timer className="w-3.5 h-3.5" />, text: course.duration || `${publishedLessons.length} lessons` },
              { icon: <Globe className="w-3.5 h-3.5" />, text: course.language?.join(', ') || 'English' },
              { icon: <BookOpen className="w-3.5 h-3.5" />, text: `${publishedLessons.length} Lessons` },
            ].map((p, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 999,
                  fontSize: 12, fontWeight: 500,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: '#a1a1aa',
                }}
              >
                <span style={{ color: '#7c3aed' }}>{p.icon}</span>
                {p.text}
              </span>
            ))}
          </div>

          {/* Price */}
          <div className="fu fu4 flex items-baseline justify-center gap-3 mb-5">
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '2.6rem', fontWeight: 900, color: '#fff',
              }}
            >
              ₹{course.price.toLocaleString()}
            </span>
            {discount > 0 && (
              <>
                <span style={{ fontSize: '1.1rem', color: '#3f3f46', textDecoration: 'line-through' }}>
                  ₹{course.original_price.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 999,
                    background: 'rgba(74,222,128,0.1)',
                    color: '#4ade80',
                    border: '1px solid rgba(74,222,128,0.22)',
                  }}
                >
                  {discount}% OFF
                </span>
              </>
            )}
          </div>

          {/* CTA — centered, fixed width so it never goes off edge */}
          <div className="fu fu5 flex flex-col items-center gap-3 mb-4">
            <div style={{ width: '100%', maxWidth: 360 }}>
              <CoursePageClient course={courseData} variant="cta" />
            </div>
            <p style={{ fontSize: 12, color: '#3f3f46' }}>
              🔒 Secure payment · Instant Telegram access · Anti-piracy protected
            </p>
          </div>


        </div>
      </section>

      {/* ══════════════════════════════════════════
          CURRICULUM — client component (one open at a time)
      ══════════════════════════════════════════ */}
      {groupedModules.length > 0 && (
        <section className="ak-section" style={{ background: '#080808' }}>
          <CurriculumAccordion
            modules={groupedModules}
            totalLessons={publishedLessons.length}
            liveSessions={liveSessions || []}
          />
        </section>
      )}

      {/* ══════════════════════════════════════════
          WHAT YOU'LL LEARN
      ══════════════════════════════════════════ */}
      {course.what_you_will_learn && course.what_you_will_learn.length > 0 && (
        <section className="ak-section py-20 px-6" style={{ background: 'rgba(255,255,255,0.01)' }}>
          <div className="max-w-4xl mx-auto">
            <h2
              className="text-center mb-10"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                fontWeight: 800, color: '#fff',
              }}
            >
              What you'll walk away with
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {course.what_you_will_learn.map((item: string, i: number) => (
                <div key={i} className="ak-card flex items-start gap-4 p-5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
                  </div>
                  <p style={{ color: '#d4d4d8', fontSize: '0.9rem', lineHeight: 1.65 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════ */}
      <section className="ak-section py-20 px-6" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-center mb-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 800, color: '#fff',
            }}
          >
            How course delivery works
          </h2>
          <p className="text-center mb-12" style={{ color: '#71717a', fontSize: '0.95rem' }}>
            Lessons arrive directly inside Telegram — no extra app needed
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: <CheckCircle className="w-5 h-5" style={{ color: '#4ade80' }} />,
                title: 'Enroll & Pay',
                desc: 'Secure Razorpay payment. Spot confirmed instantly.',
              },
              {
                icon: <Send className="w-5 h-5" style={{ color: '#38bdf8' }} />,
                title: 'Start on Telegram',
                desc: 'Tap the Telegram button. Our bot sends lesson 1 straight to your chat.',
              },
              {
                icon: <Play className="w-5 h-5" style={{ color: '#a78bfa' }} />,
                title: 'Learn at Your Pace',
                desc: 'Mark done, unlock next. Track progress on Telegram or the web.',
              },
            ].map((step, i) => (
              <div key={i} className="ak-card p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {step.icon}
                  </div>
                  <span
                    style={{
                      fontSize: '2rem', fontWeight: 900, lineHeight: 1,
                      color: 'rgba(255,255,255,0.04)',
                      fontFamily: "'Playfair Display', serif",
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e4e4e7', marginBottom: 6 }}>{step.title}</p>
                  <p style={{ fontSize: '0.85rem', color: '#71717a', lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          INSTRUCTOR
      ══════════════════════════════════════════ */}
      <section className="ak-section py-20 px-6" style={{ background: '#080808' }}>
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-center mb-10"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 800, color: '#fff',
            }}
          >
            Meet your instructor
          </h2>

          <div
            className="ak-glow flex flex-col md:flex-row gap-7 items-start p-7 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(124,58,237,0.15)' }}
          >
            {/* Photo */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div
                className="w-24 h-24 rounded-2xl overflow-hidden"
                style={{ border: '2px solid rgba(124,58,237,0.3)' }}
              >
                {course.host_image ? (
                  <img src={course.host_image} alt={course.host_name} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white font-bold text-2xl"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
                  >
                    {(course.host_name || creatorProfile?.name || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            <div className="flex-1 text-center md:text-left">
              <h3
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: 4,
                }}
              >
                {course.host_name || creatorProfile?.name || 'Course Creator'}
              </h3>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>
                Course Instructor
              </p>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: 1.7 }}>
                {course.about_creator || 'Expert instructor dedicated to helping you master this subject.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════ */}
      {course.faq && course.faq.length > 0 && (
        <section className="ak-section py-20 px-6" style={{ background: 'rgba(255,255,255,0.01)' }}>
          <div className="max-w-2xl mx-auto">
            <h2
              className="text-center mb-10"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                fontWeight: 800, color: '#fff',
              }}
            >
              Frequently asked questions
            </h2>

            <div className="flex flex-col gap-2">
              {course.faq.map((item: any, i: number) => (
                <details
                  key={i}
                  className="group rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none select-none gap-4">
                    <span style={{ fontWeight: 600, color: '#e4e4e7', fontSize: '0.9rem', lineHeight: 1.5 }}>
                      {item.question}
                    </span>
                    <span
                      className="faq-icon flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-lg font-light"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', lineHeight: 1 }}
                    >
                      +
                    </span>
                  </summary>
                  <div className="px-5 pb-5">
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 14 }} />
                    <p style={{ color: '#a1a1aa', fontSize: '0.875rem', lineHeight: 1.7 }}>
                      {item.answer}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════ */}
      <section
        className="ak-section py-24 px-6"
        style={{
          background: 'radial-gradient(ellipse 70% 80% at 50% 50%, rgba(124,58,237,0.11) 0%, transparent 70%)',
        }}
      >
        <div className="max-w-md mx-auto text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              boxShadow: '0 8px 36px rgba(124,58,237,0.4)',
            }}
          >
            <Zap className="w-7 h-7 text-white" />
          </div>

          <h2
            className="mb-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(1.7rem, 4vw, 2.4rem)',
              fontWeight: 900, color: '#fff', lineHeight: 1.1,
            }}
          >
            Ready to start learning?
          </h2>

          <p className="mb-8" style={{ color: '#71717a', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Enroll now — get instant access on Telegram and the web.
          </p>

          {/* Price */}
          <div className="flex items-baseline justify-center gap-3 mb-6">
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '2.2rem', fontWeight: 900, color: '#fff',
              }}
            >
              ₹{course.price.toLocaleString()}
            </span>
            {discount > 0 && (
              <>
                <span style={{ fontSize: '1rem', color: '#3f3f46', textDecoration: 'line-through' }}>
                  ₹{course.original_price.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                    background: 'rgba(74,222,128,0.1)', color: '#4ade80',
                    border: '1px solid rgba(74,222,128,0.2)',
                  }}
                >
                  {discount}% OFF
                </span>
              </>
            )}
          </div>

          {/* CTA — centered */}
          <div style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
            <CoursePageClient course={courseData} variant="cta" />
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-5 mt-6">
            {[
              { icon: <Lock className="w-3.5 h-3.5" />, label: 'Secure payment' },
              { icon: <Send className="w-3.5 h-3.5" />, label: 'Telegram delivery' },
              { icon: <Shield className="w-3.5 h-3.5" />, label: 'Anti-piracy' },
            ].map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5"
                style={{ fontSize: '0.8rem', color: '#3f3f46' }}
              >
                <span style={{ color: '#52525b' }}>{b.icon}</span>
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '36px 24px',
          textAlign: 'center',
        }}
      >
        <Link href="/" className="inline-flex items-center gap-2 mb-3">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
          >
            <Shield className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-bold text-white">AcademyKit</span>
        </Link>
        <p style={{ fontSize: 11, color: '#27272a' }}>
          Powered by AcademyKit · Anti-piracy protected · Telegram delivery
        </p>
      </footer>
    </div>
    </DraftGate>
  )
}