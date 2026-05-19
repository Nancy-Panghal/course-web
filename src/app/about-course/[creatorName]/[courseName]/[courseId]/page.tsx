import { Shield, Clock, CheckCircle, Lock, BookOpen, Play, ChevronDown, Zap, Globe, Calendar, Timer, Send } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CoursePageClient from '@/components/CoursePageClient'

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
  params
}: {
  params: Promise<{ creatorName: string, courseName: string, courseId: string }>
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

  const publishedLessons = lessons || []
  const modules = courseModules || []

  const groupedModules = modules.length > 0
    ? modules.map(mod => ({
        name: mod.name,
        lessons: publishedLessons.filter(l => l.module_id === mod.id),
      }))
    : publishedLessons.length > 0
      ? [{ name: 'Course Content', lessons: publishedLessons }]
      : []

  if (modules.length > 0) {
    const unassigned = publishedLessons.filter(l => !l.module_id)
    if (unassigned.length > 0) groupedModules.push({ name: 'Additional Lessons', lessons: unassigned })
  }

  let firstLessonVideoId = ''
  if (publishedLessons.length > 0 && publishedLessons[0].content_type === 'video') {
    const url = publishedLessons[0].content_url
    if (url.includes('v=')) firstLessonVideoId = url.split('v=')[1].split('&')[0]
    else if (url.includes('youtu.be/')) firstLessonVideoId = url.split('youtu.be/')[1].split('?')[0]
  }

  const discount = course.original_price && course.original_price > course.price
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
    telegramBotUsername: creatorProfile?.telegram_bot_username || '',
    free_preview_config: course.free_preview_config,
  }

  return (
    <div className="min-h-screen text-white" style={{ background: '#080808', fontFamily: "'DM Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Playfair+Display:wght@700;800;900&display=swap');

        * { box-sizing: border-box; }

        .ak-hero-bg {
          background:
            radial-gradient(ellipse 90% 55% at 50% -5%, rgba(124,58,237,0.22) 0%, transparent 65%),
            radial-gradient(ellipse 40% 40% at 85% 15%, rgba(99,102,241,0.07) 0%, transparent 60%),
            #080808;
        }

        .ak-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        }

        .ak-sticky-bar {
          background: rgba(8,8,8,0.88);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .ak-lesson-row:hover { background: rgba(124,58,237,0.06); }

        .ak-glow-ring {
          box-shadow: 0 0 0 1px rgba(124,58,237,0.25), 0 0 48px rgba(124,58,237,0.07);
        }

        .ak-stat-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          transition: border-color 0.2s, background 0.2s;
        }
        .ak-stat-card:hover {
          border-color: rgba(124,58,237,0.35);
          background: rgba(124,58,237,0.04);
        }

        details summary::-webkit-details-marker { display: none; }
        details[open] .faq-chevron { transform: rotate(180deg); }
        .faq-chevron { transition: transform 0.25s; }

        .ak-module-header {
          background: linear-gradient(90deg, rgba(124,58,237,0.09) 0%, transparent 100%);
          border-left: 3px solid #7c3aed;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards; }
        .fade-up-1 { animation-delay: 0.05s; opacity: 0; }
        .fade-up-2 { animation-delay: 0.15s; opacity: 0; }
        .fade-up-3 { animation-delay: 0.25s; opacity: 0; }
        .fade-up-4 { animation-delay: 0.35s; opacity: 0; }
        .fade-up-5 { animation-delay: 0.45s; opacity: 0; }
      `}</style>

      <div className="ak-grain" />

      {/* ── NAV — logo only, no enroll button ── */}
      <nav className="ak-sticky-bar sticky top-0 z-50 px-6 py-3.5 flex items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white text-sm tracking-tight">AcademyKit</span>
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section className="ak-hero-bg pt-16 pb-0 px-6 relative overflow-hidden">
        <div className="max-w-3xl mx-auto text-center">

          {/* Top badge */}
          <div className="fade-up fade-up-1 flex justify-center mb-6">
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase',
              fontWeight: 700, color: '#a78bfa',
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.28)',
              padding: '6px 16px', borderRadius: '999px',
            }}>
              ✦ {freePreviewLabel(course.free_preview_config) !== 'Paid only'
                ? `${freePreviewLabel(course.free_preview_config)} — Try before you buy`
                : 'Professional Course'}
            </span>
          </div>

          {/* Title */}
          <h1 className="fade-up fade-up-2 mb-6" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(2.2rem, 6vw, 3.8rem)',
            fontWeight: 900, lineHeight: 1.08,
            letterSpacing: '-0.02em', color: '#ffffff',
          }}>
            {course.name}
          </h1>

          {/* Description — bigger and brighter */}
          <p className="fade-up fade-up-3 mx-auto mb-8 leading-relaxed" style={{
            color: '#a1a1aa', fontSize: '1.05rem', maxWidth: '580px',
          }}>
            {course.description}
          </p>

          {/* Delivery badges */}
          <div className="fade-up fade-up-3 flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              { icon: <Send className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} />, text: 'Delivered on Telegram', color: '#38bdf8' },
              { icon: <Globe className="w-3.5 h-3.5" style={{ color: '#4ade80' }} />, text: 'Web Access Included', color: '#4ade80' },
            ].map((b, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '999px', fontSize: '12px',
                fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: b.color,
              }}>
                {b.icon}{b.text}
              </span>
            ))}
          </div>

          {/* Meta pills */}
          <div className="fade-up fade-up-4 flex flex-wrap items-center justify-center gap-2 mb-12">
            {[
              { icon: <Calendar className="w-3.5 h-3.5" />, text: course.start_date || 'Instant Access' },
              { icon: <Clock className="w-3.5 h-3.5" />, text: course.start_time || 'Self-paced' },
              { icon: <Timer className="w-3.5 h-3.5" />, text: course.duration || `${publishedLessons.length} lessons` },
              { icon: <Globe className="w-3.5 h-3.5" />, text: course.language?.join(', ') || 'English' },
              { icon: <BookOpen className="w-3.5 h-3.5" />, text: `${publishedLessons.length} Lessons` },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
                <span style={{ color: '#7c3aed' }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="fade-up fade-up-4 flex items-baseline justify-center gap-4 mb-6">
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.8rem', fontWeight: 900, color: '#ffffff' }}>
              ₹{course.price.toLocaleString()}
            </span>
            {discount > 0 && (
              <>
                <span className="text-xl line-through" style={{ color: '#3f3f46' }}>
                  ₹{course.original_price.toLocaleString()}
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                  {discount}% OFF
                </span>
              </>
            )}
          </div>

          {/* Hero CTA — centered */}
          <div className="fade-up fade-up-5 flex flex-col items-center gap-3 mb-4">
            <div style={{ width: '100%', maxWidth: '380px' }}>
              <CoursePageClient course={courseData} variant="cta" />
            </div>
            <p className="text-xs" style={{ color: '#3f3f46' }}>
              🔒 Secure payment · Instant Telegram access · Anti-piracy protected
            </p>
          </div>

          {/* Preview — flush bottom */}
          <div className="mt-14 max-w-3xl mx-auto">
            {firstLessonVideoId ? (
              <div className="relative aspect-video rounded-t-2xl overflow-hidden"
                style={{ border: '1px solid rgba(124,58,237,0.2)', borderBottom: 'none', boxShadow: '0 0 0 1px rgba(124,58,237,0.12), 0 -16px 48px rgba(124,58,237,0.08)' }}>
                <img
                  src={`https://img.youtube.com/vi/${firstLessonVideoId}/maxresdefault.jpg`}
                  className="w-full h-full object-cover"
                  alt="Course Preview"
                  style={{ filter: 'brightness(0.65)' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(124,58,237,0.92)', boxShadow: '0 8px 32px rgba(124,58,237,0.55)' }}>
                    <Play className="w-7 h-7 text-white fill-white ml-1" />
                  </div>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.65)', color: '#d4d4d8', backdropFilter: 'blur(8px)' }}>
                    Free Preview · {publishedLessons[0]?.title}
                  </span>
                </div>
              </div>
            ) : publishedLessons.length > 0 ? (
              <div className="rounded-t-2xl overflow-hidden p-5 flex items-center gap-5"
                style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)', borderBottom: 'none' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
                <div className="text-left">
                  <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: '#7c3aed', marginBottom: '2px' }}>Free Preview</p>
                  <p className="text-sm font-bold text-white">{publishedLessons[0].title}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── WHAT YOU'LL LEARN ── */}
      {course.what_you_will_learn && course.what_you_will_learn.length > 0 && (
        <section className="py-20 px-6" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-center mb-12" style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
              fontWeight: 800, color: '#ffffff',
            }}>
              What you'll walk away with
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {course.what_you_will_learn.map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-4 p-5 rounded-2xl ak-stat-card">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(124,58,237,0.13)', border: '1px solid rgba(124,58,237,0.22)' }}>
                    <CheckCircle className="w-4 h-4" style={{ color: '#a78bfa' }} />
                  </div>
                  <p className="text-base leading-relaxed" style={{ color: '#d4d4d8' }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CURRICULUM ── */}
      {groupedModules.length > 0 && (
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-center mb-3" style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
              fontWeight: 800, color: '#ffffff',
            }}>
              Course Curriculum
            </h2>
            <p className="text-center mb-10" style={{ color: '#71717a', fontSize: '1rem' }}>
              {publishedLessons.length} lessons · {groupedModules.length} {groupedModules.length === 1 ? 'section' : 'sections'} · Telegram + Web delivery
            </p>

            <div className="flex flex-col gap-3">
              {groupedModules.map((mod, i) => (
                <details key={i} open={i === 0} className="rounded-2xl overflow-hidden group"
                  style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                  <summary className="ak-module-header px-6 py-4 cursor-pointer flex items-center justify-between list-none select-none">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <span className="text-sm font-bold" style={{ color: '#e4e4e7' }}>{mod.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#71717a' }}>
                        {mod.lessons.length} lessons
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 faq-chevron" style={{ color: '#52525b' }} />
                  </summary>

                  <div style={{ background: 'rgba(0,0,0,0.25)' }}>
                    {mod.lessons.map((lesson, j) => (
                      <div key={j} className="ak-lesson-row flex items-center gap-4 px-6 py-3.5 transition-colors"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                          style={{ background: 'rgba(255,255,255,0.04)', color: '#52525b' }}>
                          {String(j + 1).padStart(2, '0')}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {lesson.content_type === 'video'
                            ? <Play className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7c3aed' }} />
                            : <BookOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                          }
                          <span className="text-sm truncate" style={{ color: '#d4d4d8' }}>{lesson.title}</span>
                        </div>
                        {lesson.duration && (
                          <span className="text-xs flex-shrink-0" style={{ color: '#52525b' }}>{lesson.duration}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── HOW DELIVERY WORKS ── */}
      <section className="py-20 px-6" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center mb-3" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
            fontWeight: 800, color: '#ffffff',
          }}>
            How course delivery works
          </h2>
          <p className="text-center mb-12" style={{ color: '#71717a', fontSize: '1rem' }}>
            Get your lessons directly inside Telegram — no app downloads needed
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '01',
                icon: <CheckCircle className="w-6 h-6" style={{ color: '#4ade80' }} />,
                title: 'Enroll & Pay',
                desc: 'Complete secure payment via Razorpay. Your spot is confirmed instantly.',
              },
              {
                step: '02',
                icon: <Send className="w-6 h-6" style={{ color: '#38bdf8' }} />,
                title: 'Start on Telegram',
                desc: 'Tap the Telegram button after enrollment. Our bot delivers your first lesson straight to your chat.',
              },
              {
                step: '03',
                icon: <Play className="w-6 h-6" style={{ color: '#a78bfa' }} />,
                title: 'Learn at Your Pace',
                desc: 'Mark lessons done, track progress, unlock the next. All inside Telegram or the web.',
              },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl ak-stat-card flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'rgba(255,255,255,0.04)', fontFamily: "'Playfair Display', serif" }}>
                    {item.step}
                  </span>
                </div>
                <div>
                  <p className="font-bold mb-2" style={{ color: '#e4e4e7', fontSize: '1rem' }}>{item.title}</p>
                  <p className="leading-relaxed" style={{ color: '#71717a', fontSize: '0.9rem' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INSTRUCTOR ── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center mb-12" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
            fontWeight: 800, color: '#ffffff',
          }}>
            Meet your instructor
          </h2>

          <div className="flex flex-col md:flex-row gap-8 items-start p-8 rounded-3xl ak-glow-ring"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(124,58,237,0.18)' }}>
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="w-28 h-28 rounded-2xl overflow-hidden"
                style={{ border: '2px solid rgba(124,58,237,0.35)', boxShadow: '0 8px 32px rgba(124,58,237,0.22)' }}>
                {course.host_image ? (
                  <img src={course.host_image} alt={course.host_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-3xl"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                    {(course.host_name || creatorProfile?.name || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <h3 className="mb-1" style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1.5rem', fontWeight: 800, color: '#ffffff',
              }}>
                {course.host_name || creatorProfile?.name || 'Course Creator'}
              </h3>
              <p className="mb-5 font-semibold" style={{ color: '#a78bfa', fontSize: '0.85rem', letterSpacing: '0.06em' }}>
                Course Instructor
              </p>
              <p className="leading-relaxed" style={{ color: '#a1a1aa', fontSize: '0.95rem' }}>
                {course.about_creator || 'Expert instructor dedicated to helping you master this subject.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      {course.faq && course.faq.length > 0 && (
        <section className="py-20 px-6" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="max-w-2xl mx-auto">
            <h2 className="text-center mb-12" style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
              fontWeight: 800, color: '#ffffff',
            }}>
              Frequently asked questions
            </h2>

            <div className="flex flex-col gap-2">
              {course.faq.map((item: any, i: number) => (
                <details key={i} className="group rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none select-none gap-4">
                    <span className="font-semibold leading-snug" style={{ color: '#e4e4e7', fontSize: '0.95rem' }}>{item.question}</span>
                    <ChevronDown className="w-4 h-4 faq-chevron flex-shrink-0" style={{ color: '#52525b' }} />
                  </summary>
                  <div className="px-5 pb-5">
                    <div className="w-full h-px mb-4" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    <p className="leading-relaxed" style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>{item.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-6" style={{
        background: 'radial-gradient(ellipse 70% 90% at 50% 50%, rgba(124,58,237,0.12) 0%, transparent 70%)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 40px rgba(124,58,237,0.45)' }}>
            <Zap className="w-8 h-8 text-white" />
          </div>

          <h2 className="mb-3" style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(1.8rem, 4.5vw, 2.6rem)',
            fontWeight: 900, color: '#ffffff', lineHeight: 1.1,
          }}>
            Ready to start learning?
          </h2>

          <p className="mb-10 leading-relaxed" style={{ color: '#71717a', fontSize: '1rem' }}>
            Enroll now and get instant access on Telegram and the web.
          </p>

          <div className="flex items-baseline justify-center gap-3 mb-6">
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.4rem', fontWeight: 900, color: '#ffffff' }}>
              ₹{course.price.toLocaleString()}
            </span>
            {discount > 0 && (
              <>
                <span className="text-lg line-through" style={{ color: '#3f3f46' }}>₹{course.original_price.toLocaleString()}</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                  {discount}% OFF
                </span>
              </>
            )}
          </div>

          {/* Centered CTA */}
          <div style={{ width: '100%', maxWidth: '380px', margin: '0 auto' }}>
            <CoursePageClient course={courseData} variant="cta" />
          </div>

          <div className="flex items-center justify-center gap-6 mt-6">
            {[
              { icon: <Lock className="w-3.5 h-3.5" />, text: 'Secure payment' },
              { icon: <Send className="w-3.5 h-3.5" />, text: 'Telegram delivery' },
              { icon: <Shield className="w-3.5 h-3.5" />, text: 'Anti-piracy' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5" style={{ color: '#52525b', fontSize: '0.85rem' }}>
                <span style={{ color: '#3f3f46' }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '40px 24px', textAlign: 'center' }}>
        <Link href="/" className="inline-flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            <Shield className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-bold text-white">AcademyKit</span>
        </Link>
        <p className="text-xs" style={{ color: '#27272a' }}>Powered by AcademyKit · Anti-piracy protected · Telegram delivery</p>
      </footer>
    </div>
  )
}