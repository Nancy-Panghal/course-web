'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveAccountType } from '@/lib/account'
import { ensureCreatorProfile, createCreatorProfile } from '@/lib/creator'
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

  return (
    <>
      <div>
        {children}
      </div>
    </>
  )
}
