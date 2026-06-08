'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Shield, BookOpen, CheckCircle, Clock, TrendingUp,
  Play, ChevronRight, User, Award, LayoutDashboard,
  LogOut, MessageCircle, Layers,Download, ExternalLink,
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
  certificateId: string | null
  certificateUrl: string | null
  telegramBotUsername: string | null
  payment_status: string
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
  const [certGenerating, setCertGenerating] = useState<Set<string>>(new Set())
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ''
const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || ''
const displayEmail = user?.email || ''

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
        const baseSelect = 'id, course_uuid, current_lesson, completed_lessons, enrolled_at, telegram_start_token, telegram_start_token_expires_at, payment_status, amount_paid, certificate_id, certificate_url'

        function makeBase() {
          return supabase
            .from('enrollments')
            .select(baseSelect)
            .order('enrolled_at', { ascending: false })
        }

        const fetches: Promise<void>[] = []

        if (studentRow?.id) {
          fetches.push(absorb(makeBase().eq('student_id', studentRow.id)))
        }

        const phones: string[] = [
          me.user_metadata?.phone,
          me.phone,
        ].filter(Boolean) as string[]

        for (const p of phones) {
          fetches.push(absorb(makeBase().eq('phone', p)))
        }

        if (me.email) {
          fetches.push(absorb(makeBase().eq('phone', me.email)))
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
              certificateId: e.certificate_id || null,
              certificateUrl: e.certificate_url || null,
              telegramBotUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || null,
              payment_status: e.payment_status || 'free',
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
    const creator = slugify(c.creatorName || 'instructor')
    const course = c.courseSlug || slugify(c.courseName)
    return `/course/${creator}/${course}/${c.courseId}?lesson=${c.currentLesson || 1}`
  }

  async function requestCertificate(c: EnrolledCourse) {
    console.log('[my-courses] requestCertificate called for:', { enrollmentId: c.enrollmentId, courseId: c.courseId })
    setCertGenerating(prev => new Set(prev).add(c.enrollmentId))
    try {
      const payload = { enrollmentId: c.enrollmentId, courseId: c.courseId }
      console.log('[my-courses] Sending certificate request:', payload)
      
      const res = await fetch(`/api/certificate/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      console.log('[my-courses] Response status:', res.status, res.statusText)
      
      const data = await res.json()
      console.log('[my-courses] Response data:', data)
      
      if (!res.ok) {
        console.error('[my-courses] API returned error:', res.status, data)
        return
      }
      
      if ((data.issued || data.alreadyIssued) && data.pdfUrl) {
        console.log('[my-courses] Certificate issued successfully')
        setCourses(prev => prev.map(course =>
          course.enrollmentId === c.enrollmentId
            ? { ...course, certificateId: data.certificateId, certificateUrl: data.pdfUrl }
            : course
        ))
      } else {
        console.warn('[my-courses] Certificate not ready:', data)
      }
    } catch (err) {
      console.error('[my-courses] Error calling certificate API:', err)
    }
    setCertGenerating(prev => { const s = new Set(prev); s.delete(c.enrollmentId); return s })
  }

  function getTelegramLink(c: EnrolledCourse, botUsername?: string) {
    if (!botUsername || !c.telegramToken) return null
    if (c.telegramTokenExpiresAt && new Date(c.telegramTokenExpiresAt) < new Date()) return null
    return `https://t.me/${botUsername.replace('@', '')}?start=${c.telegramToken}`
  }

  
  const completedCount = courses.filter(c => getProgress(c) >= 100).length
  const inProgressCount = courses.filter(c => { const p = getProgress(c); return p > 0 && p < 100 }).length
  const totalLessonsDone = courses.reduce((sum, c) => sum + c.completedLessons.length, 0)

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
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>AcademyKit</span>
        </Link>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, color: '#71717a', background: 'none', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* User info header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {displayName ? displayName.charAt(0).toUpperCase() : displayEmail.charAt(0).toUpperCase()}
            </div>
            <div>
              {displayName && (
                <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>{displayName}</p>
              )}
              <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>{displayEmail}</p>
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '16px 0 4px' }}>
            My Learning
          </h1>
          <p style={{ fontSize: 13, color: '#52525b', margin: 0 }}>
            {loading
              ? 'Loading your courses…'
              : courses.length === 0
              ? 'No enrollments yet.'
              : `${courses.length} course${courses.length !== 1 ? 's' : ''} · ${courses.filter(c => getProgress(c) >= 100).length} completed`
            }
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ height: 110, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {/* Empty state — no browse button */}
        {!loading && !error && courses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <BookOpen className="w-6 h-6" style={{ color: '#6d28d9' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#e4e4e7', marginBottom: 8 }}>No courses yet</p>
            <p style={{ fontSize: 13, color: '#52525b', maxWidth: 280, margin: '0 auto' }}>
              Once you enroll in a course, your progress will appear here.
            </p>
          </div>
        )}

        {/* Course cards */}
        {!loading && courses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {courses.map(c => {
              const progress = getProgress(c)
              const isComplete = progress >= 100
              const isPaid = c.payment_status === 'paid'
              const courseUrl = getCourseUrl(c)
              const hasValidToken = c.telegramToken && c.telegramTokenExpiresAt && new Date(c.telegramTokenExpiresAt) > new Date()

              return (
                <div key={c.enrollmentId} style={{
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.02)',
                  border: isComplete
                    ? '1px solid rgba(74,222,128,0.2)'
                    : '1px solid rgba(255,255,255,0.07)',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = isComplete ? 'rgba(74,222,128,0.35)' : 'rgba(124,58,237,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = isComplete ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.07)')}
                >
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>

                      {/* Left: info */}
                      <div style={{ flex: 1, minWidth: 0 }}>

                        {/* Badges row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                          {isComplete ? (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', letterSpacing: '0.04em' }}>
                              ✓ COMPLETE
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)', letterSpacing: '0.04em' }}>
                              IN PROGRESS
                            </span>
                          )}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.04em',
                            background: isPaid ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                            color: isPaid ? '#22c55e' : '#f59e0b',
                            border: isPaid ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(245,158,11,0.2)',
                          }}>
                            {isPaid ? 'PAID' : 'FREE PREVIEW'}
                          </span>
                          <span style={{ fontSize: 11, color: '#3f3f46' }}>
                            {c.creatorName}
                          </span>
                        </div>

                        {/* Course name */}
                        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 6px', lineHeight: 1.3 }}>
                          {c.courseName}
                        </p>

                        {/* Lessons count */}
                        <p style={{ fontSize: 12, color: '#52525b', margin: 0 }}>
                          {c.completedLessons.length} of {c.totalLessons} lessons complete
                          {c.enrolledAt && (
                            <span style={{ marginLeft: 10 }}>
                              · Enrolled {new Date(c.enrolledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Right: progress + CTA */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: isComplete ? '#4ade80' : '#fff', lineHeight: 1 }}>
                          {progress}%
                        </span>
                        <Link href={courseUrl} style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '7px 14px', borderRadius: 8,
                          background: isComplete ? 'rgba(74,222,128,0.08)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                          color: isComplete ? '#4ade80' : '#fff',
                          fontSize: 12, fontWeight: 700, textDecoration: 'none',
                          border: isComplete ? '1px solid rgba(74,222,128,0.2)' : 'none',
                          whiteSpace: 'nowrap',
                        }}>
                          {isComplete ? 'Review' : 'Continue'} →
                        </Link>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginTop: 14, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${progress}%`,
                        background: isComplete ? '#4ade80' : 'linear-gradient(90deg,#7c3aed,#4f46e5)',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>

                  {/* Telegram strip */}
                  {hasValidToken && botUsername && (
                    <div style={{
                      padding: '9px 20px',
                      background: 'rgba(34,158,217,0.04)',
                      borderTop: '1px solid rgba(34,158,217,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    }}>
                      <span style={{ fontSize: 11, color: '#52525b', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MessageCircle className="w-3.5 h-3.5 inline" style={{ color: '#229ED9' }} />
                        Continue on Telegram
                      </span>
                      <a
                        href={`https://t.me/${botUsername}?start=${c.telegramToken}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, fontWeight: 700, color: '#229ED9', textDecoration: 'none' }}>
                        Open →
                      </a>
                      </div>
                  )}

                  {/* Certificate strip — shown only for completed courses */}
                  {isComplete && (
                    <div style={{
                      padding: '11px 22px',
                      borderTop: '1px solid rgba(212,175,55,0.12)',
                      background: 'rgba(212,175,55,0.03)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                    }}>
                      {c.certificateUrl ? (
                        <>
                          <span style={{ fontSize: 12, color: '#c9a227', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Award className="w-3.5 h-3.5" />
                            Certificate of Completion
                          </span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <a
                              href={c.certificateUrl}
                              target="_blank" rel="noopener noreferrer"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                fontSize: 11, fontWeight: 700, color: '#c9a227',
                                textDecoration: 'none', padding: '4px 12px',
                                border: '1px solid rgba(201,162,39,0.3)', borderRadius: 8,
                              }}>
                              <Download className="w-3 h-3" /> Download PDF
                            </a>
                            {c.certificateId && (
                              <Link
                                href={`/certificate/${c.certificateId}`}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  fontSize: 11, fontWeight: 700, color: '#a78bfa',
                                  textDecoration: 'none',
                                }}>
                                <ExternalLink className="w-3 h-3" /> Verify
                              </Link>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 12, color: '#52525b', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Award className="w-3.5 h-3.5" />
                            Certificate available
                          </span>
                          <button
                            onClick={() => requestCertificate(c)}
                            disabled={certGenerating.has(c.enrollmentId)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              fontSize: 11, fontWeight: 700,
                              color: certGenerating.has(c.enrollmentId) ? '#52525b' : '#c9a227',
                              background: 'none', border: '1px solid rgba(201,162,39,0.2)',
                              padding: '4px 12px', borderRadius: 8, cursor: 'pointer',
                            }}>
                            {certGenerating.has(c.enrollmentId) ? 'Generating…' : 'Get Certificate'}
                          </button>
                        </>
                      )}
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
