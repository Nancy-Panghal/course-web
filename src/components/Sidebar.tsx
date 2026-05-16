'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Shield, LayoutDashboard, BookOpen, Users, AlertTriangle, Settings, LogOut, Menu, X, Zap, Bell } from 'lucide-react'

import { supabase } from '@/lib/supabase'

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Courses', href: '/dashboard/courses', icon: BookOpen },
  { label: 'Students', href: '/dashboard/students', icon: Users },
  { label: 'Piracy Shield', href: '/dashboard/piracy', icon: AlertTriangle },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeThreats, setActiveThreats] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [userMetadata, setUserMetadata] = useState<any>(null)

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserMetadata(user.user_metadata)

      try {
        const { count } = await supabase
          .from('piracy_log')
          .select('*', { count: 'exact', head: true })
          .in('status', ['detected', 'filed'])
          .eq('creator_id', user.id)
        setActiveThreats(count || 0)
      } catch (e) {
        // Table might not exist yet
      }
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
          <div className="flex flex-col gap-3">
            {userMetadata?.notifications?.piracy && activeThreats > 0 ? (
              <div className="flex items-start gap-3 p-2 rounded-xl bg-red-500/5 border border-red-500/10">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                <p className="text-xs text-red-200">
                  {activeThreats} piracy threats detected. Takedowns are being filed.
                </p>
              </div>
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
          {activeThreats > 0 && userMetadata?.notifications?.piracy && (
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
