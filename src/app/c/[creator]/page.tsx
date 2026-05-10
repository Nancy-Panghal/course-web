import Link from 'next/link'
import { Shield, Play, Clock, Users, Star, CheckCircle, Lock, ArrowRight, BookOpen, Award } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'

// ── MOCK DATA (replace with real DB fetch later) ──
const mockCourse = {
  creatorSlug: 'rahul-sharma',
  creatorName: 'Rahul Sharma',
  creatorBio: 'SEO Expert with 8 years of experience. Helped 200+ businesses rank on Google. YouTube creator with 45K subscribers.',
  creatorAvatar: 'RS',
  courseName: 'SEO Masterclass 2026',
  courseDesc: 'Learn everything about SEO from scratch — keyword research, on-page optimization, link building, and ranking strategies that actually work in 2026.',
  price: 4999,
  originalPrice: 9999,
  totalLessons: 24,
  totalHours: 12,
  totalStudents: 1247,
  rating: 4.9,
  reviews: 312,
  lastUpdated: 'May 2026',
  language: 'Hindi + English',
  deliveryMethod: 'WhatsApp + Web Portal',
  highlights: [
    'Lifetime access via WhatsApp — learn at your own pace',
    'Certificate of completion sent directly to WhatsApp',
    'Private community access for Q&A',
    '60-minute expiring links — fully piracy protected',
    'Works on any phone — no app download needed',
    'Direct support from Rahul via WhatsApp',
  ],
  curriculum: [
    { section: 'Module 1 — Foundations', lessons: ['What is SEO in 2026', 'How Google ranks pages', 'Setting up your tools'] },
    { section: 'Module 2 — Keyword Research', lessons: ['Finding buyer keywords', 'Competitor keyword gaps', 'Long-tail strategy'] },
    { section: 'Module 3 — On-Page SEO', lessons: ['Title and meta optimization', 'Content structure', 'Internal linking'] },
    { section: 'Module 4 — Link Building', lessons: ['What backlinks matter', 'Outreach templates', 'Guest posting strategy'] },
    { section: 'Module 5 — Technical SEO', lessons: ['Site speed optimization', 'Mobile-first indexing', 'Core Web Vitals'] },
    { section: 'Module 6 — Ranking & Results', lessons: ['Tracking your progress', 'Algorithm updates', 'Scaling your strategy'] },
  ],
  testimonials: [
    { name: 'Priya M.', text: 'Ranked my blog on page 1 within 3 months. The WhatsApp delivery kept me accountable.', rating: 5 },
    { name: 'Arjun K.', text: 'Best SEO course I have taken. No fluff, all actionable. Got my certificate in 3 weeks.', rating: 5 },
    { name: 'Sneha R.', text: 'The expiring links actually made me watch lessons on time instead of procrastinating.', rating: 5 },
  ]
}

