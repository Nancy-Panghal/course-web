'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ensureCreatorProfile, getTrialStatus } from '@/lib/creator'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [trialBanner, setTrialBanner] = useState<{ show: boolean, daysLeft: number, expired: boolean }>({
    show: false, daysLeft: 30, expired: false
  })

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Also check if user is a creator
      const role = session.user?.user_metadata?.role
      if (role === 'student') {
        router.push('/')
        return
      }

      // Ensure creator profile exists
      const creator = await ensureCreatorProfile()
      const trial = getTrialStatus(creator)

      // Show banner if less than 7 days left or expired
      if (trial.daysLeft <= 7 || trial.expired) {
        setTrialBanner({ show: true, daysLeft: trial.daysLeft, expired: trial.expired })
      }

      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 violet-gradient rounded-xl animate-pulse-glow" />
          <p className="text-sm" style={{ color: '#a1a1aa' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Trial banner */}
      {trialBanner.show && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-2.5"
          style={{
            background: trialBanner.expired
              ? 'rgba(239,68,68,0.95)'
              : 'rgba(245,158,11,0.95)',
            backdropFilter: 'blur(12px)'
          }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
            <p className="text-sm text-white font-medium">
              {trialBanner.expired
                ? 'Your free trial has expired. Upgrade to keep your academy live.'
                : `Your free trial ends in ${trialBanner.daysLeft} day${trialBanner.daysLeft !== 1 ? 's' : ''}. Upgrade to continue after trial.`
              }
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href="/contact"
              className="text-xs text-white/70 hover:text-white transition-colors">
              Need help?
            </Link>
            <Link href="/upgrade"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              Upgrade Now →
            </Link>
          </div>
        </div>
      )}
      <div style={{ marginTop: trialBanner.show ? '44px' : '0' }}>
        {children}
      </div>
    </>
  )
}