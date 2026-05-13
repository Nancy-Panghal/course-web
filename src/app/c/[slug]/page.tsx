import { Shield, Clock, Users, Star, CheckCircle, Lock, ArrowRight, BookOpen, Award, Play } from 'lucide-react'
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
    .select('id, title, content_type, order_num, duration, is_published')
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
          <span className="text-sm hidden sm:block" style={{color:'#a1a1aa'}}>
            Powered by AcademyKit
          </span>
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
            variant="nav"
          />
        </div>
      </nav>

      {/* Hero */}
      <section className="border-b" style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Left */}
          <div className="lg:col-span-2">
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                {text:'🛡️ Piracy Protected', color:'#4ade80', bg:'rgba(74,222,128,0.1)', border:'rgba(74,222,128,0.2)'},
                course.delivery !== 'web' && {text:'💬 WhatsApp Delivery', color:'#8b5cf6', bg:'rgba(124,58,237,0.1)', border:'rgba(124,58,237,0.2)'},
                course.delivery !== 'whatsapp' && {text:'🌐 Web Portal', color:'#3b82f6', bg:'rgba(59,130,246,0.1)', border:'rgba(59,130,246,0.2)'},
                {text:'🏆 Certificate Included', color:'#facc15', bg:'rgba(250,204,21,0.1)', border:'rgba(250,204,21,0.2)'},
              ].filter(Boolean).map((b: any, i) => (
                <span key={i} className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{background:b.bg, color:b.color, border:`1px solid ${b.border}`}}>
                  {b.text}
                </span>
              ))}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {course.name}
            </h1>
            <p className="text-lg mb-6 leading-relaxed" style={{color:'#a1a1aa'}}>
              {course.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-1">
                {Array.from({length:5}).map((_,i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="text-sm font-bold text-white ml-1">5.0</span>
                <span className="text-sm ml-1" style={{color:'#a1a1aa'}}>(New course)</span>
              </div>
              <span className="text-sm" style={{color:'#a1a1aa'}}>
                <BookOpen className="w-4 h-4 inline mr-1" />
                {publishedLessons.length} lessons
              </span>
              {course.language?.length > 0 && (
                <span className="text-sm" style={{color:'#a1a1aa'}}>
                  🌐 {course.language.join(', ')}
                </span>
              )}
            </div>

            {/* Creator */}
            <div className="flex items-center gap-3 p-4 rounded-2xl"
              style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="w-12 h-12 violet-gradient rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {(course.host_name || creatorProfile?.name || 'C').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold">
                  {course.host_name || creatorProfile?.name || 'Course Creator'}
                </p>
                <p className="text-sm" style={{color:'#a1a1aa'}}>
                  {course.about_creator || 'Course Creator on AcademyKit'}
                </p>
              </div>
            </div>
          </div>

          {/* Right — enrollment card */}
          <div id="enroll" className="lg:col-span-1">
            <div className="rounded-2xl overflow-hidden sticky top-24"
              style={{border:'1px solid rgba(124,58,237,0.3)', background:'#0a0a0a'}}>

              <div className="p-6 border-b" style={{borderColor:'rgba(255,255,255,0.06)'}}>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-4xl font-bold text-white">
                    ₹{course.price.toLocaleString()}
                  </span>
                  {discount > 0 && (
                    <>
                      <span className="text-lg line-through" style={{color:'#52525b'}}>
                        ₹{course.original_price.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold px-2 py-0.5 rounded-lg"
                        style={{background:'rgba(74,222,128,0.15)', color:'#4ade80'}}>
                        {discount}% off
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs" style={{color:'#52525b'}}>One-time payment · Lifetime access</p>
              </div>

              <div className="p-6">
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
                <p className="text-xs text-center mb-4 mt-3" style={{color:'#52525b'}}>
                  Secure payment via Razorpay · 7-day refund policy
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    {icon: BookOpen, text:`${publishedLessons.length} lessons${totalHours > 0 ? ` · ~${totalHours} hours` : ''}`},
                    {icon: Clock, text:'Lifetime access — no expiry'},
                    {icon: Award, text:'Certificate on completion'},
                    {icon: Lock, text:'Piracy-protected delivery'},
                    {icon: Play, text: course.delivery === 'whatsapp' ? 'WhatsApp delivery' : course.delivery === 'web' ? 'Web portal access' : 'WhatsApp + Web access'},
                  ].map((item, i) => {
                    const Icon = item.icon
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm" style={{color:'#a1a1aa'}}>
                        <Icon className="w-4 h-4 flex-shrink-0" style={{color:'#8b5cf6'}} />
                        {item.text}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
                  style={{background:'rgba(74,222,128,0.05)', border:'1px solid rgba(74,222,128,0.15)', color:'#4ade80'}}>
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                  Content protected by AcademyKit Anti-Piracy Shield
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-b py-6"
        style={{borderColor:'rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.01)'}}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {label:'Total Lessons', value:`${publishedLessons.length} lessons`},
              {label:'Estimated Hours', value:`~${totalHours || 1} hours`},
              {label:'Language', value: course.language?.join(', ') || 'English'},
              {label:'Delivery', value: course.delivery === 'both' ? 'Web + WhatsApp' : course.delivery === 'web' ? 'Web Only' : 'WhatsApp Only'},
            ].map((s,i) => (
              <div key={i} className="text-center">
                <p className="font-semibold text-white">{s.value}</p>
                <p className="text-xs mt-1" style={{color:'#52525b'}}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">

          {/* Curriculum */}
          {modules.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Course Curriculum</h2>
              <div className="flex flex-col gap-3">
                {modules.map((module, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden"
                    style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div className="flex items-center justify-between px-5 py-4"
                      style={{background:'rgba(255,255,255,0.03)'}}>
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 violet-gradient rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {String(i+1).padStart(2,'0')}
                        </span>
                        <span className="font-medium text-white text-sm">{module.section}</span>
                      </div>
                      <span className="text-xs" style={{color:'#52525b'}}>
                        {module.lessons.length} lessons
                      </span>
                    </div>
                    <div className="px-5 py-3 flex flex-col gap-2">
                      {module.lessons.map((lesson, j) => (
                        <div key={j} className="flex items-center gap-3 py-1.5">
                          <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{color:'#3f3f46'}} />
                          <span className="text-sm" style={{color:'#71717a'}}>{lesson}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* About creator */}
          {course.about_creator && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-4">About the Instructor</h2>
              <div className="flex items-start gap-4 p-5 rounded-2xl"
                style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="w-14 h-14 violet-gradient rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {(course.host_name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">
                    {course.host_name || 'Course Creator'}
                  </p>
                  <p className="text-sm leading-relaxed" style={{color:'#a1a1aa'}}>
                    {course.about_creator}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sticky */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl p-6"
            style={{background:'#0a0a0a', border:'1px solid rgba(124,58,237,0.3)'}}>
            <p className="font-semibold text-white mb-2">Ready to start?</p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-white">
                ₹{course.price.toLocaleString()}
              </span>
              {discount > 0 && (
                <span className="line-through text-sm" style={{color:'#52525b'}}>
                  ₹{course.original_price.toLocaleString()}
                </span>
              )}
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
              variant="card"
            />
            <p className="text-xs text-center mt-3" style={{color:'#52525b'}}>
              7-day money-back guarantee
            </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <section className="border-t py-16 px-6"
        style={{borderColor:'rgba(255,255,255,0.06)', background:'rgba(124,58,237,0.03)'}}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Start learning today</h2>
          <p className="mb-8" style={{color:'#a1a1aa'}}>
            {course.delivery !== 'web'
              ? 'Your first lesson arrives on WhatsApp within minutes of enrolling.'
              : 'Access your first lesson immediately after enrolling.'}
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
            variant="cta"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8"
        style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 violet-gradient rounded-md flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-white">AcademyKit</span>
          </Link>
          <div className="flex gap-6 text-xs" style={{color:'#52525b'}}>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}