'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, MessageCircle, Send, ListChecks, LayoutDashboard,
  Award, Lock, Wallet, Video, CheckCircle, ArrowRight, Play, Sparkles
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import { resolveAccountType } from '@/lib/account'

// TODO: paste your screen-recording link here (YouTube embed URL or hosted .mp4)
// e.g. 'https://www.youtube.com/embed/XXXXXXXXXXX'
// Leave empty to show the "coming soon" placeholder.
const DEMO_VIDEO_URL = ''

// ─── DATA ───
const features = [
  {
    icon: MessageCircle,
    title: 'WhatsApp Lesson Delivery',
    desc: 'Students enroll via a link and get each lesson sent straight to WhatsApp — the app they already check all day. Mark a lesson done and the next one unlocks.',
    tag: 'WhatsApp',
  },
  {
    icon: Send,
    title: 'Telegram Lesson Delivery',
    desc: 'The same simple flow on Telegram — enroll, receive lessons, mark done, move forward. Use whichever platform fits your audience.',
    tag: 'Telegram',
  },
  {
    icon: ListChecks,
    title: 'Quizzes, Notes & Assignments',
    desc: 'Every lesson can carry a quiz, downloadable notes, and an assignment — all unlocked the moment a student marks the lesson complete, on both platforms.',
    tag: 'Learning',
  },
  {
    icon: LayoutDashboard,
    title: 'Clean Creator Dashboard',
    desc: "Upload your course, set your price, and see exactly who's enrolled and how far they've gotten — no clutter, no learning curve.",
    tag: 'Dashboard',
  },
  {
    icon: Award,
    title: 'Auto Certificates',
    desc: 'The moment a student finishes your course, we generate and send their certificate automatically. Zero manual work for you.',
    tag: 'Certificates',
  },
  {
    icon: Video,
    title: 'Live Classes, Shared Automatically',
    desc: "Drop in your Zoom or Google Meet link for a live session and we'll send it straight to every enrolled student on WhatsApp and Telegram.",
    tag: 'Live Classes',
  },
  {
    icon: Wallet,
    title: 'Direct Payouts',
    desc: "We run on a split-payment setup, so your earnings land straight in your bank account or UPI ID.",
    tag: 'Payments',
  },
  {
    icon: Lock,
    title: 'Watermarked Videos',
    desc: "Every video lesson carries the student's email as a watermark — a simple, honest layer of protection.",
    tag: 'Protection',
  },
]

const steps = [
  { num: '01', title: 'Upload your course', desc: 'Drag in your videos, notes, and assignments. No technical setup required.' },
  { num: '02', title: 'Set your price', desc: 'Pick a flat monthly plan or 10% commission, and connect your bank account or UPI ID for direct payouts.' },
  { num: '03', title: 'Share your link', desc: 'Students enroll and pay on your course page. They are auto-enrolled the moment payment succeeds.' },
  { num: '04', title: 'Bot delivers lessons', desc: 'Each lesson lands in WhatsApp or Telegram. Mark it done to unlock the quiz, notes, and assignment — then the next lesson.' },
  { num: '05', title: 'Go live anytime', desc: 'Drop in a Zoom or Google Meet link for a live class — we share it with every enrolled student automatically.' },
]

