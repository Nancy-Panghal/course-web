'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft, Users, TrendingUp, Clock, BookOpen,
  AlertCircle, CheckCircle2, Send, IndianRupee,
  BarChart3, Zap
} from 'lucide-react'

interface LessonDropoff {
  orderNum: number
  title: string
  completedCount: number
  completionPct: number
}

interface InactiveStudent {
  id: string
  phone: string
  currentLesson: number
  currentLessonTitle: string
  daysSinceAccess: number | null
  lastAccessed: string | null
  enrolledAt: string
  hasTelegram: boolean
}

interface AnalyticsData {
  courseId: string
  courseName: string
  coursePrice: number
  overview: {
    totalEnrolled: number
    completedCount: number
    completionRate: number
    avgProgress: number
    activeCount: number
    inactiveCount: number
    totalLessons: number
  }
  lessonDropoff: LessonDropoff[]
  biggestDropLesson: number
  inactiveStudents: InactiveStudent[]
  revenue: {
    totalRevenue: number
    paidCount: number
    avgAmountPaid: number
  }
}

function money(n: number) {
  return `₹${n.toLocaleString('en-IN')}`
}

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = use(params)
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set())
  const [token, setToken] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)

      const res = await fetch(`/api/analytics/${courseId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error || 'Failed to load analytics')
        setLoading(false)
        return
      }
      const json = await res.json()
      setData(json)
      setLoading(false)
    }
    init()
  }, [courseId, router])

  async function sendReminder(student: InactiveStudent) {
    if (!student.hasTelegram || sendingReminder) return
    setSendingReminder(student.id)

    try {
      const message = `Hey! You left off at *Lesson ${student.currentLesson}: ${student.currentLessonTitle}* in *${data?.courseName}*. Continue learning: ${process.env.NEXT_PUBLIC_APP_URL || ''}/my-courses`
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // Send to a single enrollment — use a targeted broadcast approach
        body: JSON.stringify({
          courseId,
          message,
          targetEnrollmentId: student.id,
        }),
      })
      if (res.ok) {
        setReminderSent(prev => new Set([...prev, student.id]))
      }
    } catch { /* non-fatal */ }
    finally { setSendingReminder(null) }
  }

  const maxCompleted = data
    ? Math.max(...data.lessonDropoff.map(l => l.completedCount), 1)
    : 1

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 violet-gradient rounded-lg animate-pulse-glow" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black">
        <Sidebar />
        <main className="md:ml-56 p-6 md:p-8">
          <div className="rounded-2xl p-8 text-center glass" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#ef4444' }} />
            <p className="text-white font-medium mb-1">{error || 'Course not found'}</p>
            <Link href="/dashboard/courses" className="text-xs text-violet-400 hover:underline">
              ← Back to courses
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const { overview, lessonDropoff, biggestDropLesson, inactiveStudents, revenue } = data

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />
      <main className="md:ml-56 p-6 md:p-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#a1a1aa' }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{data.courseName}</h1>
            <p className="text-sm" style={{ color: '#a1a1aa' }}>Student drop-off analytics</p>
          </div>
        </div>

        {/* ── Overview stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total Enrolled',
              value: overview.totalEnrolled,
              icon: Users,
              color: '#8b5cf6',
            },
            {
              label: 'Completion Rate',
              value: `${overview.completionRate}%`,
              icon: CheckCircle2,
              color: '#4ade80',
              sub: `${overview.completedCount} students finished`,
            },
            {
              label: 'Avg Progress',
              value: `${overview.avgProgress}%`,
              icon: TrendingUp,
              color: '#38bdf8',
              sub: `across ${overview.totalLessons} lessons`,
            },
            {
              label: 'Active (7d)',
              value: overview.activeCount,
              icon: Zap,
              color: '#f59e0b',
              sub: `${overview.inactiveCount} inactive`,
            },
          ].map((card, i) => {
            const Icon = card.icon
            return (
              <div key={i} className="rounded-2xl p-5 glass"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${card.color}18` }}>
                    <Icon className="w-4 h-4" style={{ color: card.color }} />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
                <div className="text-sm font-medium" style={{ color: '#d4d4d8' }}>{card.label}</div>
                {card.sub && (
                  <div className="text-xs mt-0.5" style={{ color: '#52525b' }}>{card.sub}</div>
                )}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">

          {/* ── Lesson drop-off chart ── */}
          <div className="xl:col-span-2 rounded-2xl p-6 glass"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-white">Lesson Completion Drop-off</h2>
                <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                  How many students completed each lesson
                </p>
              </div>
              <BarChart3 className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            </div>

            {lessonDropoff.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm" style={{ color: '#52525b' }}>No lesson data yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {lessonDropoff.map((lesson) => {
                  const isBiggestDrop = lesson.orderNum === biggestDropLesson
                  const barWidth = maxCompleted > 0
                    ? Math.max((lesson.completedCount / maxCompleted) * 100, 2)
                    : 2

                  return (
                    <div key={lesson.orderNum} className="flex items-center gap-3">
                      {/* Lesson number */}
                      <span className="text-xs font-mono flex-shrink-0 w-6 text-right"
                        style={{ color: '#52525b' }}>
                        {lesson.orderNum}
                      </span>

                      {/* Bar */}
                      <div className="flex-1 h-7 rounded-lg overflow-hidden relative"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div
                          className="h-full rounded-lg transition-all"
                          style={{
                            width: `${barWidth}%`,
                            background: isBiggestDrop
                              ? 'linear-gradient(90deg, rgba(239,68,68,0.7), rgba(239,68,68,0.4))'
                              : 'linear-gradient(90deg, rgba(139,92,246,0.7), rgba(139,92,246,0.3))',
                          }}
                        />
                        {/* Title overlay */}
                        <span className="absolute inset-0 flex items-center px-2.5 text-xs text-white/70 truncate">
                          {lesson.title}
                        </span>
                      </div>

                      {/* Count + pct */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 w-20 justify-end">
                        <span className="text-xs font-semibold text-white">
                          {lesson.completedCount}
                        </span>
                        <span className="text-xs" style={{ color: '#52525b' }}>
                          ({lesson.completionPct}%)
                        </span>
                        {isBiggestDrop && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0"
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                            ↓ Drop
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {biggestDropLesson > 0 && (
              <div className="mt-5 flex items-start gap-2.5 p-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <p className="text-xs" style={{ color: '#fca5a5' }}>
                  Biggest drop-off at <strong>Lesson {biggestDropLesson}</strong>. Consider revisiting this lesson — make it shorter, clearer, or add a note to keep students engaged.
                </p>
              </div>
            )}
          </div>

          {/* ── Revenue breakdown ── */}
          <div className="rounded-2xl p-6 glass"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-5">
              <IndianRupee className="w-4 h-4" style={{ color: '#4ade80' }} />
              <h2 className="font-semibold text-white">Revenue</h2>
            </div>

            <div className="flex flex-col gap-3">
              {[
                {
                  label: 'Total Revenue',
                  value: money(revenue.totalRevenue),
                  color: '#4ade80',
                  large: true,
                },
                {
                  label: 'Paid Enrollments',
                  value: String(revenue.paidCount),
                  color: '#8b5cf6',
                },
                {
                  label: 'Avg Amount Paid',
                  value: money(revenue.avgAmountPaid),
                  color: '#38bdf8',
                  sub: revenue.avgAmountPaid < data.coursePrice
                    ? `${money(data.coursePrice - revenue.avgAmountPaid)} avg discount`
                    : 'Full price',
                },
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-xs mb-1" style={{ color: '#71717a' }}>{item.label}</p>
                  <p className={`font-bold text-white ${item.large ? 'text-2xl' : 'text-lg'}`}
                    style={{ color: item.color }}>
                    {item.value}
                  </p>
                  {item.sub && (
                    <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>{item.sub}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Progress ring — completion rate */}
            <div className="mt-5 flex flex-col items-center p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="relative w-20 h-20 mb-2">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle cx="18" cy="18" r="15.9"
                    fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9"
                    fill="none" stroke="#4ade80" strokeWidth="3"
                    strokeDasharray={`${overview.completionRate} ${100 - overview.completionRate}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                  {overview.completionRate}%
                </span>
              </div>
              <p className="text-xs text-white font-medium">Completion Rate</p>
              <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                {overview.completedCount} of {overview.totalEnrolled} students
              </p>
            </div>
          </div>
        </div>

        {/* ── Inactive students ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h2 className="font-semibold text-white">Inactive Students</h2>
              <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                Not accessed course in the last 7 days · {inactiveStudents.length} students
              </p>
            </div>
            <Clock className="w-5 h-5" style={{ color: '#f59e0b' }} />
          </div>

          {inactiveStudents.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: '#4ade80' }} />
              <p className="text-sm font-medium text-white mb-1">All students are active</p>
              <p className="text-xs" style={{ color: '#52525b' }}>
                Everyone has accessed the course in the last 7 days.
              </p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#52525b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="col-span-3">Student</div>
                <div className="col-span-4">Stuck on</div>
                <div className="col-span-2">Last seen</div>
                <div className="col-span-3">Action</div>
              </div>

              {inactiveStudents.map((student, i) => (
                <div key={student.id}
                  className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center"
                  style={{ borderBottom: i < inactiveStudents.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                >
                  {/* Phone */}
                  <div className="col-span-3">
                    <p className="text-sm text-white font-mono">+{student.phone}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>
                      Enrolled {new Date(student.enrolledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>

                  {/* Current lesson */}
                  <div className="col-span-4">
                    <p className="text-sm text-white truncate">{student.currentLessonTitle}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#52525b' }}>Lesson {student.currentLesson}</p>
                  </div>

                  {/* Last seen */}
                  <div className="col-span-2">
                    {student.daysSinceAccess !== null ? (
                      <span className="text-xs px-2 py-1 rounded-full"
                        style={{
                          background: student.daysSinceAccess > 14 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                          color: student.daysSinceAccess > 14 ? '#ef4444' : '#f59e0b',
                        }}>
                        {student.daysSinceAccess}d ago
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#52525b' }}>Never</span>
                    )}
                  </div>

                  {/* Send reminder */}
                  <div className="col-span-3">
                    {student.hasTelegram ? (
                      reminderSent.has(student.id) ? (
                        <span className="flex items-center gap-1.5 text-xs"
                          style={{ color: '#4ade80' }}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Sent
                        </span>
                      ) : (
                        <button
                          onClick={() => sendReminder(student)}
                          disabled={sendingReminder === student.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                          style={{
                            background: 'rgba(139,92,246,0.1)',
                            color: '#8b5cf6',
                            border: '1px solid rgba(139,92,246,0.2)',
                          }}
                        >
                          <Send className="w-3 h-3" />
                          {sendingReminder === student.id ? 'Sending...' : 'Nudge'}
                        </button>
                      )
                    ) : (
                      <span className="text-xs" style={{ color: '#3f3f46' }}>No Telegram</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

      </main>
    </div>
  )
}
