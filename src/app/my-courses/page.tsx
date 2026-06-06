'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Shield, BookOpen, CheckCircle, Clock, TrendingUp,
  Play, ChevronRight, User, Award, LayoutDashboard,
  LogOut, MessageCircle, Layers
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/utils'

interface EnrolledCourse {
  enrollmentId: string
  courseId: string
  courseName: string
  courseSlug: string
  creatorName: string
  enrolledAt: string
  currentLesson: number
  completedLessons: number[]
  totalLessons: number
  telegramToken: string | null
  telegramTokenExpiresAt: string | null
}

function ProgressRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct >= 100 ? '#4ade80' : '#8b5cf6'
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ fontSize: size < 48 ? 9 : 11, fontWeight: 800, fill: color }}>
        {pct}%
      </text>
    </svg>
  )
}

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: '24px', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: '40%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} className="animate-pulse" />
          <div style={{ height: 20, width: '70%', borderRadius: 6, background: 'rgba(255,255,255,0.08)', marginBottom: 8 }} className="animate-pulse" />
          <div style={{ height: 12, width: '30%', borderRadius: 6, background: 'rgba(255,255,255,0.05)' }} className="animate-pulse" />
        </div>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} className="animate-pulse" />
      </div>
      <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.05)', marginTop: 18 }} className="animate-pulse" />
    </div>
  )
}

