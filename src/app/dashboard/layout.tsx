'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveAccountType } from '@/lib/account'
import { ensureCreatorProfile, createCreatorProfile, getTrialStatus } from '@/lib/creator'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [creator, setCreator] = useState<any>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const accountType = await resolveAccountType(session.user)

      if (accountType === 'student') {
        router.push('/my-courses')
        return
      }

      if (accountType !== 'creator') {
        router.push('/login?role=creator')
        return
      }

      let c = await ensureCreatorProfile()
      if (!c && session.user.user_metadata?.role === 'creator') {
        c = await createCreatorProfile()
      }

      if (!c) {
        router.push('/login?role=creator')
        return
      }

      setCreator(c)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 violet-gradient rounded-xl animate-pulse-glow" />
          <p className="text-xs" style={{ color: '#a1a1aa' }}>Loading...</p>
        </div>
      </div>
    )
  }

  const trial = creator ? getTrialStatus(creator) : { expired: false, daysLeft: 7, plan: 'trial' }
  const showTrialBanner = trial.plan === 'trial' && (trial.expired || trial.daysLeft <= 7)

  return (
    <>
      {/* Trial banner - only show if on trial and either expired or days left <=7 */}
      {showTrialBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-2.5"
          style={{
            background: trial.expired
              ? 'rgba(239,68,68,0.95)'
              : 'rgba(245,158,11,0.95)',
            backdropFilter: 'blur(12px)'
          }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-black flex-shrink-0" />
            <p className="text-sm text-black font-medium">
              {trial.expired
                ? 'Your free trial has expired. Upgrade to keep your academy live.'
                : `Your free trial ends in ${trial.daysLeft} day${trial.daysLeft !== 1 ? 's' : ''}. Upgrade to continue after trial.`
              }
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href="/contact"
              className="text-xs text-black/80 hover:text-black transition-colors">
              Need help?
            </Link>
            <Link href="/upgrade"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(0,0,0,0.1)', color: '#000', border: '1px solid rgba(0,0,0,0.2)' }}>
              Upgrade Now →
            </Link>
          </div>
        </div>
      )}
      <div style={{ marginTop: showTrialBanner ? '44px' : '0' }}>
        {children}
      </div>
    </>
  )
}
