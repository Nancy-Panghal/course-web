"use client"
import { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, ArrowLeft, Send, CheckCircle, Heart } from 'lucide-react'

export default function FeedbackPage() {
  const [type, setType] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, email, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black grid-bg">

      {/* Nav */}
      <div className="border-b px-6 py-4 flex items-center justify-between"
        style={{borderColor:'rgba(255,255,255,0.06)', background:'rgba(0,0,0,0.8)', backdropFilter:'blur(20px)'}}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 violet-gradient rounded-lg flex items-center justify-center">
            <GraduationCap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white">Kurso</span>
        </Link>
        <Link href="/" className="flex items-center gap-2 text-sm transition-colors"
          style={{color:'#a1a1aa'}}>
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-medium"
            style={{background:'rgba(124,58,237,0.1)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.2)'}}>
            Help us build something great
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Feedback</h1>
          <p className="text-lg" style={{color:'#a1a1aa'}}>
            We're still building Kurso.Tell us what's
            missing or what's annoying — it genuinely shapes what we build next.
          </p>
        </div>

        {/* Friendly note */}
        <div className="rounded-2xl p-5 flex items-start gap-3 mb-8"
          style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
          <Heart className="w-4 h-4 flex-shrink-0 mt-0.5" style={{color:'#8b5cf6'}} />
          <p className="text-sm" style={{color:'#a1a1aa'}}>
            
             If there's a feature that would make your life easier, just write it down —
            we usually ship requested features within 2–3 days.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl p-8 glass"
          style={{border:'1px solid rgba(255,255,255,0.06)'}}>

          {!sent ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              <div>
                <label className="text-sm font-medium text-white mb-2 block">What's this about?</label>
                <select
                  value={type} onChange={e => setType(e.target.value)} required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background:'rgba(255,255,255,0.05)',
                    border:'1px solid rgba(255,255,255,0.1)',
                    color: type ? '#fff' : '#52525b',
                  }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                >
                  <option value="" style={{background:'#111'}}>Select one</option>
                  <option value="feedback" style={{background:'#111'}}>General Feedback</option>
                  <option value="feature_request" style={{background:'#111'}}>Feature Request</option>
                  <option value="bug" style={{background:'#111'}}>Bug Report</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-white mb-2 block">Your Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                  style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white mb-2 block">Tell us more</label>
                <textarea
                  value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="What's missing, what's broken, or what would make Kurso better for you..."
                  required rows={6}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all resize-none"
                  style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-white violet-gradient hover:opacity-90 transition-all glow disabled:opacity-50"
              >
                {loading ? (
                  <>Sending...</>
                ) : (
                  <><Send className="w-4 h-4" />Send Feedback</>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)'}}>
                <CheckCircle className="w-8 h-8" style={{color:'#4ade80'}} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Thank you!</h3>
              <p className="mb-6" style={{color:'#a1a1aa'}}>
                We read every message. If it's a feature, we'll likely be in touch soon.
              </p>
              <button
                onClick={() => { setSent(false); setType(''); setEmail(''); setMessage('') }}
                className="text-sm transition-colors"
                style={{color:'#8b5cf6'}}>
                Send more feedback
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-sm mt-6" style={{color:'#52525b'}}>
          Got a support issue instead? Head to{' '}
          <Link href="/contact" className="font-medium" style={{color:'#8b5cf6'}}>Contact</Link>.
        </p>
      </div>

      {/* Footer */}
      <footer className="border-t px-6 py-8 mt-8"
        style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 violet-gradient rounded-md flex items-center justify-center">
              <GraduationCap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-white">Kurso</span>
          </Link>
          <div className="flex gap-6 text-xs" style={{color:'#52525b'}}>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}