const plans = [
  {
    name: 'Web + Telegram',
    price: '₹2,500',
    period: '/month',
    desc: 'Deliver your course through your dashboard and the Telegram bot.',
    features: [
      'Web dashboard for creators',
      'Telegram bot lesson delivery',
      'Quizzes, notes & assignments',
      'Auto certificates on completion',
      'Live class link sharing',
      'Razorpay payments, direct payout',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Web + WhatsApp',
    price: '₹3,500',
    period: '/month',
    desc: 'Deliver your course through your dashboard and the WhatsApp bot.',
    features: [
      'Web dashboard for creators',
      'WhatsApp bot lesson delivery',
      'Quizzes, notes & assignments',
      'Auto certificates on completion',
      'Live class link sharing',
      'Razorpay payments, direct payout',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Web + WhatsApp + Telegram',
    price: '₹4,000',
    period: '/month',
    desc: 'Full reach — deliver on both bots plus your dashboard.',
    features: [
      'Web dashboard for creators',
      'WhatsApp + Telegram bot delivery',
      'Quizzes, notes & assignments',
      'Auto certificates on completion',
      'Live class link sharing',
      'Razorpay payments, direct payout',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
]

const stats = [
  { num: '7 Days', label: 'Free trial' },
  { num: '2', label: 'Delivery channels' },
  { num: '₹0', label: 'Setup cost' },
  { num: '10%', label: 'Or flat monthly fee' },
]

// ─── COMPONENTS ───
function StatCard({ num, label }: { num: string; label: string }) {
  return (
    <div className="glass rounded-2xl p-6 text-center glow">
      <div className="text-4xl font-bold gradient-text mb-1">{num}</div>
      <div className="text-text-2 text-sm">{label}</div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc, tag }: typeof features[0]) {
  return (
    <div className="glass rounded-2xl p-6 hover:border-violet/40 transition-all duration-300 group hover:glow cursor-default border border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 violet-gradient rounded-xl flex items-center justify-center group-hover:animate-pulse-glow">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-xs font-medium text-violet-light bg-violet/10 border border-violet/20 px-2 py-1 rounded-full">
          {tag}
        </span>
      </div>
      <h3 className="font-semibold text-white mb-2 text-lg">{title}</h3>
      <p className="text-text-2 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

function StepCard({ num, title, desc }: typeof steps[0]) {
  return (
    <div className="flex gap-6 group">
      <div className="flex-shrink-0">
        <div className="w-12 h-12 violet-gradient rounded-xl flex items-center justify-center font-bold text-white group-hover:animate-pulse-glow transition-all">
          {num}
        </div>
      </div>
      <div className="pt-2">
        <h3 className="font-semibold text-white mb-2">{title}</h3>
        <p className="text-text-2 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function PlanCard({ plan }: { plan: typeof plans[0] }) {
  return (
    <div className={`rounded-2xl p-8 border transition-all duration-300 flex flex-col ${plan.highlighted
      ? 'violet-gradient border-violet glow-strong relative'
      : 'glass border-border hover:border-violet/30 hover:glow'
      }`}>
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-violet text-xs font-bold px-4 py-1 rounded-full">
          MOST POPULAR
        </div>
      )}
      <div className="mb-6">
        <div className="text-sm font-medium text-text-2 mb-1">{plan.name}</div>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-4xl font-bold text-white">{plan.price}</span>
          <span className="text-text-2 text-sm">{plan.period}</span>
        </div>
        <p className={`text-sm ${plan.highlighted ? 'text-white/70' : 'text-text-2'}`}>{plan.desc}</p>
      </div>
      <ul className="flex flex-col gap-3 mb-8 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlighted ? 'text-white' : 'text-violet-light'}`} />
            <span className={plan.highlighted ? 'text-white/90' : 'text-text-2'}>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/login"
        className={`w-full py-3 rounded-xl font-medium text-center transition-all text-sm ${plan.highlighted
          ? 'bg-white text-black hover:bg-white/90'
          : 'violet-gradient text-white hover:opacity-90 glow'
          }`}
      >
        {plan.cta}
      </Link>
    </div>
  )
}

// ─── PAGE ───
export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    async function checkUser(sessionUser: any | null) {
      setUser(sessionUser ?? null)
      if (sessionUser) {
        const accountType = await resolveAccountType(sessionUser)
        if (accountType === 'student') {
          router.replace('/my-courses')
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      checkUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen bg-black grid-bg">
      <Navbar />

      {/* ── HERO ── */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-violet/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 glass border border-violet/20 rounded-full px-4 py-2 mb-8">
            <div className="w-2 h-2 bg-violet-light rounded-full animate-pulse" />
            <span className="text-sm text-text-2">7-day free trial · No setup cost</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Your Course, Delivered on{' '}
            <span className="gradient-text">WhatsApp</span>
            {' '}&{' '}
            <span className="gradient-text">Telegram</span>
          </h1>

          <p className="text-text-2 text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Kurso sends each lesson straight to your students' WhatsApp or Telegram — quizzes, notes,
            assignments and certificates included. No app to download, no dashboard to learn. Just
            the chats they already check.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href={user ? '/dashboard' : '/login?role=creator'}
              className="violet-gradient px-8 py-4 rounded-xl text-white font-semibold text-lg hover:opacity-90 transition-all glow-strong flex items-center justify-center gap-2 group"
            >
              {user ? 'Go to Dashboard' : 'Start Free — 7 Day Trial'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#demo"
              className="glass border border-border px-8 py-4 rounded-xl text-white font-semibold text-lg hover:border-violet/40 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 text-violet-light" />
              Watch Demo
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {stats.map((s, i) => <StatCard key={i} {...s} />)}
          </div>
        </div>
      </section>

      {/* ── DEMO VIDEO ── */}
      <section id="demo" className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              See <span className="gradient-text">Kurso</span> in action
            </h2>
            <p className="text-text-2 font-light">A quick look at how a lesson goes from your dashboard to a student's chat.</p>
          </div>

          <div className="glass rounded-2xl border border-border overflow-hidden glow">
            {DEMO_VIDEO_URL ? (
              <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                <iframe
                  src={DEMO_VIDEO_URL}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-16 h-16 violet-gradient rounded-2xl flex items-center justify-center animate-pulse-glow">
                  <Play className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold mb-1">Demo video coming soon</p>
                  <p className="text-text-2 text-sm">We're recording a walkthrough — check back shortly.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 glass border border-violet/20 rounded-full px-4 py-2 mb-4">
              <Sparkles className="w-3 h-3 text-violet-light" />
              <span className="text-sm text-text-2">What you actually get</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Built around{' '}
              <span className="gradient-text">excellent user experience.</span>
            </h2>
            <p className="text-text-2 text-lg max-w-xl mx-auto font-light">
              No padded feature list — just what's live today, built for how your students already use their phones.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS / GETTING STARTED ── */}
      <section id="how-it-works" className="py-24 px-6 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 glass border border-violet/20 rounded-full px-4 py-2 mb-6">
                <span className="text-sm text-text-2">Getting started is simple</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Five steps. <span className="gradient-text">That's it.</span>
              </h2>
              <p className="text-text-2 mb-10 font-light leading-relaxed">
                No technical knowledge required — if you can drag and drop a file, you can run Kurso.
              </p>
              <div className="flex flex-col gap-8">
                {steps.map((s, i) => <StepCard key={i} {...s} />)}
              </div>
            </div>

            {/* Visual */}
            <div className="relative">
              <div className="glass rounded-2xl p-8 glow animate-float" style={{ border: '1px solid rgba(124,58,237,0.2)' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 violet-gradient rounded-lg flex items-center justify-center">
                      <GraduationCap className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white font-semibold text-base">Kurso Dashboard</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Students', val: '86' },
                    { label: 'Completion', val: '61%' },
                    { label: 'Certificates', val: '12' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="text-3xl font-bold gradient-text mb-1">{s.val}</div>
                      <div className="text-sm" style={{ color: '#a1a1aa' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Live class card */}
                <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-xs font-semibold mb-3 tracking-widest uppercase" style={{ color: '#52525b' }}>
                    🎥 Upcoming Live Class
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm" style={{ color: '#e4e4e7' }}>Doubt Clearing Session</span>
                    <span className="text-sm font-medium" style={{ color: '#8b5cf6' }}>Today, 7:00 PM</span>
                  </div>
                  <div className="text-xs mt-2" style={{ color: '#52525b' }}>
                    Link shared with 86 students on WhatsApp & Telegram
                  </div>
                </div>

                {/* Activity */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-xs font-semibold mb-3 tracking-widest uppercase" style={{ color: '#52525b' }}>
                    Recent Activity
                  </div>
                  {[
                    'Riya completed Lesson 4',
                    'Arjun enrolled in SEO Basics',
                    'Certificate sent to Priya',
                  ].map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#8b5cf6' }} />
                      <span className="text-sm" style={{ color: '#e4e4e7' }}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-5 -right-5 rounded-xl px-5 py-3 glow" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.3)', backdropFilter: 'blur(12px)' }}>
                <div className="text-xs mb-1" style={{ color: '#a1a1aa' }}>This month</div>
                <div className="text-xl font-bold gradient-text">7 certificates issued</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple <span className="gradient-text">pricing</span>
            </h2>
            <p className="text-text-2 font-light">7-day free trial on every plan. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-10">
            {plans.map((p, i) => <PlanCard key={i} plan={p} />)}
          </div>

          {/* Commission alternative — kept highly visible, as requested */}
          <div className="glass rounded-2xl border border-violet/30 p-8 glow-strong relative overflow-hidden">
            <div className="absolute inset-0 bg-violet/5 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Prefer to pay only when you earn?</h3>
                <p className="text-text-2 max-w-xl">
                  Skip the flat monthly fee and go with a <span className="text-white font-medium">10% commission</span> instead —
                  you only pay us when your course sells. This option needs a quick setup call, so reach out and we'll get you going.
                </p>
              </div>
              <Link
                href="/contact"
                className="violet-gradient px-6 py-3 rounded-xl text-white font-semibold whitespace-nowrap hover:opacity-90 transition-all glow flex items-center gap-2 flex-shrink-0"
              >
                Talk to Us
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass rounded-3xl border border-violet/20 p-12 glow-strong relative overflow-hidden">
            <div className="absolute inset-0 bg-violet/5 rounded-3xl" />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Ready to bring your course<br />
                <span className="gradient-text">to WhatsApp & Telegram?</span>
              </h2>
              <p className="text-text-2 mb-8 font-light text-lg">
                Setup takes less than a day. Try it free for 7 days — no card required.
              </p>
              <Link
                href={user ? '/dashboard' : '/login?role=creator'}
                className="violet-gradient px-10 py-4 rounded-xl text-white font-semibold text-lg hover:opacity-90 transition-all glow-strong inline-flex items-center gap-2 group"
              >
                {user ? 'Go to Dashboard' : 'Start Free Trial'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 violet-gradient rounded-lg flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white">Kurso</span>
          </div>
          <p className="text-text-3 text-sm">© 2026 Kurso. Built for Indian creators.</p>
          <div className="flex gap-6">
            <Link href="/feedback" className="text-text-3 text-sm hover:text-text-2 transition-colors">Feedback</Link>
            <Link href="/privacy" className="text-text-3 text-sm hover:text-text-2 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-text-3 text-sm hover:text-text-2 transition-colors">Terms</Link>
            <Link href="/contact" className="text-text-3 text-sm hover:text-text-2 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}