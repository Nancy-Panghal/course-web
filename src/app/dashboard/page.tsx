'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  Users, BookOpen, TrendingUp, Shield,
  AlertTriangle, CheckCircle, Clock
} from 'lucide-react'

const activityIcon: Record<string, { icon: any; color: string }> = {
  complete: { icon: CheckCircle, color: '#4ade80' },
  enroll: { icon: Users, color: '#8b5cf6' },
  cert: { icon: TrendingUp, color: '#facc15' },
  shield: { icon: Shield, color: '#ef4444' },
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState({
    students: 0,
    lessons: 0,
    completion: 0,
    nuked: 0,
    activeThreats: 0,
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    // Fetch real stats from Supabase
    async function fetchStats() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) return

        const [{ count: students }, { count: lessons }, { data: enrollments }] = await Promise.all([
          supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('creator_id', currentUser.id),
          supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('creator_id', currentUser.id),
          supabase.from('enrollments').select('current_lesson').eq('creator_id', currentUser.id),
        ])

        // Calculate average completion rate
        let avgCompletion = 0
        if (enrollments && enrollments.length > 0 && lessons && lessons > 0) {
          const totalProgress = enrollments.reduce((acc, curr) => {
            const progress = Math.min(Math.round(((curr.current_lesson - 1) / lessons) * 100), 100)
            return acc + progress
          }, 0)
          avgCompletion = Math.round(totalProgress / enrollments.length)
        }

        // Try to fetch piracy stats if table exists
        let nukedCount = 0
        let activeThreats = 0
        try {
          const { count: nuked } = await supabase.from('piracy_reports').select('*', { count: 'exact', head: true }).eq('status', 'nuked').eq('creator_id', currentUser.id)
          const { count: active } = await supabase.from('piracy_reports').select('*', { count: 'exact', head: true }).in('status', ['detected', 'filed']).eq('creator_id', currentUser.id)
          nukedCount = nuked || 0
          activeThreats = active || 0
        } catch (e) {
          // Table might not exist yet
        }

        setStats({
          students: students || 0,
          lessons: lessons || 0,
          completion: avgCompletion,
          nuked: nukedCount,
          activeThreats: activeThreats,
        })

        // Generate dynamic activity from enrollments
        if (enrollments) {
          const { data: recentEnrolls } = await supabase
            .from('enrollments')
            .select('*')
            .eq('creator_id', currentUser.id)
            .order('enrolled_at', { ascending: false })
            .limit(5)
          
          if (recentEnrolls) {
            setRecentActivity(recentEnrolls.map(e => ({
              text: `New enrollment — +${e.phone}`,
              time: new Date(e.enrolled_at).toLocaleDateString(),
              type: 'enroll'
            })))
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: Users, color: '#8b5cf6', change: 'Enrolled' },
    { label: 'Total Lessons', value: stats.lessons, icon: BookOpen, color: '#3b82f6', change: 'Active course' },
    { label: 'Completion Rate', value: `${stats.completion}%`, icon: TrendingUp, color: '#4ade80', change: 'Average' },
    { label: 'Links Nuked', value: stats.nuked, icon: Shield, color: '#ef4444', change: 'Total' },
  ]

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            Welcome back{user?.user_metadata?.full_name
              ? `, ${user.user_metadata.full_name}`
              : user?.email
                ? `, ${user.email.split('@')[0]}`
                : ''} 👋
          </h1>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>
            Here's what's happening with your academy today.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={i} className="rounded-2xl p-5 glass glow"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${s.color}18` }}>
                    <Icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
                    {s.change}
                  </span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-sm" style={{ color: '#a1a1aa' }}>{s.label}</div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent Activity */}
          <div className="lg:col-span-2 rounded-2xl p-6 glass"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="font-semibold text-white mb-5">Recent Activity</h2>
            <div className="flex flex-col gap-1">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-6 h-6 border-2 border-violet border-t-transparent rounded-full animate-spin" />
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm" style={{ color: '#52525b' }}>No recent activity yet.</p>
                </div>
              ) : (
                recentActivity.map((a, i) => {
                  const { icon: Icon, color } = activityIcon[a.type] || activityIcon.enroll
                  return (
                    <div key={i} className="flex items-start gap-3 py-3"
                      style={{ borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${color}15` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{a.text}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>{a.time}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-col gap-4">

            {/* Piracy alert */}
            <div className="rounded-2xl p-5"
              style={{ background: stats.activeThreats > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(74,222,128,0.08)', border: stats.activeThreats > 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(74,222,128,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                {stats.activeThreats > 0 ? (
                  <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                ) : (
                  <Shield className="w-4 h-4" style={{ color: '#4ade80' }} />
                )}
                <span className="text-sm font-semibold" style={{ color: stats.activeThreats > 0 ? '#ef4444' : '#4ade80' }}>
                  {stats.activeThreats > 0 ? 'Active Threats' : 'Shield Active'}
                </span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.activeThreats}</div>
              <p className="text-xs" style={{ color: '#a1a1aa' }}>
                {stats.activeThreats > 0 ? 'Piracy links detected — filing takedowns' : 'No active threats detected'}
              </p>
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl p-5 glass"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Upload new course', href: '/dashboard/courses' },
                  { label: 'View all students', href: '/dashboard/students' },
                  { label: 'Open revenue dashboard', href: '/dashboard/revenue' },
                  { label: 'Check piracy shield', href: '/dashboard/piracy' },
                  { label: 'Have trouble, contact us', href: '/contact' },
                ].map((a, i) => (
                  <a key={i} href={a.href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#a1a1aa' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(124,58,237,0.12)'
                      e.currentTarget.style.color = '#8b5cf6'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      e.currentTarget.style.color = '#a1a1aa'
                    }}
                  >
                    {a.label}
                    <span>→</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
