'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Mail, User, Phone, Eye, EyeOff, Shield, Lock, ArrowRight, Search, ChevronDown, Play, MessageCircle } from 'lucide-react'
import { slugify } from '@/lib/utils'

const COUNTRIES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'Nepal', code: '+977', flag: '🇳🇵' },
  { name: 'Sri Lanka', code: '+94', flag: '🇱🇰' },
]

function CountrySelector({ selected, onSelect }: { selected: any, onSelect: (c: any) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search)
  )

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className="h-full px-3 flex items-center gap-1.5 rounded-l-xl border-r border-white/10 transition-all hover:bg-white/5"
        style={{ background: 'rgba(255,255,255,0.05)' }}>
        <span className="text-sm">{selected.flag}</span>
        <span className="text-xs font-bold text-zinc-400">{selected.code}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 max-h-64 overflow-y-auto rounded-xl border border-white/10 shadow-2xl z-[60]"
          style={{ background: '#121212', backdropFilter: 'blur(20px)' }}>
          <div className="sticky top-0 p-2 border-b border-white/5" style={{ background: '#121212' }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full pl-8 pr-3 py-2 bg-white/5 rounded-lg text-xs text-white outline-none border border-transparent focus:border-violet-500/50"
              />
            </div>
          </div>
          <div className="p-1">
            {filtered.map(c => (
              <button key={c.name + c.code} type="button"
                onClick={() => { onSelect(c); setOpen(false); setSearch('') }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{c.flag}</span>
                  <span className="text-xs text-zinc-300 font-medium group-hover:text-white">{c.name}</span>
                </div>
                <span className="text-xs text-zinc-500 font-bold">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { supabase } from '@/lib/supabase'
import { findPaidEnrollment, findPaidEnrollmentByPhone } from '@/lib/enrollments'

declare global {
  interface Window { Razorpay: any }
}

interface CourseData {
  id: string
  name: string
  price: number
  creatorSlug: string
  creatorName: string
  creatorId: string
  telegramBotUsername?: string
  free_preview_config?: string
}

interface Props {
  onClose: () => void
  course: CourseData
}

// step 'demo-web' = student clicked "Watch on Website", modal closed
// but we re-open and show them the Telegram option + pay option
type Step = 'auth' | 'phone' | 'demo' | 'demo-web' | 'payment' | 'success'
type AuthMode = 'signup' | 'login'

function loadRazorpay(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// ── Telegram button ──────────────────────────────────────────────
function TelegramButton({ token, username, label }: { token: string; username: string; label?: string }) {
  const clean = username.replace('@', '')
  return (
    <a
      href={`https://t.me/${clean}?start=${token}`}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white transition-all hover:opacity-90 text-base"
      style={{ background: '#229ED9' }}
    >
      <MessageCircle className="w-5 h-5" />
      {label ?? 'Continue on Telegram'}
    </a>
  )
}

// ── Token spinner placeholder ────────────────────────────────────
function TokenLoading({ color, label }: { color: string; label: string }) {
  return (
    <div className="w-full py-4 rounded-xl text-sm text-center animate-pulse"
      style={{ background: color, color: '#fff', opacity: 0.5 }}>
      {label}
    </div>
  )
}

export default function EnrollModal({ onClose, course }: Props) {
  const [step, setStep] = useState<Step>('auth')
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Auth fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0])
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  // Student data
  const [studentData, setStudentData] = useState<any>(null)

  // Tokens — generated async, non-blocking
  const [telegramToken, setTelegramToken] = useState('')
  const [demoTelegramToken, setDemoTelegramToken] = useState('')
  const [generatingDemo, setGeneratingDemo] = useState(false)
  const [generatingPaid, setGeneratingPaid] = useState(false)

  const hasTelegram = Boolean(course.telegramBotUsername)
  const isNothingFree = !course.free_preview_config || course.free_preview_config === 'nothing free'

  const creatorSlug = slugify(course.creatorName)
  const courseSlug = slugify(course.creatorSlug)
  const learnUrl = `/course/${creatorSlug}/${courseSlug}/${course.id}`
  const aboutUrl = `/about-course/${creatorSlug}/${courseSlug}/${course.id}`

  // ── Token helpers ────────────────────────────────────────────────
  async function generateDemoTokens(data: any) {
    if (!data) return
    setGeneratingDemo(true)
    try {
      if (hasTelegram) {
        const res = await fetch('/api/telegram/create-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: data.id,
            studentPhone: data.phone,
            studentEmail: data.email,
            studentName: data.name,
            creatorId: course.creatorId,
            courseId: course.id,
            paymentId: null,
          }),
        })
        const { token } = await res.json()
        if (token) setDemoTelegramToken(token)
      }
    } catch (e) {
      console.error('Demo token error:', e)
    }
    setGeneratingDemo(false)
  }

  async function generatePaidTokens(data: any, paymentId: string) {
    if (!data) return
    setGeneratingPaid(true)
    try {
      if (hasTelegram) {
        const res = await fetch('/api/telegram/create-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: data.id,
            studentPhone: data.phone,
            studentEmail: data.email,
            studentName: data.name,
            creatorId: course.creatorId,
            courseId: course.id,
            paymentId,
          }),
        })
        const { token } = await res.json()
        if (token) setTelegramToken(token)
      }
    } catch (e) {
      console.error('Paid token error:', e)
    }
    setGeneratingPaid(false)
  }

  // ── Check session on mount ───────────────────────────────────────
  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCheckingAuth(false); return }

      const enrollment = await findPaidEnrollment({ courseId: course.id, user, select: 'id' })
      if (enrollment) { window.location.href = learnUrl; return }

      const userData = {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        phone: user.user_metadata?.phone || '',
      }
      setStudentData(userData)
      setName(userData.name)
      setEmail(userData.email)

      if (!userData.phone) {
        setStep('phone')
      } else if (isNothingFree) {
        setStep('payment')
      } else {
        setStep('demo')
        generateDemoTokens(userData)
      }
      setCheckingAuth(false)
    }
    checkSession()
  }, [course.id])

  // ── Auth handlers ────────────────────────────────────────────────
  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${aboutUrl}?enroll=true`,
        queryParams: { prompt: 'select_account' },
      },
    })
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (authMode === 'signup') {
        const cleanedPhone = phone.trim().replace(/\D/g, '')
        if (cleanedPhone.length !== 10) {
          setError('Please enter a valid 10-digit mobile number')
          setLoading(false)
          return
        }
        const phoneToStore = selectedCountry.code.replace('+', '') + cleanedPhone
        const existing = await findPaidEnrollmentByPhone(course.id, phoneToStore)
        if (existing) { setError('This mobile number is already enrolled in this course.'); setLoading(false); return }

        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name, role: 'student', phone: phoneToStore } },
        })
        if (error) throw error
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        const sd = { id: data.user?.id, email, name, phone: phoneToStore }
        setStudentData(sd)
        if (isNothingFree) {
          setStep('payment')
        } else {
          setStep('demo')
          generateDemoTokens(sd)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const user = data.user
        const userData = {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || name || '',
          phone: user.user_metadata?.phone || phone,
        }
        setStudentData(userData)
        const enrollment = await findPaidEnrollment({ courseId: course.id, user, phone: userData.phone, select: 'id' })
        if (enrollment) { window.location.href = learnUrl; return }
        if (!userData.phone) { setLoading(false); setStep('phone'); return }
        if (isNothingFree) {
          setStep('payment')
        } else {
          setStep('demo')
          generateDemoTokens(userData)
        }
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanedPhone = phone.trim().replace(/\D/g, '')
    if (cleanedPhone.length !== 10) { setError('Please enter a valid 10-digit mobile number'); return }
    const phoneToStore = selectedCountry.code.replace('+', '') + cleanedPhone
    setLoading(true)
    setError('')
    try {
      const existing = await findPaidEnrollmentByPhone(course.id, phoneToStore)
      if (existing) { setError('This mobile number is already enrolled in this course.'); setLoading(false); return }
      await supabase.auth.updateUser({ data: { phone: phoneToStore } })
      const sd = { ...studentData, phone: phoneToStore }
      setStudentData(sd)
      if (isNothingFree) {
        setStep('payment')
      } else {
        setStep('demo')
        generateDemoTokens(sd)
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  // ── Payment ──────────────────────────────────────────────────────
  async function handlePayment() {
    setLoading(true)
    setError('')
    try {
      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Failed to load Razorpay. Check your connection.')

      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: course.price, courseId: course.id, creatorSlug: course.creatorSlug }),
      })
      const { orderId, error: orderError } = await orderRes.json()
      if (orderError) throw new Error(orderError)

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: course.price * 100,
        currency: 'INR',
        name: 'AcademyKit',
        description: course.name,
        order_id: orderId,
        prefill: {
          name: studentData?.name || '',
          email: studentData?.email || '',
          contact: studentData?.phone || '',
        },
        theme: { color: '#7c3aed' },
        handler: async (response: any) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              studentId: studentData?.id,
              studentEmail: studentData?.email,
              studentName: studentData?.name,
              studentPhone: studentData?.phone,
              creatorId: course.creatorId,
              courseId: course.id,
              amount: course.price,
            }),
          })
          const result = await verifyRes.json()
          if (result.success) {
            const confirmedEnrollment = await findPaidEnrollment({
              courseId: course.id,
              user: (await supabase.auth.getUser()).data.user,
              phone: studentData?.phone,
              select: 'id',
            })
            if (!confirmedEnrollment) {
              setError('Payment verified but enrollment not found. Please contact support.')
              setLoading(false)
              return
            }
            setStep('success')
            // Generate paid tokens in background — non-blocking
            generatePaidTokens(studentData, response.razorpay_payment_id)
            setTimeout(() => { window.location.href = learnUrl }, 3000)
          } else {
            setError('Payment verification failed. Please contact support.')
          }
          setLoading(false)
        },
        modal: { ondismiss: () => setLoading(false) },
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="w-10 h-10 violet-gradient rounded-xl animate-pulse-glow" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#0a0a0a', border: '1px solid rgba(124,58,237,0.3)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="font-semibold text-white">
              {step === 'auth' && 'Enroll in Course'}
              {step === 'phone' && 'Add Your Number'}
              {step === 'demo' && 'You\'re In — Choose How to Start'}
              {step === 'demo-web' && 'Continue on Telegram'}
              {step === 'payment' && 'Complete Payment'}
              {step === 'success' && 'You\'re Enrolled! 🎉'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>{course.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── AUTH ── */}
        {step === 'auth' && (
          <div className="p-6">
            <div className="flex rounded-xl p-1 mb-5" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {(['signup', 'login'] as AuthMode[]).map(m => (
                <button key={m} onClick={() => { setAuthMode(m); setError('') }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: authMode === m ? 'rgba(124,58,237,0.3)' : 'transparent',
                    color: authMode === m ? '#fff' : '#a1a1aa',
                  }}>
                  {m === 'signup' ? 'New Student' : 'Already have account'}
                </button>
              ))}
            </div>

            <button onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-white text-sm mb-5 transition-all hover:opacity-90"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-xs" style={{ color: '#52525b' }}>or with email</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
              {authMode === 'signup' && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#52525b' }} />
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Full name" required
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    onFocus={e => e.target.style.borderColor = '#7c3aed'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#52525b' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Email address" required
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </div>

              {authMode === 'signup' && (
                <div className="flex gap-2">
                  <CountrySelector selected={selectedCountry} onSelect={setSelectedCountry} />
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#52525b' }} />
                    <input type="tel" value={phone}
                      onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) setPhone(v) }}
                      placeholder="Mobile number (10 digits)" required maxLength={10}
                      className="w-full pl-10 pr-4 py-3 rounded-r-xl text-sm text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#7c3aed'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  </div>
                </div>
              )}

              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={authMode === 'signup' ? 'Create password (min 8 chars)' : 'Your password'}
                  required minLength={authMode === 'signup' ? 8 : undefined}
                  className="w-full px-4 pr-10 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#52525b' }}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-medium text-white violet-gradient hover:opacity-90 glow disabled:opacity-50 mt-1">
                {loading ? 'Please wait...' : authMode === 'signup' ? 'Sign Up & Continue →' : 'Sign In & Continue →'}
              </button>
            </form>

            <div className="flex items-center gap-2 mt-4 p-3 rounded-xl"
              style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.1)' }}>
              <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#4ade80' }} />
              <p className="text-xs" style={{ color: '#52525b' }}>
                Your number is needed to deliver lessons on Telegram after payment.
              </p>
            </div>
          </div>
        )}

        {/* ── PHONE ── */}
        {step === 'phone' && (
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)' }}>
                <Phone className="w-6 h-6" style={{ color: '#25d366' }} />
              </div>
              <h3 className="font-semibold text-white mb-1">One more thing</h3>
              <p className="text-sm" style={{ color: '#a1a1aa' }}>
                We need your number to deliver lessons on Telegram after payment.
              </p>
            </div>
            <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
              <div className="flex gap-2">
                <CountrySelector selected={selectedCountry} onSelect={setSelectedCountry} />
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#52525b' }} />
                  <input type="tel" value={phone}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) setPhone(v) }}
                    placeholder="10 digit number" required maxLength={10}
                    className="w-full pl-10 pr-4 py-3 rounded-r-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#7c3aed'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
              </div>
              {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-medium text-white violet-gradient hover:opacity-90 glow disabled:opacity-50">
                {loading ? 'Saving...' : 'Continue →'}
              </button>
            </form>
          </div>
        )}

        {/* ── DEMO ── */}
        {step === 'demo' && (
          <div className="p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <Play className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Welcome{studentData?.name ? `, ${studentData.name.split(' ')[0]}` : ''}!
              </h3>
              <p className="text-sm" style={{ color: '#a1a1aa' }}>
                Free preview unlocked. Start right now — on Telegram or on the website.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Telegram */}
              {hasTelegram && (
                demoTelegramToken
                  ? <TelegramButton token={demoTelegramToken} username={course.telegramBotUsername!} label="Start Free Lessons on Telegram" />
                  : <TokenLoading color="rgba(34,158,217,0.5)" label="Preparing Telegram link…" />
              )}

              {/* Watch on website — sets demo-web step so Telegram button stays accessible */}
              <button
                onClick={() => {
                  // Open the course in a new tab so the modal stays open
                  window.open(learnUrl, '_blank')
                  setStep('demo-web')
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Watch Demo on Website
              </button>

              {/* Pay CTA */}
              <button onClick={() => setStep('payment')}
                className="w-full py-4 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 glow transition-all text-base">
                Enroll Now — ₹{course.price.toLocaleString()}
              </button>
            </div>
          </div>
        )}

        {/* ── DEMO-WEB: student opened website, now show Telegram option + pay ── */}
        {step === 'demo-web' && (
          <div className="p-6">
            <div className="text-center mb-5">
              <p className="text-sm font-semibold text-white mb-1">Enjoying the preview?</p>
              <p className="text-sm" style={{ color: '#a1a1aa' }}>
                Get lessons delivered straight to your Telegram — no browser needed.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Telegram — token already generated during demo step */}
              {hasTelegram && (
                demoTelegramToken
                  ? <TelegramButton token={demoTelegramToken} username={course.telegramBotUsername!} label="Continue on Telegram" />
                  : <TokenLoading color="rgba(34,158,217,0.5)" label="Preparing Telegram link…" />
              )}

              {/* Back to website */}
              <button
                onClick={() => window.open(learnUrl, '_blank')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Continue watching on website
              </button>

              {/* Pay */}
              <button onClick={() => setStep('payment')}
                className="w-full py-4 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 glow transition-all text-base">
                Enroll & Unlock All — ₹{course.price.toLocaleString()}
              </button>
            </div>
          </div>
        )}

        {/* ── PAYMENT ── */}
        {step === 'payment' && (
          <div className="p-6">
            <div className="rounded-xl p-4 mb-5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs mb-3 font-semibold uppercase tracking-wider" style={{ color: '#52525b' }}>
                Order Summary
              </p>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-white">{course.name}</span>
                <span className="text-sm font-bold text-white">₹{course.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-3 mt-2"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-lg font-bold text-white">₹{course.price.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="w-5 h-5 violet-gradient rounded flex items-center justify-center flex-shrink-0">
                  <Shield className="w-3 h-3 text-white" />
                </div>
                <p className="text-xs" style={{ color: '#52525b' }}>
                  Enrolling as <strong className="text-white">{studentData?.email}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-xl p-4 mb-5"
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#8b5cf6' }}>After payment you'll get:</p>
              {[
                hasTelegram ? 'Lessons delivered to your Telegram instantly' : null,
                'Full web learning portal access',
                'Certificate on completion',
                'Lifetime access — no expiry',
              ].filter(Boolean).map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#8b5cf6' }} />
                  <p className="text-xs" style={{ color: '#a1a1aa' }}>{item}</p>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm mb-4"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button onClick={handlePayment} disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 glow-strong disabled:opacity-50 text-lg">
              {loading ? 'Opening payment…' : `Pay ₹${course.price.toLocaleString()} Securely`}
            </button>
            <p className="text-center text-xs mt-3" style={{ color: '#3f3f46' }}>Powered by Razorpay · 256-bit SSL</p>
            <button onClick={() => setStep(isNothingFree ? 'auth' : 'demo')}
              className="w-full text-center text-xs mt-2" style={{ color: '#52525b' }}>
              ← Back
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'success' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <Shield className="w-8 h-8" style={{ color: '#4ade80' }} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Payment Successful! 🎉</h3>
            <p className="text-sm mb-6" style={{ color: '#a1a1aa' }}>
              You are enrolled in <strong className="text-white">{course.name}</strong>.
              Choose how you want to start:
            </p>

            <div className="flex flex-col gap-3">
              {/* Telegram — primary CTA when available */}
              {hasTelegram && (
                telegramToken
                  ? <TelegramButton token={telegramToken} username={course.telegramBotUsername!} label="Start on Telegram" />
                  : generatingPaid
                  ? <TokenLoading color="rgba(34,158,217,0.6)" label="Generating your Telegram link…" />
                  : null
              )}

              {/* Web portal — always available */}
              <a href={learnUrl}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium text-white transition-all hover:opacity-90"
                style={{
                  background: hasTelegram ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  border: hasTelegram ? '1px solid rgba(255,255,255,0.1)' : 'none',
                }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {hasTelegram ? 'Open Web Portal' : 'Start Learning Now'}
              </a>

              <button onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#a1a1aa' }}>
                Close
              </button>
            </div>

            <p className="text-xs mt-4" style={{ color: '#3f3f46' }}>
              Progress syncs between Telegram and web automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}