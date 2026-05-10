'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  Users, BookOpen, TrendingUp, Shield,
  AlertTriangle, CheckCircle, Clock
} from 'lucide-react'

const recentActivity = [
  { text: 'Riya Sharma completed Lesson 4', time: '2 min ago', type: 'complete' },
  { text: 'Arjun Nair enrolled in SEO Masterclass', time: '18 min ago', type: 'enroll' },
  { text: 'Certificate sent to Priya Mehta', time: '1 hr ago', type: 'cert' },
  { text: 'Piracy link nuked — t.me/free_courses_hd', time: '3 hr ago', type: 'shield' },
  { text: 'Vikram Kumar completed Lesson 2', time: '5 hr ago', type: 'complete' },
  { text: 'New enrollment — Sneha Patel', time: '7 hr ago', type: 'enroll' },
]

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
    nuked: 14,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    // Fetch real stats from Supabase
    async function fetchStats() {
      const [{ count: students }, { count: lessons }] = await Promise.all([
        supabase.from('enrollments').select('*', { count: 'exact', head: true }),
        supabase.from('lessons').select('*', { count: 'exact', head: true }),
      ])
      setStats(s => ({ ...s, students: students || 0, lessons: lessons || 0, completion: 54 }))
    }
    fetchStats()
  }, [])

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: Users, color: '#8b5cf6', change: '+12 this week' },
    { label: 'Total Lessons', value: stats.lessons, icon: BookOpen, color: '#3b82f6', change: 'Active course' },
    { label: 'Completion Rate', value: `${stats.completion}%`, icon: TrendingUp, color: '#4ade80', change: '+8% vs last month' },
    { label: 'Links Nuked', value: stats.nuked, icon: Shield, color: '#ef4444', change: 'This month' },
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
              {recentActivity.map((a, i) => {
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
              })}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-col gap-4">

            {/* Piracy alert */}
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>Active Threats</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">3</div>
              <p className="text-xs" style={{ color: '#a1a1aa' }}>Piracy links detected — filing takedowns</p>
            </div>

            {/* Completion ring */}
            <div className="rounded-2xl p-5 glass"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-sm font-semibold text-white mb-4">Completion Funnel</h3>
              {[
                { label: 'Enrolled', pct: 100, color: '#8b5cf6' },
                { label: 'Started', pct: 78, color: '#3b82f6' },
                { label: 'Halfway', pct: 61, color: '#facc15' },
                { label: 'Completed', pct: 54, color: '#4ade80' },
              ].map((r, i) => (
                <div key={i} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: '#a1a1aa' }}>{r.label}</span>
                    <span className="text-white font-medium">{r.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width: `${r.pct}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl p-5 glass"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Upload new lesson', href: '/dashboard/lessons' },
                  { label: 'View all students', href: '/dashboard/students' },
                  { label: 'Check piracy shield', href: '/dashboard/piracy' },
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