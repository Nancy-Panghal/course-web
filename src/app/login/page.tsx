'use client'
import { useState, useEffect } from 'react'
import { Shield, Mail, ArrowLeft, Eye, EyeOff, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ensureCreatorProfile } from '@/lib/creator'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${redirect}` },
    })
  }

  async function sendLoginNotification() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      await fetch('/api/notifications/login', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
    } catch (err) {
      console.error('Login notification error:', err)
    }
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (mode === 'signup') {
      if (!username.trim()) {
        setError('Username is required')
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: username,
            username,
            role: 'creator',
          },
        },
      })

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setError('Email not confirmed. Please check your inbox or disable email confirmation in Supabase dashboard.')
        } else {
          setError(error.message)
        }
        setLoading(false)
        return
      }

      // Auto sign in after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
          setError('Account created! Please confirm your email to sign in.')
        } else {
          setError('Account created! Please sign in.')
        }
        setMode('login')
        setLoading(false)
        return
      }

      // Create creator profile
      await ensureCreatorProfile()
      await sendLoginNotification()
      router.push(redirect)

    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setError('Email not confirmed. Please check your inbox or disable "Confirm email" in Supabase Auth settings.')
        } else {
          setError(error.message)
        }
        setLoading(false)
        return
      }
      // Ensure creator profile exists
      await ensureCreatorProfile()
      await sendLoginNotification()
      router.push(redirect)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black grid-bg flex items-center justify-center px-6">
      <Link href="/" className="fixed top-6 left-6 flex items-center gap-2 text-sm"
        style={{color:'#a1a1aa'}}>
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 violet-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 glow-strong">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm" style={{color:'#a1a1aa'}}>
            {mode === 'login'
              ? 'Sign in to your AcademyKit creator account'
              : 'Start protecting and delivering your courses'}
          </p>
        </div>

        <div className="glass rounded-2xl p-8 glow"
          style={{border:'1px solid rgba(124,58,237,0.2)'}}>

          {/* Mode toggle */}
          <div className="flex rounded-xl p-1 mb-6"
            style={{background:'rgba(255,255,255,0.05)'}}>
            {(['login', 'signup'] as Mode[]).map(m => (
              <button key={m}
                onClick={() => { setMode(m); setError('') }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: mode === m ? 'rgba(124,58,237,0.3)' : 'transparent',
                  color: mode === m ? '#fff' : '#a1a1aa',
                }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Google */}
          <button onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-medium text-white text-sm mb-6 transition-all hover:opacity-90"
            style={{background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)'}}>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px" style={{background:'rgba(255,255,255,0.08)'}} />
            <span className="text-xs" style={{color:'#52525b'}}>or with email</span>
            <div className="flex-1 h-px" style={{background:'rgba(255,255,255,0.08)'}} />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Username — signup only */}
            {mode === 'signup' && (
              <div>
                <label className="text-sm font-medium text-white mb-2 block">
                  Your Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{color:'#52525b'}} />
                  <input
                    type="text" value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Full name or username"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                    style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                    onFocus={e => e.target.style.borderColor = '#7c3aed'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{color:'#52525b'}} />
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                  style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'}
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  className="w-full px-4 pr-10 py-3 rounded-xl text-sm text-white outline-none transition-all"
                  style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{color:'#52525b'}}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm"
                style={{background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)'}}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-medium text-white text-sm transition-all violet-gradient hover:opacity-90 glow disabled:opacity-50 mt-1">
              {loading
                ? 'Please wait...'
                : mode === 'login' ? 'Sign In' : 'Create Account & Continue'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{color:'#52525b'}}>
          By continuing you agree to our{' '}
          <Link href="/terms" style={{color:'#a1a1aa'}}>Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" style={{color:'#a1a1aa'}}>Privacy Policy</Link>
        </p>

        
      </div>
    </div>
  )
}
