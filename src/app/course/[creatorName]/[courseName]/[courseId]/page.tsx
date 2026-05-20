'use client'
/**
 * app/course/[creatorName]/[courseName]/[courseId]/page.tsx
 * ─────────────────────────────────────────────────────────────────
 * Website lesson viewer — fully anti-piracy integrated.
 * - Video: served via /api/video/stream (signed, proxied, watermarked canvas)
 * - PDF:   served via /api/pdf/view (signed, proxied, watermark burned in)
 * - Signed URLs generated server-side in getSignedContentUrl()
 * - WatermarkedPlayer component for video
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Shield, CheckCircle, ChevronRight, ChevronLeft,
  Award, Menu, Clock, Lock, FileText, Play, BookOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { findPaidEnrollment } from '@/lib/enrollments'
import EnrollModal from '@/components/EnrollModal'
import WatermarkedPlayer from '@/components/WatermarkedPlayer'

interface Lesson {
  id: string
  title: string
  content_url: string
  content_type: string
  order_num: number
  duration: string
  is_published: boolean
  module_id?: string | null
}

interface Course {
  id: string
  name: string
  slug: string
  creator_id: string
  delivery: string
  host_name: string
  price: number
  free_preview_config?: string
}

interface Enrollment {
  id: string
  current_lesson: number
  completed_lessons: number[]
  course_uuid: string
}

function isLessonFree(lesson: Lesson, config: string) {
  if (config === 'lesson 1 free')  return lesson.order_num === 1
  if (config === '2 lessons free') return lesson.order_num <= 2
  if (config === '3 lessons free') return lesson.order_num <= 3
  if (config === 'module 1 free')  return lesson.order_num <= 3
  if (config === '2 modules free') return lesson.order_num <= 6
  return false
}

// ── Get signed content URL from our server API ────────────────────
async function getSignedContentUrl(lessonId: string, type: 'video' | 'pdf'): Promise<string> {
  const res = await fetch('/api/content/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId, type }),
  })
  if (!res.ok) throw new Error('Failed to get signed URL')
  const { url } = await res.json()
  return url
}

// ── Locked Screen ─────────────────────────────────────────────────
function LockedScreen({ course, onEnroll }: { course: Course; onEnroll: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#0a0a0a' }}>
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <Lock className="w-10 h-10" style={{ color: '#8b5cf6' }} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">This lesson is locked</h2>
        <p className="mb-6" style={{ color: '#a1a1aa' }}>
          You've watched the free preview. Enroll in{' '}
          <strong className="text-white">{course.name}</strong> to unlock all lessons.
        </p>
        <button
          onClick={onEnroll}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}
        >
          Enroll Now — ₹{course.price.toLocaleString()}
          <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-xs mt-4" style={{ color: '#52525b' }}>
          One-time payment · Lifetime access · 256-bit Secure
        </p>
      </div>
    </div>
  )
}

// ── PDF Viewer ─────────────────────────────────────────────────────
function PdfViewer({ src }: { src: string }) {
  return (
    <div style={{ width: '100%', height: '75vh', background: '#111', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Lesson PDF"
      />
    </div>
  )
}

export default function CourseLearnPage({
  params,
}: {
  params: Promise<{ creatorName: string; courseName: string; courseId: string }>
}) {
  const { courseId } = use(params)
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [mounted,        setMounted]        = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [course,         setCourse]         = useState<Course | null>(null)
  const [lessons,        setLessons]        = useState<Lesson[]>([])
  const [enrollment,     setEnrollment]     = useState<Enrollment | null>(null)
  const [currentId,      setCurrentId]      = useState('')
  const [completed,      setCompleted]      = useState<number[]>([])
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [isEnrolled,     setIsEnrolled]     = useState(false)
  const [user,           setUser]           = useState<any>(null)
  const [showEnroll,     setShowEnroll]     = useState(false)
  const [creatorProfile, setCreatorProfile] = useState<any>(null)
  const [contentUrl,     setContentUrl]     = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [savingProgress, setSavingProgress] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user: me } } = await supabase.auth.getUser()
      setUser(me)

      const { data: courseData } = await supabase
        .from('courses').select('*').eq('id', courseId).single()
      if (!courseData) { router.push('/'); return }
      setCourse(courseData)

      const { data: creator } = await supabase
        .from('creators')
        .select('id, name, whatsapp_number, telegram_bot_username')
        .eq('id', courseData.creator_id).limit(1)
      setCreatorProfile(creator?.[0] || null)

      const { data: lessonData } = await supabase
        .from('lessons').select('*')
        .eq('course_id', courseData.id)
        .eq('is_published', true)
        .order('order_num', { ascending: true })
      const fetchedLessons = lessonData || []
      setLessons(fetchedLessons)

      const lessonFromUrl = Number(searchParams.get('lesson') || '')
      const fromUrl = fetchedLessons.find((l: Lesson) => l.order_num === lessonFromUrl)

      if (me) {
        const enrollData = await findPaidEnrollment({ courseId: courseData.id, user: me })
        if (enrollData) {
          setIsEnrolled(true)
          setEnrollment(enrollData)
          setCompleted(enrollData.completed_lessons || [])
          const resume = fromUrl
            || fetchedLessons.find((l: Lesson) => l.order_num === (enrollData.current_lesson || 1))
            || fetchedLessons[0]
          if (resume) setCurrentId(resume.id)
        } else {
          setCurrentId(fromUrl?.id || fetchedLessons[0]?.id || '')
        }
      } else {
        setCurrentId(fromUrl?.id || fetchedLessons[0]?.id || '')
      }

      setLoading(false)
      setMounted(true)
    }
    load()
  }, [courseId, router, searchParams])

  const currentLesson = lessons.find(l => l.id === currentId) || lessons[0]
  const currentIndex  = lessons.findIndex(l => l.id === currentId)
  const prevLesson    = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson    = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null
  const progress      = lessons.length > 0 ? Math.round((completed.length / lessons.length) * 100) : 0
  const allDone       = lessons.length > 0 && completed.length === lessons.length
  const isFree        = currentLesson && isLessonFree(currentLesson, course?.free_preview_config || 'nothing free')
  const canAccess     = isEnrolled || isFree

  // Load signed content URL when lesson changes
  useEffect(() => {
    if (!currentLesson || !canAccess) { setContentUrl(null); return }

    setLoadingContent(true)
    setContentUrl(null)

    const type = currentLesson.content_type === 'pdf' ? 'pdf' : 'video'
    getSignedContentUrl(currentLesson.id, type)
      .then(url => { setContentUrl(url); setLoadingContent(false) })
      .catch(() => { setLoadingContent(false) })
  }, [currentLesson?.id, canAccess])

  async function markComplete(orderNum: number) {
    if (completed.includes(orderNum)) return
    const next = [...completed, orderNum]
    setCompleted(next)
    if (enrollment && isEnrolled) {
      setSavingProgress(true)
      await supabase.from('enrollments').update({
        completed_lessons: next,
        current_lesson: orderNum + 1,
        last_accessed: new Date().toISOString(),
      }).eq('id', enrollment.id)
      setSavingProgress(false)
    }
  }

  function goTo(lesson: Lesson) {
    setCurrentId(lesson.id)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg animate-pulse" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }} />
      </div>
    )
  }
  if (!course) return null

  const isNextLocked = nextLesson && !isEnrolled && !isLessonFree(nextLesson, course.free_preview_config || 'nothing free')

  return (
    <div className="min-h-screen flex flex-col text-white" style={{ background: '#080808' }}>

      {showEnroll && (
        <EnrollModal
          onClose={() => setShowEnroll(false)}
          course={{
            id: course.id, name: course.name, price: course.price,
            creatorSlug: course.slug,
            creatorName: course.host_name || creatorProfile?.name || '',
            creatorId: course.creator_id,
            waNumber: creatorProfile?.whatsapp_number,
            telegramBotUsername: creatorProfile?.telegram_bot_username,
            free_preview_config: course.free_preview_config,
          }}
        />
      )}

      {/* ── NAV ── */}
      <nav style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'rgba(8,8,8,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSidebarOpen(v => !v)} className="md:hidden" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }} className="hidden sm:block">AcademyKit</span>
          </Link>
          <span style={{ fontSize: 12, color: '#3f3f46' }} className="hidden md:block">/ {course.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="hidden sm:flex">
            <div style={{ width: 80, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#4f46e5)', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b' }}>{progress}%</span>
          </div>
          {allDone && (
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'rgba(234,179,8,0.08)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Award className="w-3.5 h-3.5" /> Certificate
            </button>
          )}
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── SIDEBAR ── */}
        <aside
          style={{
            position: 'fixed', left: 0, top: 52, bottom: 0, zIndex: 40,
            width: 272, background: '#0a0a0a',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s',
          }}
          className="md:relative md:translate-x-0 md:flex-shrink-0"
        >
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {course.host_name || 'Instructor'}
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }} className="truncate">{course.name}</p>
          </div>

          <div style={{ overflowY: 'auto', height: 'calc(100% - 58px)', paddingBottom: 40 }}>
            {lessons.map(lesson => {
              const isActive  = lesson.id === currentId
              const isDone    = completed.includes(lesson.order_num)
              const isLocked  = !isEnrolled && !isLessonFree(lesson, course.free_preview_config || 'nothing free')
              return (
                <button
                  key={lesson.id}
                  onClick={() => goTo(lesson)}
                  style={{
                    width: '100%', padding: '10px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: isActive ? 'rgba(124,58,237,0.1)' : 'transparent',
                    borderRight: isActive ? '2px solid #7c3aed' : '2px solid transparent',
                    borderLeft: 'none', borderTop: 'none', borderBottom: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                    {isLocked
                      ? <Lock className="w-3.5 h-3.5" style={{ color: '#3f3f46' }} />
                      : isDone
                      ? <CheckCircle className="w-3.5 h-3.5" style={{ color: '#4ade80' }} />
                      : isActive
                      ? <Play className="w-3.5 h-3.5 fill-current" style={{ color: '#a78bfa' }} />
                      : <span style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46' }}>{lesson.order_num}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: isLocked ? '#3f3f46' : isActive ? '#fff' : '#a1a1aa' }} className="truncate">
                      {lesson.title}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      {lesson.content_type === 'pdf'
                        ? <FileText className="w-3 h-3" style={{ color: '#52525b' }} />
                        : <Play className="w-3 h-3" style={{ color: '#52525b' }} />
                      }
                      {lesson.duration && <span style={{ fontSize: 10, color: '#3f3f46' }}>{lesson.duration}</span>}
                      {!isEnrolled && isLessonFree(lesson, course.free_preview_config || 'nothing free') && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>Free</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {!canAccess ? (
            <LockedScreen course={course} onEnroll={() => setShowEnroll(true)} />
          ) : (
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 60px' }}>

              {/* Content area */}
              {loadingContent ? (
                <div style={{ aspectRatio: '16/9', background: '#111', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', animation: 'pulse 1s infinite' }} />
                </div>
              ) : contentUrl ? (
                <div style={{ marginBottom: 24 }}>
                  {currentLesson?.content_type === 'pdf' ? (
                    <PdfViewer src={contentUrl} />
                  ) : (
                    <WatermarkedPlayer
                      src={contentUrl}
                      studentName={user?.email || user?.phone || 'Student'}
                      studentId={user?.id?.slice(-8) || ''}
                      lessonTitle={currentLesson?.title}
                      onEnded={() => currentLesson && markComplete(currentLesson.order_num)}
                    />
                  )}
                </div>
              ) : (
                <div style={{ aspectRatio: '16/9', background: '#111', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ color: '#52525b', fontSize: 14 }}>Content not available</p>
                </div>
              )}

              {/* Lesson title + complete */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ fontSize: 'clamp(1.1rem,3vw,1.5rem)', fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                    {currentLesson?.title}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {currentLesson?.duration && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#52525b' }}>
                        <Clock className="w-3.5 h-3.5" /> {currentLesson.duration}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#52525b' }}>
                      Lesson {currentLesson?.order_num} of {lessons.length}
                    </span>
                  </div>
                </div>

                {currentLesson && (
                  completed.includes(currentLesson.order_num) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', fontSize: 13, fontWeight: 700 }}>
                      <CheckCircle className="w-4 h-4" /> Completed
                    </div>
                  ) : (
                    <button
                      onClick={() => markComplete(currentLesson.order_num)}
                      disabled={savingProgress}
                      style={{ padding: '8px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: savingProgress ? 0.6 : 1 }}
                    >
                      {savingProgress ? 'Saving...' : 'Mark as Complete'}
                    </button>
                  )
                )}
              </div>

              {/* Prev / Next navigation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  onClick={() => prevLesson && goTo(prevLesson)}
                  disabled={!prevLesson}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#a1a1aa', background: 'none', border: 'none', cursor: prevLesson ? 'pointer' : 'default', opacity: prevLesson ? 1 : 0.3 }}
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                {nextLesson ? (
                  isNextLocked ? (
                    <button
                      onClick={() => setShowEnroll(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Enroll to Unlock — ₹{course.price.toLocaleString()} <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => goTo(nextLesson)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  )
                ) : (
                  <button style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(234,179,8,0.08)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    🏆 Get Certificate
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}