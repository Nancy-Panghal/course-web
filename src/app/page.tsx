'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Shield, Zap, TrendingUp, Lock, MessageCircle, BarChart3, CheckCircle, ArrowRight, Star, Play, X } from 'lucide-react'
import Navbar from '@/components/Navbar'

// ─── DATA ───
const features = [
  {
    icon: Shield,
    title: 'Auto Piracy Protection',
    desc: 'Automated scanner detects your course on Telegram within hours. DMCA notices filed automatically under IT Rules 2026 — 3-hour takedown mandate.',
    tag: 'Anti-Piracy'
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Delivery',
    desc: 'Students receive lessons directly in WhatsApp — the app they open 25 times a day. No app download, no login friction, no ghosting.',
    tag: 'Engagement'
  },
  {
    icon: Zap,
    title: 'Expiring Video Links',
    desc: 'Every lesson link expires in 60 minutes. Pirates cannot share working links. Content stays protected without DRM complexity.',
    tag: 'Security'
  },
  {
    icon: TrendingUp,
    title: '40-60% Completion Rates',
    desc: 'WhatsApp-based courses consistently hit 40-60% completion vs 3-15% on traditional platforms. Daily nudges keep students engaged.',
    tag: 'Results'
  },
  {
    icon: Lock,
    title: 'Student Owns Nothing',
    desc: 'No downloadable files. No permanent links. Content exists only as a time-bound stream — making piracy structurally impossible.',
    tag: 'Protection'
  },
  {
    icon: BarChart3,
    title: 'Creator Analytics',
    desc: 'See exactly where students drop off, which lessons get replayed, and your real completion funnel — not vanity metrics.',
    tag: 'Insights'
  },
]

const steps = [
  { num: '01', title: 'Upload your course', desc: 'Drag and drop your videos and PDFs into AcademyKit. We store them securely — never on public servers.' },
  { num: '02', title: 'Students enroll and pay', desc: 'Your public course page handles enrollment. Razorpay processes payment. Student is auto-enrolled on success.' },
  { num: '03', title: 'Bot delivers lessons', desc: 'Student gets a WhatsApp message with a 60-minute lesson link. They tap "Done" and the next lesson unlocks.' },
  { num: '04', title: 'Pirates get blocked', desc: 'Scanner runs every 6 hours. Finds pirated links. Auto-files takedowns. You see a live nuked-links dashboard.' },
]