export default async function CreatorCoursePage({
  params
}: {
  params: { creator: string }
}) {
  // Later: fetch real creator data from Supabase based on params.creator
  // const { data } = await supabase.from('creators').select('*').eq('slug', params.creator).single()
  // if (!data) notFound()

  const course = mockCourse
  const discount = Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)

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
          <a href="#enroll"
            className="violet-gradient px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-all glow">
            Enroll Now
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="border-b" style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Left — course info */}
          <div className="lg:col-span-2">
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="text-xs px-3 py-1 rounded-full font-medium"
                style={{background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.2)'}}>
                🛡️ Piracy Protected
              </span>
              <span className="text-xs px-3 py-1 rounded-full font-medium"
                style={{background:'rgba(124,58,237,0.1)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.2)'}}>
                💬 WhatsApp Delivery
              </span>
              <span className="text-xs px-3 py-1 rounded-full font-medium"
                style={{background:'rgba(250,204,21,0.1)', color:'#facc15', border:'1px solid rgba(250,204,21,0.2)'}}>
                🏆 Certificate Included
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {course.courseName}
            </h1>
            <p className="text-lg mb-6 leading-relaxed" style={{color:'#a1a1aa'}}>
              {course.courseDesc}
            </p>

            {/* Rating row */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-1">
                {Array.from({length: 5}).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="text-sm font-bold text-white ml-1">{course.rating}</span>
                <span className="text-sm ml-1" style={{color:'#a1a1aa'}}>({course.reviews} reviews)</span>
              </div>
              <span className="text-sm" style={{color:'#a1a1aa'}}>
                <Users className="w-4 h-4 inline mr-1" />{course.totalStudents.toLocaleString()} students
              </span>
              <span className="text-sm" style={{color:'#a1a1aa'}}>
                Updated {course.lastUpdated}
              </span>
            </div>

            {/* Creator */}
            <div className="flex items-center gap-3 p-4 rounded-2xl"
              style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="w-12 h-12 violet-gradient rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {course.creatorAvatar}
              </div>
              <div>
                <p className="text-white font-semibold">{course.creatorName}</p>
                <p className="text-sm" style={{color:'#a1a1aa'}}>{course.creatorBio}</p>
              </div>
            </div>
          </div>

          {/* Right — enrollment card */}
          <div id="enroll" className="lg:col-span-1">
            <div className="rounded-2xl overflow-hidden sticky top-24"
              style={{border:'1px solid rgba(124,58,237,0.3)', background:'#0a0a0a'}}>

              {/* Price */}
              <div className="p-6 border-b" style={{borderColor:'rgba(255,255,255,0.06)'}}>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-4xl font-bold text-white">₹{course.price.toLocaleString()}</span>
                  <span className="text-lg line-through" style={{color:'#52525b'}}>
                    ₹{course.originalPrice.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold px-2 py-0.5 rounded-lg"
                    style={{background:'rgba(74,222,128,0.15)', color:'#4ade80'}}>
                    {discount}% off
                  </span>
                </div>
                <p className="text-xs" style={{color:'#52525b'}}>One-time payment · Lifetime access</p>
              </div>

              {/* CTA */}
              <div className="p-6">
                <a
                  href="#"
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 transition-all glow-strong mb-3"
                >
                  Enroll Now — ₹{course.price.toLocaleString()}
                  <ArrowRight className="w-5 h-5" />
                </a>
                <p className="text-xs text-center mb-4" style={{color:'#52525b'}}>
                  Secure payment via Razorpay · 7-day refund policy
                </p>

                {/* What's included */}
                <div className="flex flex-col gap-3">
                  {[
                    { icon: BookOpen, text: `${course.totalLessons} lessons · ${course.totalHours} hours` },
                    { icon: Clock, text: 'Lifetime access — no expiry' },
                    { icon: Award, text: 'Certificate on completion' },
                    { icon: Lock, text: 'Piracy-protected delivery' },
                    { icon: Play, text: 'WhatsApp + Web access' },
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

              {/* Trust badges */}
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
      <section className="border-b py-6" style={{borderColor:'rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.01)'}}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Lessons', value: `${course.totalLessons} lessons` },
              { label: 'Total Hours', value: `${course.totalHours} hours` },
              { label: 'Language', value: course.language },
              { label: 'Delivery', value: course.deliveryMethod },
            ].map((s, i) => (
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

          {/* What you'll learn */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">What you'll learn</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {course.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{color:'#4ade80'}} />
                  <span className="text-sm" style={{color:'#a1a1aa'}}>{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Curriculum */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Course Curriculum</h2>
            <div className="flex flex-col gap-3">
              {course.curriculum.map((module, i) => (
                <div key={i} className="rounded-2xl overflow-hidden"
                  style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div className="flex items-center justify-between px-5 py-4"
                    style={{background:'rgba(255,255,255,0.03)'}}>
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 violet-gradient rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {String(i + 1).padStart(2, '0')}
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

          {/* Testimonials */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Student Reviews</h2>
            <div className="grid grid-cols-1 gap-4">
              {course.testimonials.map((t, i) => (
                <div key={i} className="p-5 rounded-2xl"
                  style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)'}}>
                  <div className="flex gap-1 mb-3">
                    {Array.from({length: t.rating}).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm mb-3 leading-relaxed" style={{color:'#a1a1aa'}}>"{t.text}"</p>
                  <p className="text-sm font-medium text-white">{t.name}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right — sticky CTA repeat */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl p-6"
            style={{background:'#0a0a0a', border:'1px solid rgba(124,58,237,0.3)'}}>
            <p className="font-semibold text-white mb-2">Ready to start?</p>
            <p className="text-sm mb-4" style={{color:'#a1a1aa'}}>
              Join {course.totalStudents.toLocaleString()} students already learning.
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold text-white">₹{course.price.toLocaleString()}</span>
              <span className="line-through text-sm" style={{color:'#52525b'}}>
                ₹{course.originalPrice.toLocaleString()}
              </span>
            </div>
            <a href="#"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 transition-all glow mb-3">
              Enroll Now
              <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-xs text-center" style={{color:'#52525b'}}>
              7-day money-back guarantee
            </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <section className="border-t py-16 px-6"
        style={{borderColor:'rgba(255,255,255,0.06)', background:'rgba(124,58,237,0.03)'}}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">
            Start learning today
          </h2>
          <p className="mb-8" style={{color:'#a1a1aa'}}>
            Your first lesson arrives on WhatsApp within minutes of enrolling.
          </p>
          <a href="#enroll"
            className="inline-flex items-center gap-2 violet-gradient px-8 py-4 rounded-xl font-semibold text-white hover:opacity-90 transition-all glow-strong">
            Enroll for ₹{course.price.toLocaleString()}
            <ArrowRight className="w-5 h-5" />
          </a>
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