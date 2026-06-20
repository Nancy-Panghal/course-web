'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Shield, LayoutDashboard, BookOpen, Users, Settings, LogOut, Menu, X, Zap, IndianRupee, Ticket, Megaphone, BarChart3, ClipboardList } from 'lucide-react'

import { supabase } from '@/lib/supabase'

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Courses', href: '/dashboard/courses', icon: BookOpen },
  { label: 'Students', href: '/dashboard/students', icon: Users },
  { label: 'Assignments', href: '/dashboard/assignments', icon: ClipboardList }, 
  { label: 'Revenue', href: '/dashboard/revenue', icon: IndianRupee },
  { label: 'Coupons', href: '/dashboard/coupons', icon: Ticket },
  { label: 'Broadcast', href: '/dashboard/broadcast', icon: Megaphone },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full relative">
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
      <aside className="hidden md:flex flex-col w-56 h-screen overflow-y-auto fixed left-0 top-0 z-40"
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
          <aside className="absolute left-0 top-0 bottom-0 w-56 flex flex-col overflow-y-auto"
            style={{background:'#0a0a0a', borderRight:'1px solid rgba(255,255,255,0.06)'}}>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}