const plans = [
  {
    name: 'Starter',
    price: '₹1,999',
    period: '/month',
    desc: 'For creators just getting started',
    features: [
      'Up to 200 enrolled students',
      'Unlimited lessons',
      'WhatsApp delivery bot',
      'Basic piracy scanning (daily)',
      'Auto certificates',
      'Email support',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '₹4,999',
    period: '/month',
    desc: 'For serious creators with active launches',
    features: [
      'Up to 1,000 students',
      'Automated 3-hour takedowns',
      'Live piracy dashboard',
      'Razorpay integration',
      'Hindi/regional WA templates',
      'Web + WhatsApp delivery',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Agency',
    price: '₹12,999',
    period: '/month',
    desc: 'For agencies managing multiple creators',
    features: [
      'Unlimited students',
      'Multi-creator management',
      'ISP-level escalation',
      'White-label portal',
      'Custom domain per creator',
      'Dedicated account manager',
    ],
    cta: 'Contact Us',
    highlighted: false,
  },
]

const testimonials = [
  {
    name: 'Rahul Sharma',
    role: 'SEO Coach · 45K YouTube subscribers',
    text: 'My course was on 12 Telegram channels within a week of launch. AcademyKit nuked all of them in 3 days. Completion rate went from 11% to 54%.',
    rating: 5,
  },
  {
    name: 'Priya Mehta',
    role: 'Digital Marketing Creator · 80K followers',
    text: 'Students actually finish the course now. The WhatsApp delivery feels personal — like I am messaging each student myself. Revenue up 3x.',
    rating: 5,
  },
  {
    name: 'Arjun Nair',
    role: 'Productivity Coach · 25K subscribers',
    text: 'Setup took less than a day. First client paid within the week. The piracy dashboard alone is worth the subscription — creators love seeing those nuked links.',
    rating: 5,
  },
]

const stats = [
  { num: '98%', label: 'WhatsApp open rate' },
  { num: '55%', label: 'Avg completion rate' },
  { num: '3hr', label: 'Takedown window' },
  { num: '₹0', label: 'Setup cost' },
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
    <div className={`rounded-2xl p-8 border transition-all duration-300 flex flex-col ${
      plan.highlighted
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
        className={`w-full py-3 rounded-xl font-medium text-center transition-all text-sm ${
          plan.highlighted
            ? 'bg-white text-violet hover:bg-white/90'
            : 'violet-gradient text-white hover:opacity-90 glow'
        }`}
      >
        {plan.cta}
      </Link>
    </div>
  )
}

function TestimonialCard({ t }: { t: typeof testimonials[0] }) {
  return (
    <div className="glass rounded-2xl p-6 border border-border hover:border-violet/30 transition-all">
      <div className="flex gap-1 mb-4">
        {Array.from({ length: t.rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-violet-light text-violet-light" />
        ))}
      </div>
      <p className="text-text-2 text-sm leading-relaxed mb-4">"{t.text}"</p>
      <div>
        <div className="font-medium text-white text-sm">{t.name}</div>
        <div className="text-text-3 text-xs mt-0.5">{t.role}</div>
      </div>
    </div>
  )
}

// ─── VIDEO MODAL ───
function VideoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass rounded-2xl p-8 max-w-lg w-full border border-border relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-text-2 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="w-16 h-16 violet-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
            <Play className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Demo coming soon</h3>
          <p className="text-text-2 text-sm mb-6">Sign up to get early access and see the full product walkthrough.</p>
          <Link href="/login" className="violet-gradient px-6 py-3 rounded-xl text-white text-sm font-medium inline-block hover:opacity-90">
            Get Early Access
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── PAGE ───
export default function HomePage() {
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <div className="min-h-screen bg-black grid-bg">
      <Navbar />

      {videoOpen && <VideoModal onClose={() => setVideoOpen(false)} />}

      {/* ── HERO ── */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-violet/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 glass border border-violet/20 rounded-full px-4 py-2 mb-8">
            <div className="w-2 h-2 bg-violet-light rounded-full animate-pulse" />
            <span className="text-sm text-text-2">Now live — IT Rules 2026 compliant takedowns</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Deliver Courses on{' '}
            <span className="gradient-text">WhatsApp.</span>
            <br />
            Kill Piracy{' '}
            <span className="gradient-text">Automatically.</span>
          </h1>

          <p className="text-text-2 text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            AcademyKit delivers your course through WhatsApp with expiring links, auto-enrolls students on payment, and files DMCA takedowns on Telegram pirates within 3 hours.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/login"
              className="violet-gradient px-8 py-4 rounded-xl text-white font-semibold text-lg hover:opacity-90 transition-all glow-strong flex items-center justify-center gap-2 group"
            >
              Start Free — ₹0 Setup
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={() => setVideoOpen(true)}
              className="glass border border-border px-8 py-4 rounded-xl text-white font-semibold text-lg hover:border-violet/40 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 text-violet-light" />
              Watch Demo
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {stats.map((s, i) => <StatCard key={i} {...s} />)}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 glass border border-violet/20 rounded-full px-4 py-2 mb-4">
              <Zap className="w-3 h-3 text-violet-light" />
              <span className="text-sm text-text-2">Everything you need</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Built for Indian creators.<br />
              <span className="gradient-text">Works for everyone.</span>
            </h2>
            <p className="text-text-2 text-lg max-w-xl mx-auto font-light">
              Every feature designed around the reality of selling courses in 2026 — piracy, low completion, and platform dependency.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 px-6 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 glass border border-violet/20 rounded-full px-4 py-2 mb-6">
                <span className="text-sm text-text-2">Simple by design</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                How it <span className="gradient-text">works</span>
              </h2>
              <p className="text-text-2 mb-10 font-light leading-relaxed">
                Four steps from upload to protected delivery. No technical knowledge required — if you can drag and drop, you can run AcademyKit.
              </p>
              <div className="flex flex-col gap-8">
                {steps.map((s, i) => <StepCard key={i} {...s} />)}
              </div>
            </div>

            
             {/* Visual */}
<div className="relative">
  <div className="glass rounded-2xl p-8 glow animate-float" style={{border: '1px solid rgba(124,58,237,0.2)'}}>
    {/* Header */}
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 violet-gradient rounded-lg flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold text-base">AcademyKit Dashboard</span>
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
        { label: 'Students', val: '247' },
        { label: 'Completion', val: '54%' },
        { label: 'Nuked', val: '14' },
      ].map((s, i) => (
        <div key={i} className="rounded-xl p-4 text-center" style={{background:'rgba(255,255,255,0.05)'}}>
          <div className="text-3xl font-bold gradient-text mb-1">{s.val}</div>
          <div className="text-sm" style={{color:'#a1a1aa'}}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* Piracy feed */}
    <div className="rounded-xl p-4 mb-4" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)'}}>
      <div className="text-xs font-semibold mb-3 tracking-widest uppercase" style={{color:'#52525b'}}>
        🛡️ Piracy Shield — Live
      </div>
      {[
        { url: 't.me/free_courses_hd/seo_master...', status: 'NUKED', color: '#4ade80' },
        { url: 't.me/cracked_india/47382', status: 'NUKED', color: '#4ade80' },
        { url: 't.me/vip_2026/seo_course.zip', status: 'FILING', color: '#facc15' },
      ].map((r, i) => (
        <div key={i} className="flex items-center justify-between py-2" style={{borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none'}}>
          <span className="text-sm font-mono" style={{color:'#a1a1aa'}}>{r.url}</span>
          <span className="text-sm font-bold ml-4" style={{color: r.color}}>{r.status}</span>
        </div>
      ))}
    </div>

    {/* Activity */}
    <div className="rounded-xl p-4" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)'}}>
      <div className="text-xs font-semibold mb-3 tracking-widest uppercase" style={{color:'#52525b'}}>
        Recent Activity
      </div>
      {[
        'Riya completed Lesson 4',
        'Arjun enrolled in SEO Course',
        'Certificate sent to Priya',
      ].map((a, i) => (
        <div key={i} className="flex items-center gap-3 py-2" style={{borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none'}}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:'#8b5cf6'}} />
          <span className="text-sm" style={{color:'#e4e4e7'}}>{a}</span>
        </div>
      ))}
    </div>
  </div>

  {/* Floating badge */}
  <div className="absolute -bottom-5 -right-5 rounded-xl px-5 py-3 glow" style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(124,58,237,0.3)', backdropFilter:'blur(12px)'}}>
    <div className="text-xs mb-1" style={{color:'#a1a1aa'}}>This month</div>
    <div className="text-xl font-bold gradient-text">14 links nuked</div>
  </div>
</div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Creators <span className="gradient-text">love it</span>
            </h2>
            <p className="text-text-2 font-light">Real results from real creators</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => <TestimonialCard key={i} t={t} />)}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple <span className="gradient-text">pricing</span>
            </h2>
            <p className="text-text-2 font-light">No hidden fees. Cancel anytime. Start free.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {plans.map((p, i) => <PlanCard key={i} plan={p} />)}
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
                Ready to protect<br />
                <span className="gradient-text">your revenue?</span>
              </h2>
              <p className="text-text-2 mb-8 font-light text-lg">
                Setup takes less than a day. First client in a week. Zero upfront cost.
              </p>
              <Link
                href="/login"
                className="violet-gradient px-10 py-4 rounded-xl text-white font-semibold text-lg hover:opacity-90 transition-all glow-strong inline-flex items-center gap-2 group"
              >
                Start Building Free
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
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white">AcademyKit</span>
          </div>
          <p className="text-text-3 text-sm">© 2026 AcademyKit. Built for Indian creators.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-text-3 text-sm hover:text-text-2 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-text-3 text-sm hover:text-text-2 transition-colors">Terms</Link>
            <Link href="#" className="text-text-3 text-sm hover:text-text-2 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}