export default function MyCoursesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [courses, setCourses] = useState<EnrolledCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user: me } } = await supabase.auth.getUser()
      if (!me) {
        router.push('/login?redirect=/my-courses')
        return
      }
      // Creators belong in their own dashboard, not here
      if (me.user_metadata?.role === 'creator') {
        router.push('/dashboard')
        return
      }
      setUser(me)

      try {
        // Look up the student record
        const { data: studentRow } = await supabase
          .from('students')
          .select('id')
          .eq('auth_id', me.id)
          .limit(1)
          .maybeSingle()

        // Build a deduplicated list of enrollments across all identifier strategies
        const seen = new Set<string>()
        const allEnrollments: any[] = []

        async function absorb(query: any) {
          const { data } = await query
          if (!data) return
          for (const e of data) {
            if (!seen.has(e.course_uuid)) {
              seen.add(e.course_uuid)
              allEnrollments.push(e)
            }
          }
        }

        const baseSelect = 'id, course_uuid, current_lesson, completed_lessons, enrolled_at, telegram_start_token, telegram_start_token_expires_at'
        const baseFilter = supabase.from('enrollments').select(baseSelect).eq('payment_status', 'paid').order('enrolled_at', { ascending: false })

        const fetches: Promise<void>[] = []

        if (studentRow?.id) {
          fetches.push(absorb(baseFilter.eq('student_id', studentRow.id)))
        }

        const phones: string[] = [me.user_metadata?.phone, me.phone].filter(Boolean)
        for (const p of phones) {
          fetches.push(absorb(baseFilter.eq('phone', p)))
        }

        if (me.email) {
          // Some legacy enrollments store email in the phone field
          fetches.push(absorb(baseFilter.eq('phone', me.email)))
        }

        await Promise.all(fetches)

        if (allEnrollments.length === 0) {
          setLoading(false)
          return
        }

        const courseIds = allEnrollments.map(e => e.course_uuid)

        // Fetch course metadata + published lesson counts in parallel
        const [{ data: courseData }, { data: lessonData }] = await Promise.all([
          supabase
            .from('courses')
            .select('id, name, slug, host_name, creator_id, total_lessons')
            .in('id', courseIds),
          supabase
            .from('lessons')
            .select('course_id')
            .in('course_id', courseIds)
            .eq('is_published', true),
        ])

        const lessonCountByCourse: Record<string, number> = {}
        for (const l of lessonData || []) {
          lessonCountByCourse[l.course_id] = (lessonCountByCourse[l.course_id] || 0) + 1
        }

        const courseById: Record<string, any> = {}
        for (const c of courseData || []) courseById[c.id] = c

        const enriched: EnrolledCourse[] = allEnrollments
          .map(e => {
            const c = courseById[e.course_uuid]
            if (!c) return null
            const published = lessonCountByCourse[e.course_uuid] || 0
            const total = Math.max(c.total_lessons || 0, published)
            return {
              enrollmentId: e.id,
              courseId: c.id,
              courseName: c.name,
              courseSlug: c.slug || '',
              creatorName: c.host_name || 'Creator',
              enrolledAt: e.enrolled_at,
              currentLesson: e.current_lesson || 1,
              completedLessons: Array.isArray(e.completed_lessons) ? e.completed_lessons : [],
              totalLessons: total,
              telegramToken: e.telegram_start_token || null,
              telegramTokenExpiresAt: e.telegram_start_token_expires_at || null,
            }
          })
          .filter(Boolean) as EnrolledCourse[]

        setCourses(enriched)
      } catch (err: any) {
        setError(err.message || 'Failed to load courses')
      }
      setLoading(false)
    }
    load()
  }, [])

  function getProgress(c: EnrolledCourse) {
    if (!c.totalLessons) return 0
    return Math.min(Math.round((c.completedLessons.length / c.totalLessons) * 100), 100)
  }

  function getStatus(c: EnrolledCourse) {
    const p = getProgress(c)
    if (p >= 100) return { label: 'Completed', bg: 'rgba(74,222,128,0.1)', color: '#4ade80' }
    if (c.completedLessons.length > 0 || c.currentLesson > 1) return { label: 'In Progress', bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }
    return { label: 'Just Started', bg: 'rgba(250,204,21,0.08)', color: '#facc15' }
  }

  function getCourseUrl(c: EnrolledCourse) {
    const creator = slugify(c.creatorName)
    const course = c.courseSlug || slugify(c.courseName)
    return `/course/${creator}/${course}/${c.courseId}?lesson=${c.currentLesson}`
  }

  function getTelegramLink(c: EnrolledCourse, botUsername?: string) {
    if (!botUsername || !c.telegramToken) return null
    if (c.telegramTokenExpiresAt && new Date(c.telegramTokenExpiresAt) < new Date()) return null
    return `https://t.me/${botUsername.replace('@', '')}?start=${c.telegramToken}`
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Student'
  const completedCount = courses.filter(c => getProgress(c) >= 100).length
  const inProgressCount = courses.filter(c => { const p = getProgress(c); return p > 0 && p < 100 }).length
  const totalLessonsDone = courses.reduce((sum, c) => sum + c.completedLessons.length, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#080808' }}>

      {/* Sticky nav */}
      <nav style={{
        height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>AcademyKit</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/dashboard"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, color: '#a1a1aa', textDecoration: 'none', background: 'rgba(255,255,255,0.04)' }}>
            <LayoutDashboard className="w-3.5 h-3.5" /> Creator Dashboard
          </Link>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer' }}>
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '44px 16px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 'clamp(1.5rem,4vw,2rem)', fontWeight: 800, color: '#fff', marginBottom: 6 }}>
            My Learning 👋
          </h1>
          <p style={{ color: '#71717a', fontSize: 14 }}>
            {loading
              ? 'Loading your courses…'
              : courses.length === 0
                ? "You haven't enrolled in any courses yet."
                : `Welcome back, ${displayName}. ${courses.length} course${courses.length !== 1 ? 's' : ''} in your library.`}
          </p>
        </div>

        {/* Stats */}
        {!loading && courses.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 36 }}>
            {[
              { label: 'Total Courses', value: courses.length, icon: Layers, color: '#8b5cf6' },
              { label: 'Completed', value: completedCount, icon: Award, color: '#4ade80' },
              { label: 'In Progress', value: inProgressCount, icon: TrendingUp, color: '#3b82f6' },
              { label: 'Lessons Done', value: totalLessonsDone, icon: CheckCircle, color: '#f59e0b' },
            ].map(({ label, value, icon: Icon, color }, i) => (
              <div key={i} style={{ padding: '18px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#52525b', marginTop: 5 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13 }}>
            Something went wrong: {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && courses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '72px 20px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(124,58,237,0.09)', border: '1px solid rgba(124,58,237,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <BookOpen className="w-8 h-8" style={{ color: '#8b5cf6' }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>No courses yet</h2>
            <p style={{ color: '#71717a', fontSize: 13, maxWidth: 300, margin: '0 auto 24px' }}>
              Once you enroll in a course, it will appear here so you can pick up right where you left off.
            </p>
            <Link href="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Browse Courses <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Course cards */}
        {!loading && courses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {courses.map(c => {
              const progress = getProgress(c)
              const status = getStatus(c)
              const courseUrl = getCourseUrl(c)
              const isComplete = progress >= 100

              return (
                <div key={c.enrollmentId}
                  style={{ borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>

                  <div style={{ padding: '22px 22px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>

                      {/* Left: text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Status + creator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', padding: '3px 9px', borderRadius: 20, background: status.bg, color: status.color }}>
                            {status.label}
                          </span>
                          <span style={{ fontSize: 11, color: '#52525b', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <User className="w-3 h-3" /> {c.creatorName}
                          </span>
                        </div>

                        {/* Course name */}
                        <h2 style={{ fontSize: 'clamp(0.95rem,2.5vw,1.1rem)', fontWeight: 700, color: '#fff', marginBottom: 8, lineHeight: 1.3 }}>
                          {c.courseName}
                        </h2>

                        {/* Meta row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: '#52525b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <BookOpen className="w-3 h-3" />
                            {c.completedLessons.length}/{c.totalLessons} lessons
                          </span>
                          <span style={{ fontSize: 12, color: '#52525b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock className="w-3 h-3" />
                            {new Date(c.enrolledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {!isComplete && c.totalLessons > 0 && (
                            <span style={{ fontSize: 12, color: '#52525b' }}>
                              {c.totalLessons - c.completedLessons.length} lesson{c.totalLessons - c.completedLessons.length !== 1 ? 's' : ''} left
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: ring + CTA */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                        <ProgressRing pct={progress} size={52} />

                        <Link href={courseUrl}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '8px 16px', borderRadius: 10,
                            background: isComplete ? 'rgba(74,222,128,0.1)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                            color: isComplete ? '#4ade80' : '#fff',
                            fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
                            border: isComplete ? '1px solid rgba(74,222,128,0.2)' : 'none',
                          }}>
                          {isComplete
                            ? <><Award className="w-3.5 h-3.5" /> Review</>
                            : <><Play className="w-3.5 h-3.5 fill-current" /> Continue</>}
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginTop: 18 }}>
                      <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.05)' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${progress}%`,
                          background: isComplete ? '#4ade80' : 'linear-gradient(90deg,#7c3aed,#4f46e5)',
                          transition: 'width 0.7s ease',
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Telegram footer strip — shown only when a valid token exists */}
                  {c.telegramToken && c.telegramTokenExpiresAt && new Date(c.telegramTokenExpiresAt) > new Date() && (
                    <div style={{ padding: '10px 22px', background: 'rgba(34,158,217,0.04)', borderTop: '1px solid rgba(34,158,217,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 12, color: '#71717a' }}>
                        <MessageCircle className="w-3.5 h-3.5 inline mr-1.5" style={{ color: '#229ED9', verticalAlign: 'middle' }} />
                        Also available on Telegram
                      </span>
                      <a
                        href={`https://t.me/${c.telegramToken}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, fontWeight: 700, color: '#229ED9', textDecoration: 'none' }}>
                        Open Bot →
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
