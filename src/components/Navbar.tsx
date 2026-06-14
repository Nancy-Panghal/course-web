
import { useState, useEffect } from 'react'
import Link from 'next/link' 
import { Shield, Menu, X, LayoutDashboard, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { resolveAccountType } from '@/lib/account'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isCreator, setIsCreator] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)

    async function syncUser(sessionUser: any | null) {
      setUser(sessionUser ?? null)
      if (!sessionUser) {
        setIsCreator(false)
        return
      }
      const accountType = await resolveAccountType(sessionUser)
      setIsCreator(accountType === 'creator')
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      syncUser(session?.user ?? null)
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      subscription.unsubscribe()
    }
  }, [])

  const logoHref = user ? (isCreator ? '/dashboard' : '/my-courses') : '/'

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-border' : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={logoHref} className="flex items-center gap-2 group">
          <div className="w-8 h-8 violet-gradient rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white text-lg">AcademyKit</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/#features" className="text-sm transition-colors" style={{color:'#a1a1aa'}}>Features</Link>
          <Link href="/#how-it-works" className="text-sm transition-colors" style={{color:'#a1a1aa'}}>How it works</Link>
          <Link href="/#pricing" className="text-sm transition-colors" style={{color:'#a1a1aa'}}>Pricing</Link>
          <Link href="/contact" className="text-sm transition-colors" style={{color:'#a1a1aa'}}>Contact</Link>

          {!user && (
            <>
              <Link href="/login" className="text-sm transition-colors" style={{color:'#a1a1aa'}}>Login</Link>
              <Link href="/login"
                className="violet-gradient px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 glow">
                Get Started Free
              </Link>
            </>
          )}

          {user && isCreator && (
            <Link href="/dashboard"
              className="flex items-center gap-2 violet-gradient px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 glow">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          )}

          {user && !isCreator && (
            <Link href="/my-courses"
              className="flex items-center gap-2 violet-gradient px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 glow">
              <BookOpen className="w-4 h-4" />
              My Courses
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden" style={{color:'#a1a1aa'}}
          onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-b px-6 py-4 flex flex-col gap-4"
          style={{background:'rgba(0,0,0,0.95)', backdropFilter:'blur(20px)', borderColor:'rgba(255,255,255,0.06)'}}>
          <Link href="/#features" className="text-sm" style={{color:'#a1a1aa'}} onClick={() => setMenuOpen(false)}>Features</Link>
          <Link href="/#how-it-works" className="text-sm" style={{color:'#a1a1aa'}} onClick={() => setMenuOpen(false)}>How it works</Link>
          <Link href="/#pricing" className="text-sm" style={{color:'#a1a1aa'}} onClick={() => setMenuOpen(false)}>Pricing</Link>
          <Link href="/contact" className="text-sm" style={{color:'#a1a1aa'}} onClick={() => setMenuOpen(false)}>Contact</Link>

          {!user && (
            <Link href="/login"
              className="violet-gradient px-4 py-2 rounded-lg text-white text-sm font-medium text-center"
              onClick={() => setMenuOpen(false)}>
              Get Started Free
            </Link>
          )}

          {user && isCreator && (
            <Link href="/dashboard"
              className="flex items-center justify-center gap-2 violet-gradient px-4 py-2 rounded-lg text-white text-sm font-medium"
              onClick={() => setMenuOpen(false)}>
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          )}

          {user && !isCreator && (
            <Link href="/my-courses"
              className="flex items-center justify-center gap-2 violet-gradient px-4 py-2 rounded-lg text-white text-sm font-medium"
              onClick={() => setMenuOpen(false)}>
              <BookOpen className="w-4 h-4" />
              My Courses
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
