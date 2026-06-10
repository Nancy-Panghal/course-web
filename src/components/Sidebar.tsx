'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Shield, LayoutDashboard, BookOpen, Users, AlertTriangle, Settings, LogOut, Menu, X, Zap, Bell, IndianRupee, Ticket, CheckCircle2, Megaphone, BarChart3 } from 'lucide-react'

import { supabase } from '@/lib/supabase'

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Courses', href: '/dashboard/courses', icon: BookOpen },
  { label: 'Students', href: '/dashboard/students', icon: Users },
  { label: 'Revenue', href: '/dashboard/revenue', icon: IndianRupee },
  { label: 'Coupons', href: '/dashboard/coupons', icon: Ticket },
  { label: 'Broadcast', href: '/dashboard/broadcast', icon: Megaphone },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Piracy Shield', href: '/dashboard/piracy', icon: AlertTriangle },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

type NotificationItem = {
  id: string
  type: 'payment' | 'login' | 'piracy' | 'enrollment' | 'completion'
  title: string
  message: string
  href: string
  createdAt?: string | null
}

function formatShortTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.max(1, Math.floor(diff / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function notificationVisual(type: NotificationItem['type']) {
  if (type === 'payment') return { icon: IndianRupee, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' }
  if (type === 'login') return { icon: CheckCircle2, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' }
  if (type === 'piracy') return { icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
  if (type === 'enrollment') return { icon: Users, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' }
  return { icon: BookOpen, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeThreats, setActiveThreats] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([])

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const notificationPrefs = user.user_metadata?.notifications || {}
      const nextItems: NotificationItem[] = []

      if (notificationPrefs.login !== false && user.last_sign_in_at) {
        nextItems.push({
          id: 'login-latest',
          type: 'login',
          title: 'New login',
          message: 'Creator account signed in',
          href: '/dashboard',
          createdAt: user.last_sign_in_at,
        })
      }

      try {
        const { count } = await supabase
          .from('piracy_log')
          .select('*', { count: 'exact', head: true })
          .in('status', ['detected', 'filed'])
          .eq('creator_id', user.id)
        setActiveThreats(count || 0)
        if (notificationPrefs.piracy !== false && count && count > 0) {
          nextItems.push({
            id: 'piracy-active',
            type: 'piracy',
            title: 'Piracy alert',
            message: `${count} active threat${count === 1 ? '' : 's'}`,
            href: '/dashboard',
            createdAt: new Date().toISOString(),
          })
        }
      } catch (e) {
        // Table might not exist yet
      }

      if (notificationPrefs.payment !== false) {
        try {
          const { data } = await supabase.rpc('get_my_recent_payments', { limit_count: 3 })
          ;(data || [])
            .filter((payment: any) => payment.status === 'paid')
            .forEach((payment: any) => {
              nextItems.push({
                id: `payment-${payment.payment_id}`,
                type: 'payment',
                title: 'Paid sale',
                message: `₹${Number(payment.net_amount || 0).toLocaleString('en-IN')} · ${payment.course_name || 'Course'}`,
                href: '/dashboard',
                createdAt: payment.paid_at || payment.created_at,
              })
            })
        } catch (e) {
          // Revenue RPC might not be installed yet
        }
      }

      if (notificationPrefs.enrollment !== false) {
        try {
          const { data } = await supabase
            .from('enrollments')
            .select('id, enrolled_at, phone, amount_paid')
            .eq('creator_id', user.id)
            .order('enrolled_at', { ascending: false })
            .limit(3)

          ;(data || []).forEach((enrollment: any) => {
            nextItems.push({
              id: `enrollment-${enrollment.id}`,
              type: 'enrollment',
              title: 'New enrollment',
              message: `${enrollment.phone ? `+${enrollment.phone}` : 'Student'}${enrollment.amount_paid ? ` · ₹${Number(enrollment.amount_paid).toLocaleString('en-IN')}` : ''}`,
              href: '/dashboard',
              createdAt: enrollment.enrolled_at,
            })
          })
        } catch (e) {
          // Enrollment table may be unavailable during setup
        }
      }

      setNotificationItems(
        nextItems
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 5)
      )
    }
    fetchData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full relative">
      {/* Notifications Widget */}
      {showNotifications && (
        <div className="absolute bottom-20 left-4 right-4 p-4 rounded-2xl glass z-50 animate-fade-in-up"
          style={{background:'rgba(10,10,10,0.95)', border:'1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(20px)'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Notifications</h3>
            <button onClick={() => setShowNotifications(false)} className="text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {notificationItems.length > 0 ? (
              notificationItems.map(item => {
                const visual = notificationVisual(item.type)
                const Icon = visual.icon
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      setShowNotifications(false)
                      setMobileOpen(false)
                    }}
                    className="flex items-start gap-3 p-2 rounded-xl transition-all hover:bg-white/5"
                  >
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: visual.bg }}>
                      <Icon className="w-4 h-4" style={{ color: visual.color }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-white truncate">{item.title}</span>
                      <span className="block text-xs truncate" style={{ color: '#a1a1aa' }}>{item.message}</span>
                      {item.createdAt && (
                        <span className="block text-[10px] mt-0.5" style={{ color: '#52525b' }}>{formatShortTime(item.createdAt)}</span>
                      )}
                    </span>
                  </Link>
                )
              })
            ) : (
              <p className="text-xs text-zinc-500 text-center py-4">No new notifications</p>
            )}
            <div className="pt-2 border-t border-white/5">
              <Link href="/dashboard/settings" onClick={() => setShowNotifications(false)}
                className="text-[10px] text-violet-400 font-bold uppercase tracking-widest hover:text-violet-300">
                Manage Settings
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b" style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <div className="w-8 h-8 violet-gradient rounded-lg flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white">AcademyKit</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 flex flex-col gap-1">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                color: active ? '#8b5cf6' : '#a1a1aa',
                border: active ? '1px solid rgba(124,58,237,0.2)' : '1px solid transparent',
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
              {label === 'Piracy Shield' && activeThreats > 0 && (
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{background:'rgba(239,68,68,0.15)', color:'#ef4444'}}>
                  {activeThreats}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Upgrade button */}
      <div className="px-3 pb-2">
        <Link href="/upgrade"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full"
          style={{background:'rgba(124,58,237,0.1)', color:'#8b5cf6', border:'1px solid rgba(124,58,237,0.2)'}}>
          <Zap className="w-4 h-4" />
          Upgrade Plan
        </Link>
      </div>

      {/* Notifications Toggle */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full relative"
          style={{color: showNotifications ? '#8b5cf6' : '#a1a1aa', background: showNotifications ? 'rgba(124,58,237,0.05)' : 'transparent'}}
        >
          <Bell className="w-4 h-4" />
          Notifications
          {notificationItems.length > 0 && (
            <div className="absolute top-2.5 left-6 w-2 h-2 rounded-full bg-red-500 border border-black" />
          )}
        </button>
      </div>

      {/* Logout */}
      <div className="px-3 py-4 border-t" style={{borderColor:'rgba(255,255,255,0.06)'}}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{color:'#a1a1aa'}}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen fixed left-0 top-0 z-40"
        style={{background:'#0a0a0a', borderRight:'1px solid rgba(255,255,255,0.06)'}}>
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 flex flex-col"
            style={{background:'#0a0a0a', borderRight:'1px solid rgba(255,255,255,0.06)'}}>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
