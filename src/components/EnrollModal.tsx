'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Mail, User, Phone, Eye, EyeOff, Shield, Lock, ArrowRight, Search, ChevronDown, Play,MessageCircle } from 'lucide-react'
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
        style={{background:'rgba(255,255,255,0.05)'}}>
        <span className="text-sm">{selected.flag}</span>
        <span className="text-xs font-bold text-zinc-400">{selected.code}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 max-h-64 overflow-y-auto rounded-xl border border-white/10 shadow-2xl z-[60]"
          style={{background:'#121212', backdropFilter:'blur(20px)'}}>
          <div className="sticky top-0 p-2 border-b border-white/5" style={{background:'#121212'}}>
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
  waNumber?: string
  free_preview_config?: string
}

interface Props {
  onClose: () => void
  course: CourseData
}

type Step = 'auth' | 'phone' | 'payment' | 'success' | 'demo'
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

  // Success state
  const [waToken, setWaToken] = useState('')
  const [demoWaToken, setDemoWaToken] = useState('')
  const [generatingToken, setGeneratingToken] = useState(false)

  const creatorSlug = slugify(course.creatorName)
  const courseSlug = slugify(course.creatorSlug) // Using creatorSlug as the course slug reference
  const learnUrl = `/course/${creatorSlug}/${courseSlug}/${course.id}`
  const aboutUrl = `/about-course/${creatorSlug}/${courseSlug}/${course.id}`

  // Generate demo token when entering demo step
  useEffect(() => {
    if (step === 'demo' && course.waNumber && !demoWaToken) {
      generateToken(false)
    }
  }, [step])

  async function generateToken(isPaid: boolean, paymentId?: string) {
    setGeneratingToken(true)
    try {
      const tokenRes = await fetch('/api/whatsapp/create-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentPhone: studentData?.phone,
          studentEmail: studentData?.email,
          studentName: studentData?.name,
          creatorId: course.creatorId,
          courseSlug: course.creatorSlug,
          paymentId: paymentId || null,
        }),
      })
      const { token } = await tokenRes.json()
      if (isPaid) setWaToken(token || '')
      else setDemoWaToken(token || '')
    } catch (e) {
      console.error('Token error:', e)
    }
    setGeneratingToken(false)
  }

  // Check if already logged in
  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCheckingAuth(false); return }

      // Check if already enrolled
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('course_uuid', course.id)
        .eq('payment_status', 'paid')
        .single()

      if (enrollment) {
        // Already enrolled — close modal and redirect
        window.location.href = learnUrl
        return
      }

      // User is logged in but not enrolled
      const userData = {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        phone: user.user_metadata?.phone || '',
      }
      setStudentData(userData)
      setName(userData.name)
      setEmail(userData.email)

      // If phone missing (e.g. Google login), ask for it
      const isNothingFree = !course.free_preview_config || course.free_preview_config === 'nothing free'
      if (!userData.phone) {
        setStep('phone')
      } else if (isNothingFree) {
        setStep('payment')
      } else {
        setStep('demo')
      }

      setCheckingAuth(false)
    }
    checkSession()
  }, [course.id, course.creatorSlug])

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
        // Validation: Must be 10 digits
        const cleanedPhone = phone.trim().replace(/\D/g, '')
        if (cleanedPhone.length !== 10) {
          setError('Please enter a valid 10-digit mobile number')
          setLoading(false)
          return
        }

        const phoneToStore = selectedCountry.code.replace('+', '') + cleanedPhone

        // Check if this phone number is already enrolled in this course
        const { data: existing } = await supabase
          .from('enrollments')
          .select('id')
          .eq('course_uuid', course.id)
          .eq('phone', phoneToStore)
          .eq('payment_status', 'paid')
          .maybeSingle()

        if (existing) {
          setError('This mobile number is already enrolled in this course.')
          setLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, role: 'student', phone: phoneToStore },
          }
        })
        if (error) throw error

        // Auto sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError

        setStudentData({ id: data.user?.id, email, name, phone: phoneToStore })
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

        // Check enrolled
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id')
          .eq('course_uuid', course.id)
          .eq('payment_status', 'paid')
          .single()

        if (enrollment) {
          window.location.href = learnUrl
          return
        }

        if (!userData.phone) {
          setLoading(false)
          setStep('phone')
          return
        }
      }

      const isNothingFree = !course.free_preview_config || course.free_preview_config === 'nothing free'
      setStep(isNothingFree ? 'payment' : 'demo')
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone) { setError('WhatsApp number is required'); return }

    // Validation: Must be 10 digits
    const cleanedPhone = phone.trim().replace(/\D/g, '')
    if (cleanedPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number')
      return
    }

    const phoneToStore = selectedCountry.code.replace('+', '') + cleanedPhone

    setLoading(true)
    setError('')

    try {
      // Check if this phone number is already enrolled in this course
      const { data: existing } = await supabase
        .from('enrollments')
        .select('id')
        .eq('course_uuid', course.id)
        .eq('phone', phoneToStore)
        .eq('payment_status', 'paid')
        .maybeSingle()

      if (existing) {
        setError('This mobile number is already enrolled in this course.')
        setLoading(false)
        return
      }

      // Update user metadata with phone
      await supabase.auth.updateUser({ data: { phone: phoneToStore } })
      setStudentData((prev: any) => ({ ...prev, phone: phoneToStore }))
      
      const isNothingFree = !course.free_preview_config || course.free_preview_config === 'nothing free'
      setStep(isNothingFree ? 'payment' : 'demo')
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handlePayment() {
    setLoading(true)
    setError('')

    try {
      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Failed to load Razorpay. Check your connection.')

      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: course.price,
          courseId: course.id,
          creatorSlug: course.creatorSlug,
        }),
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
            // Generate WhatsApp token if delivery includes WhatsApp
            if (course.waNumber) {
              await generateToken(true, response.razorpay_payment_id)
            }
            setStep('success')
            // Auto redirect to learn page after 2 seconds
            setTimeout(() => {
              window.location.href = learnUrl
            }, 2000)
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

  if (checkingAuth) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)'}}>
        <div className="w-10 h-10 violet-gradient rounded-xl animate-pulse-glow" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)'}}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{background:'#0a0a0a', border:'1px solid rgba(124,58,237,0.3)'}}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b"
          style={{borderColor:'rgba(255,255,255,0.06)'}}>
          <div>
            <h2 className="font-semibold text-white">
              {step === 'auth' ? 'Enroll in Course' :
               step === 'phone' ? 'Add WhatsApp Number' :
               step === 'demo' ? 'Watch Demo' :
               step === 'payment' ? 'Complete Payment' :
               'You\'re Enrolled! 🎉'}
            </h2>
            <p className="text-xs mt-0.5" style={{color:'#52525b'}}>{course.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── AUTH STEP ── */}
        {step === 'auth' && (
          <div className="p-6">
            {/* Mode toggle */}
            <div className="flex rounded-xl p-1 mb-5"
              style={{background:'rgba(255,255,255,0.05)'}}>
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

            {/* Google */}
            <button onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-white text-sm mb-5 transition-all hover:opacity-90"
              style={{background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)'}}>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 h-px" style={{background:'rgba(255,255,255,0.08)'}} />
              <span className="text-xs" style={{color:'#52525b'}}>or with email</span>
              <div className="flex-1 h-px" style={{background:'rgba(255,255,255,0.08)'}} />
            </div>

            <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
              {authMode === 'signup' && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'#52525b'}} />
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Full name" required
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                    onFocus={e => e.target.style.borderColor = '#7c3aed'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'#52525b'}} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Email address" required
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              </div>

              {authMode === 'signup' && (
                <div className="flex gap-2">
                  <CountrySelector selected={selectedCountry} onSelect={setSelectedCountry} />
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'#52525b'}} />
                    <input type="tel" value={phone} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '')
                        if (val.length <= 10) setPhone(val)
                      }}
                      placeholder="Mobile number (10 digits)" required
                      maxLength={10}
                      className="w-full pl-10 pr-4 py-3 rounded-r-xl text-sm text-white outline-none"
                      style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderLeft:'none'}}
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
                  style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{color:'#52525b'}}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-xl text-sm"
                  style={{background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)'}}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-medium text-white violet-gradient hover:opacity-90 glow disabled:opacity-50 mt-1">
                {loading ? 'Please wait...' :
                 authMode === 'signup' ? 'Sign Up & Continue →' : 'Sign In & Continue →'}
              </button>
            </form>

            <div className="flex items-center gap-2 mt-4 p-3 rounded-xl"
              style={{background:'rgba(74,222,128,0.05)', border:'1px solid rgba(74,222,128,0.1)'}}>
              <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{color:'#4ade80'}} />
              <p className="text-xs" style={{color:'#52525b'}}>
                Your WhatsApp number is needed to deliver lessons after payment.
              </p>
            </div>
          </div>
        )}

        {/* ── PHONE STEP (after Google login) ── */}
        {step === 'phone' && (
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.2)'}}>
                <Phone className="w-6 h-6" style={{color:'#25d366'}} />
              </div>
              <h3 className="font-semibold text-white mb-1">One more thing</h3>
              <p className="text-sm" style={{color:'#a1a1aa'}}>
                We need your WhatsApp number to deliver lessons after payment.
              </p>
            </div>

            <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
              <div className="flex gap-2">
                <CountrySelector selected={selectedCountry} onSelect={setSelectedCountry} />
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'#52525b'}} />
                  <input type="tel" value={phone} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      if (val.length <= 10) setPhone(val)
                    }}
                    placeholder="10 digit number" required
                    maxLength={10}
                    className="w-full pl-10 pr-4 py-3 rounded-r-xl text-sm text-white outline-none"
                    style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderLeft:'none'}}
                    onFocus={e => e.target.style.borderColor = '#7c3aed'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
              </div>
              {error && (
                <p className="text-sm" style={{color:'#ef4444'}}>{error}</p>
              )}
              <button type="submit"
                className="w-full py-3 rounded-xl font-medium text-white violet-gradient hover:opacity-90 glow">
                Continue to Payment →
              </button>
            </form>
          </div>
        )}

        {/* ── DEMO STEP ── */}
        {step === 'demo' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)'}}>
              <Play className="w-8 h-8 text-violet-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Welcome, {studentData?.name}!</h3>
            <p className="text-sm mb-6" style={{color:'#a1a1aa'}}>
              You can start watching the free lessons right now.
            </p>
            <div className="flex flex-col gap-3">
              {/* WhatsApp option */}
              {course.waNumber && (
                <>
                  {demoWaToken ? (
                    <a
                      href={`https://wa.me/${course.waNumber.replace(/[\s+\-()]/g, '')}?text=ENROLL:${demoWaToken}`}
                      target="_blank" rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white transition-all hover:opacity-90 glow-strong text-lg"
                      style={{background:'#25d366'}}>
                      <MessageCircle className="w-6 h-6" />
                      Start Free Lessons on WhatsApp
                    </a>
                  ) : (
                    <div className="w-full py-4 rounded-xl text-sm text-center"
                      style={{background:'rgba(37,211,102,0.08)', color:'#25d366', border:'1px solid rgba(37,211,102,0.15)'}}>
                      Preparing WhatsApp link...
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] uppercase tracking-widest text-zinc-600">OR</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                </>
              )}

              <button onClick={() => window.location.href = learnUrl}
                className="w-full py-3.5 rounded-xl font-medium text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                Watch Demo on Website
              </button>
              
              <button onClick={() => setStep('payment')}
                className="text-xs text-zinc-500 hover:text-white transition-colors mt-2">
                Skip to Payment — ₹{course.price.toLocaleString()}
              </button>
            </div>
          </div>
        )}

        {/* ── PAYMENT STEP ── */}
        {step === 'payment' && (
          <div className="p-6">
            <div className="rounded-xl p-4 mb-5"
              style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)'}}>
              <p className="text-xs mb-3 font-semibold uppercase tracking-wider" style={{color:'#52525b'}}>
                Order Summary
              </p>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-white">{course.name}</span>
                <span className="text-sm font-bold text-white">₹{course.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-3 mt-2"
                style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-lg font-bold text-white">₹{course.price.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="w-5 h-5 violet-gradient rounded flex items-center justify-center flex-shrink-0">
                  <Shield className="w-3 h-3 text-white" />
                </div>
                <p className="text-xs" style={{color:'#52525b'}}>
                  Enrolling as <strong className="text-white">{studentData?.email}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-xl p-4 mb-5"
              style={{background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.15)'}}>
              <p className="text-xs font-semibold mb-2" style={{color:'#8b5cf6'}}>After payment you'll get:</p>
              {[
                course.waNumber ? 'First lesson delivered to your WhatsApp instantly' : null,
                'Access to the web learning portal',
                'Certificate on course completion',
                'Lifetime access — no expiry',
              ].filter(Boolean).map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:'#8b5cf6'}} />
                  <p className="text-xs" style={{color:'#a1a1aa'}}>{item}</p>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm mb-4"
                style={{background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)'}}>
                {error}
              </div>
            )}

            <button onClick={handlePayment} disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 glow-strong disabled:opacity-50 text-lg">
              {loading ? 'Opening payment...' : `Pay ₹${course.price.toLocaleString()} Securely`}
            </button>
            <p className="text-center text-xs mt-3" style={{color:'#3f3f46'}}>
              Powered by Razorpay · 256-bit SSL
            </p>
            <button onClick={() => setStep('auth')}
              className="w-full text-center text-xs mt-2" style={{color:'#52525b'}}>
              ← Back
            </button>
          </div>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === 'success' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)'}}>
              <Shield className="w-8 h-8" style={{color:'#4ade80'}} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Payment Successful! 🎉</h3>
            <p className="text-sm mb-6" style={{color:'#a1a1aa'}}>
              You are enrolled in <strong className="text-white">{course.name}</strong>.
              Choose how you want to start learning:
            </p>

            <div className="flex flex-col gap-3">
              {/* Web option */}
              <a href={learnUrl}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium text-white violet-gradient hover:opacity-90 glow transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Start Course
              </a>

              {/* WhatsApp option */}
              {course.waNumber && (
                <>
                  {waToken && !generatingToken ? (
                    <a
                      href={`https://wa.me/${course.waNumber.replace(/[\s+\-()]/g, '')}?text=ENROLL:${waToken}`}
                      target="_blank" rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium text-white transition-all hover:opacity-90"
                      style={{background:'#25d366'}}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Join via WhatsApp
                    </a>
                  ) : generatingToken ? (
                    <div className="w-full py-3.5 rounded-xl text-sm text-center"
                      style={{background:'rgba(37,211,102,0.08)', color:'#25d366', border:'1px solid rgba(37,211,102,0.15)'}}>
                      Generating secure WhatsApp link...
                    </div>
                  ) : null}
                </>
              )}

              <button onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm transition-all"
                style={{background:'rgba(255,255,255,0.04)', color:'#a1a1aa'}}>
                Close
              </button>
            </div>

            <p className="text-xs mt-4" style={{color:'#3f3f46'}}>
              Progress syncs between WhatsApp and web portal automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}