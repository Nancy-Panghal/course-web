'use client'
/**
 * /my-schedule
 *
 * Student-facing schedule view. Aggregates upcoming module unlocks across
 * every course the student is enrolled in — one list, not one view per course.
 *
 * - fixed_calendar courses: shows the real IST date/time, same for everyone.
 * - per_student_drip courses: shows the real computed date/time for THIS student.
 * - Already-unlocked modules link straight to their first lesson.
 * - Locked modules show a lock icon and their unlock date/time.
 * - all_at_once courses are excluded — nothing to schedule.
 *
 * Reachable from /my-courses.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Lock, ChevronRight, LogOut, CalendarClock, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ScheduleItem {
  courseId: string
  courseName: string
  creatorName: string
  courseSlug: string
  moduleId: string
  moduleName: string
  moduleOrder: number
  status: 'unlocked' | 'locked' | 'immediate'
  unlockAt?: string   // ISO UTC — only when status === 'locked'
  link?: string       // only when status === 'unlocked' or 'immediate'
  firstLessonNum?: number
}

function fmtIst(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' IST'
}

function fmtRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`
  if (hours > 0) return `in ${hours} hour${hours === 1 ? '' : 's'}`
  return 'very soon'
}

function SkeletonRow() {
  return (
    <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} className="animate-pulse" />
        <div style={{ flex: 1 }}>
          <div style={{ height: 11, width: '35%', borderRadius: 4, background: 'rgba(255,255,255,0.05)', marginBottom: 7 }} className="animate-pulse" />
          <div style={{ height: 15, width: '60%', borderRadius: 4, background: 'rgba(255,255,255,0.08)', marginBottom: 6 }} className="animate-pulse" />
          <div style={{ height: 11, width: '45%', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} className="animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default function MySchedulePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { user: me } } = await supabase.auth.getUser()
      if (!me) {
        router.push('/login?redirect=/my-schedule')
        return
      }
      setUser(me)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Session expired. Please sign in again.'); setLoading(false); return }

      try {
        const res = await fetch('/api/student/schedule', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error || 'Could not load schedule.')
          setLoading(false)
          return
        }
        const { items: data } = await res.json()
        setItems(data || [])
      } catch (err: any) {
        setError(err.message || 'Could not load schedule.')
      }
      setLoading(false)
    }
    load()
  }, [router])

  // Split into upcoming locked vs open.
  const locked = items.filter(i => i.status === 'locked')
  const open = items.filter(i => i.status === 'unlocked' || i.status === 'immediate')

  return (
    <div style={{ minHeight: '100vh', background: '#080808', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* Nav */}
      <nav style={{
        height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(8,8,8,0.97)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,var(--kurso-primary),var(--kurso-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>Kurso</span>
          </Link>
          <Link href="/my-courses" style={{ fontSize: 12, color: '#52525b', textDecoration: 'none' }}>
            ← My Courses
          </Link>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, color: '#71717a', background: 'none', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </nav>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: 'rgba(var(--kurso-primary-rgb), 0.1)',
              border: '1px solid rgba(var(--kurso-primary-rgb), 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CalendarClock className="w-5 h-5" style={{ color: 'var(--kurso-primary-light)' }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>My Schedule</h1>
          </div>
          <p style={{ fontSize: 13, color: '#52525b', margin: 0 }}>
            {loading
              ? 'Loading your schedule…'
              : items.length === 0
                ? 'No scheduled content across your courses.'
                : `${locked.length} upcoming · ${open.length} already open`}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '56px 20px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(var(--kurso-primary-rgb), 0.08)',
              border: '1px solid rgba(var(--kurso-primary-rgb), 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <BookOpen className="w-6 h-6" style={{ color: 'var(--kurso-primary-light)' }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#e4e4e7', marginBottom: 6 }}>Nothing scheduled yet</p>
            <p style={{ fontSize: 13, color: '#52525b', maxWidth: 300, margin: '0 auto 20px' }}>
              Courses you're enrolled in that use timed release will show their modules here.
            </p>
            <Link href="/my-courses" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 10,
              background: 'linear-gradient(135deg,var(--kurso-primary),var(--kurso-secondary))',
              color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}>
              Go to My Courses <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Upcoming locked modules */}
        {!loading && locked.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Coming up
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {locked.map(item => (
                <div key={`${item.courseId}-${item.moduleId}`} style={{
                  borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.02)', padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {/* Lock icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Lock className="w-4 h-4" style={{ color: '#52525b' }} />
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: '#52525b', margin: '0 0 3px', fontWeight: 500 }}>
                      {item.courseName}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.moduleName}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--kurso-primary-light)', margin: 0 }}>
                      🔓 Unlocks {fmtRelative(item.unlockAt!)} · {fmtIst(item.unlockAt!)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Already open modules */}
        {!loading && open.length > 0 && (
          <section>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Already open
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {open.map(item => (
                <Link
                  key={`${item.courseId}-${item.moduleId}`}
                  href={item.link!}
                  style={{
                    borderRadius: 12,
                    border: '1px solid rgba(74,222,128,0.12)',
                    background: 'rgba(74,222,128,0.02)',
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    textDecoration: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.28)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.12)')}
                >
                  {/* Open icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>
                    ▶
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: '#52525b', margin: '0 0 3px', fontWeight: 500 }}>
                      {item.courseName}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.moduleName}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#4ade80' }} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
