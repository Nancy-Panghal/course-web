import { Shield, Clock, Users, Star, CheckCircle, Lock, ArrowRight, BookOpen, Award, Play, ChevronDown, Plus, Minus } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CoursePageClient from './CoursePageClient'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function CreatorCoursePage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  console.log('Looking for course with slug:', slug)

  // Fetch course by slug — separate queries to avoid join issues
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .single()

  console.log('Course found:', course?.name, 'Error:', courseError?.message)

  if (!course) {
    // Try to find courses and show helpful error
    const { data: allCourses } = await supabase
      .from('courses')
      .select('slug, name')
      .limit(10)

    console.log('Available courses:', allCourses)
    notFound()
  }

  // Fetch creator profile separately
  const { data: creatorProfile } = await supabase
    .from('creators')
    .select('id, name, email, whatsapp_number')
    .eq('id', course.creator_id)
    .single()

  // Fetch published lessons
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, content_type, order_num, duration, is_published, content_url')
    .eq('course_id', course.id)
    .eq('is_published', true)
    .order('order_num', { ascending: true })

  const publishedLessons = lessons || []
  const totalHours = Math.ceil(publishedLessons.length * 20 / 60)
  const discount = course.original_price > course.price
    ? Math.round(((course.original_price - course.price) / course.original_price) * 100)
    : 0

  const modules: { section: string; lessons: string[] }[] = []
  for (let i = 0; i < publishedLessons.length; i += 3) {
    const chunk = publishedLessons.slice(i, i + 3)
    modules.push({
      section: `Module ${Math.floor(i / 3) + 1}`,
      lessons: chunk.map((l: any) => l.title),
    })
  }

  // Get first lesson video thumbnail if it's a YouTube link
  let firstLessonVideoId = ''
  if (publishedLessons.length > 0 && publishedLessons[0].content_type === 'video') {
    const url = publishedLessons[0].content_url
    if (url.includes('v=')) firstLessonVideoId = url.split('v=')[1].split('&')[0]
    else if (url.includes('youtu.be/')) firstLessonVideoId = url.split('youtu.be/')[1].split('?')[0]
  }

  return (
    <div className="min-h-screen bg-black">

      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50"
        style={{background:'rgba(0,0,0,0.9)', backdropFilter:'blur(20px)', borderColor:'rgba(255,255,255,0.06)'}}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 violet-gradient rounded-lg flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">AcademyKit</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest hidden sm:block">
            Course Preview
          </span>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-12 pb-8 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {course.name}
          </h1>
          
          <div className="mb-6 max-w-2xl mx-auto">
            <p className="text-base text-zinc-400">
              {course.description}
            </p>
          </div>

          {/* Small Details Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Date', value: course.start_date || 'Instant Access', icon: '📅' },
              { label: 'Time', value: course.start_time || 'Self-paced', icon: '⏰' },
              { label: 'Duration', value: course.duration || `${publishedLessons.length} Lessons`, icon: '⏳' },
              { label: 'Language', value: course.language?.join(', ') || 'English', icon: '🌐' },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-xl glass text-center"
                style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)'}}>
                <span className="text-lg mb-0.5 block">{item.icon}</span>
                <p className="text-[10px] uppercase font-bold text-zinc-600">{item.label}</p>
                <p className="text-xs font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <CoursePageClient
            course={{
              id: course.id,
              name: course.name,
              price: course.price,
              creatorSlug: slug,
              creatorName: course.host_name || creatorProfile?.name || '',
              creatorId: creatorProfile?.id || '',
              waNumber: creatorProfile?.whatsapp_number || '',
            }}
            variant="cta"
          />
        </div>
      </section>

      {/* First Lesson Preview */}
      {publishedLessons.length > 0 && (
        <section className="pb-12 px-6">
          <div className="max-w-3xl mx-auto">
            {firstLessonVideoId ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-xl group cursor-pointer"
                style={{border:'1px solid rgba(255,255,255,0.1)'}}>
                <img 
                  src={`https://img.youtube.com/vi/${firstLessonVideoId}/maxresdefault.jpg`}
                  className="w-full h-full object-cover"
                  alt="Course Preview"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full violet-gradient flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl glass flex items-center gap-4"
                style={{background:'rgba(124,58,237,0.05)', border:'1px solid rgba(124,58,237,0.1)'}}>
                <div className="w-10 h-10 rounded-xl violet-gradient flex items-center justify-center flex-shrink-0">
                  <Play className="w-5 h-5 text-white fill-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-violet-400 uppercase">Sample Lesson</p>
                  <p className="text-sm font-bold text-white">{publishedLessons[0].title}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Curriculum Section */}
      <section className="py-12 px-6 bg-zinc-950/50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Course Curriculum</h2>
          <div className="grid grid-cols-1 gap-3">
            {modules.map((module, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-white/5">
                <div className="px-5 py-3 bg-white/5 flex justify-between items-center">
                  <span className="text-xs font-bold text-violet-400 uppercase">{module.section}</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">{module.lessons.length} Lessons</span>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {module.lessons.map((lesson, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[10px] text-zinc-600 font-bold">
                        {j + 1}
                      </div>
                      <span className="text-zinc-400 text-xs">{lesson}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Smart Join Now Widget */}
      <section className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl p-8 text-center border border-violet-500/20 bg-violet-500/5">
            <h2 className="text-2xl font-bold text-white mb-3">Start Learning Today</h2>
            <p className="text-sm text-zinc-400 mb-8 max-w-lg mx-auto">
              Enroll now to get instant access to all modules and certificate.
            </p>
            <CoursePageClient
              course={{
                id: course.id,
                name: course.name,
                price: course.price,
                creatorSlug: slug,
                creatorName: course.host_name || creatorProfile?.name || '',
                creatorId: creatorProfile?.id || '',
                waNumber: creatorProfile?.whatsapp_number || '',
              }}
              variant="card"
            />
          </div>
        </div>
      </section>

      {/* Instructor Section */}
      <section className="py-12 px-6 bg-zinc-950/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-8 text-center">About Instructor</h2>
          <div className="flex flex-col md:flex-row items-center gap-8 p-6 rounded-2xl border border-white/5 bg-white/[0.01]">
            <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
              {course.host_image ? (
                <img src={course.host_image} alt={course.host_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full violet-gradient flex items-center justify-center text-white font-bold text-2xl">
                  {(course.host_name || creatorProfile?.name || 'C').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-lg font-bold text-white mb-1">{course.host_name || 'Course Creator'}</h3>
              <p className="text-xs font-bold text-violet-400 uppercase mb-3">Course Host</p>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {course.about_creator || 'Expert instructor dedicated to helping you master this subject.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      {(course.faq && course.faq.length > 0) && (
        <section className="py-12 px-6">
          <div className="max-w-xl mx-auto">
            <h2 className="text-xl font-bold text-white mb-8 text-center">FAQs</h2>
            <div className="flex flex-col gap-2">
              {course.faq.map((item: any, i: number) => (
                <details key={i} className="group rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                  <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                    <h4 className="text-sm font-bold text-white">{item.question}</h4>
                    <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 text-center">
        <Link href="/" className="flex items-center gap-2 justify-center mb-4">
          <div className="w-6 h-6 violet-gradient rounded flex items-center justify-center">
            <Shield className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold text-white">AcademyKit</span>
        </Link>
        <div className="flex justify-center gap-6 text-[10px] font-bold uppercase text-zinc-600">
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/contact" className="hover:text-white">Support</Link>
        </div>
      </footer>
    </div>
  )
}