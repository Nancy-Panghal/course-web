import { useState, useEffect } from 'react'
import { Shield, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Stage = 'loading' | 'form' | 'success' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [redirectPath, setRedirectPath] = useState('/dashboard')

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash.
    // When the page loads, the SDK parses it and fires an auth state change
    // with event === 'PASSWORD_RECOVERY'. We wait for that to show the form.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Determine where to send the user after reset based on their role
        const role = session?.user?.user_metadata?.role
        setRedirectPath(role === 'creator' ? '/dashboard' : '/my-courses')
        setStage('form')
      } else if (event === 'SIGNED_IN' && stage === 'success') {
        // already handled
      }
    })

    // Fallback: if no recovery event fires within 3 seconds, the link is
    // invalid or already used.
    const timer = setTimeout(() => {
      setStage(prev => prev === 'loading' ? 'invalid' : prev)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setStage('success')
    // Auto-redirect after 2.5 s
    setTimeout(() => router.push(redirectPath), 2500)
  }

  return (
    <div className="min-h-screen bg-black grid-bg flex items-center justify-center px-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 violet-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 glow-strong">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {stage === 'success' ? 'Password updated' : 'Set new password'}
          </h1>
          <p className="text-sm" style={{color:'#a1a1aa'}}>
            {stage === 'success'
              ? "You're all set. Redirecting you now…"
              : stage === 'invalid'
                ? 'This link has expired or already been used.'
                : 'Choose a strong password for your account.'}
          </p>
        </div>

        <div className="glass rounded-2xl p-8 glow"
          style={{border:'1px solid rgba(124,58,237,0.2)'}}>

          {/* Loading */}
          {stage === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-8 h-8 rounded-lg animate-pulse violet-gradient" />
              <p className="text-sm" style={{color:'#71717a'}}>Verifying reset link…</p>
            </div>
          )}

          {/* Invalid / expired */}
          {stage === 'invalid' && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)'}}>
                <AlertCircle className="w-7 h-7" style={{color:'#ef4444'}} />
              </div>
              <p className="text-sm" style={{color:'#a1a1aa'}}>
                Reset links expire after 1 hour and can only be used once.
                Request a new one from the login page.
              </p>
              <Link href="/login"
                className="w-full py-3 rounded-xl font-medium text-white text-sm text-center transition-all violet-gradient hover:opacity-90 glow block">
                Back to Sign In
              </Link>
            </div>
          )}

          {/* Success */}
          {stage === 'success' && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)'}}>
                <CheckCircle className="w-7 h-7" style={{color:'#4ade80'}} />
              </div>
              <p className="text-sm" style={{color:'#a1a1aa'}}>
                Your password has been changed. Taking you to your dashboard…
              </p>
              <Link href={redirectPath}
                className="w-full py-3 rounded-xl font-medium text-white text-sm text-center transition-all violet-gradient hover:opacity-90 glow block">
                Go now →
              </Link>
            </div>
          )}

          {/* Password form */}
          {stage === 'form' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* New password */}
              <div>
                <label className="text-sm font-medium text-white mb-2 block">New password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required minLength={8} autoFocus
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

                {/* Strength hint */}
                {password.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                        style={{background: password.length >= i * 3
                          ? i <= 1 ? '#ef4444' : i <= 2 ? '#f59e0b' : i <= 3 ? '#3b82f6' : '#4ade80'
                          : 'rgba(255,255,255,0.08)'}} />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="text-sm font-medium text-white mb-2 block">Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    className="w-full px-4 pr-10 py-3 rounded-xl text-sm text-white outline-none transition-all"
                    style={{
                      background:'rgba(255,255,255,0.05)',
                      border: confirm && confirm !== password
                        ? '1px solid rgba(239,68,68,0.5)'
                        : confirm && confirm === password
                          ? '1px solid rgba(74,222,128,0.4)'
                          : '1px solid rgba(255,255,255,0.1)',
                    }}
                    onFocus={e => { if (!confirm || confirm === password) e.target.style.borderColor = '#7c3aed' }}
                    onBlur={e => {
                      if (!confirm) e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                    }}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{color:'#52525b'}}>
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                {loading ? 'Updating password…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{color:'#52525b'}}>
          Remember your password?{' '}
          <Link href="/login" style={{color:'#a1a1aa'}}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
