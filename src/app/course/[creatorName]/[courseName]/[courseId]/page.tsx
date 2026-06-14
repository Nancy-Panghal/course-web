/**
 * src/app/course/[creatorName]/[courseName]/[courseId]/page.tsx
 * Key fixes:
 * 1. findPaidEnrollment uses all identifiers — no false "not enrolled"
 * 2. previous lesson button added
 * 3. markComplete sends lessonId for quiz tracking
 * 4. Quiz results loaded from enrollment and shown per-lesson
 * 5. Progress is cross-platform: shows telegram-completed lessons too
 * 6. linkStudentToEnrollment called on load to fix bot-created enrollments
 */

"use client"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

import {
  Shield, CheckCircle, ChevronRight, ChevronLeft,
  Award, Menu, Clock, Lock, FileText, Play, BookOpen,
  HelpCircle, Download, ExternalLink
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { findPaidEnrollment, linkStudentToEnrollment } from '@/lib/enrollments'
import { resolveAccountType } from '@/lib/account'
import EnrollModal from '@/components/EnrollModal'
import AssignmentSubmit from '@/components/AssignmentSubmit'
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
  summary_url?: string | null
  notes_url?: string | null
  quiz_questions?: { question: string; options: string[]; answerIndex: number }[] | null
  assignment_prompt?: string | null
  assignment_required?: boolean | null
}

interface Course {
  id: string
  name: string
  slug: string
  creator_id: string
  host_name: string
  price: number
  total_lessons?: number
  next_lesson_date?: string
  course_end_date?: string
  student_update_message?: string
  free_preview_config?: string
}

interface Enrollment {
  id: string
  current_lesson: number
  completed_lessons: number[]
  quiz_results: { lessonId: string; score: number; total: number }[]
  course_uuid: string
  phone?: string
  student_id?: string | null
  telegram_start_token?: string | null
  telegram_start_token_expires_at?: string | null
  certificate_student_name?: string | null
}

function isLessonFree(lesson: Lesson, config: string): boolean {
  if (config === 'lesson 1 free') return lesson.order_num === 1
  if (config === '2 lessons free') return lesson.order_num <= 2
  if (config === '3 lessons free') return lesson.order_num <= 3
  if (config === 'module 1 free') return lesson.order_num <= 3
  if (config === '2 modules free') return lesson.order_num <= 6
  return false
}

async function getSignedContentUrl(lessonId: string, type: 'video' | 'pdf'): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/content/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ lessonId, type }),
  })
  if (!res.ok) throw new Error('Failed to get signed URL')
  const { url } = await res.json()
  return url
}

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
          Enroll in <strong className="text-white">{course.name}</strong> to unlock all lessons.
        </p>
        <button onClick={onEnroll}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
          Enroll Now — ₹{course.price.toLocaleString()}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

function PdfViewer({ src }: { src: string }) {
  return (
    <div style={{ width: '100%', height: '75vh', background: '#111', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
      <iframe src={src} style={{ width: '100%', height: '100%', border: 'none' }} title="Lesson PDF" />
    </div>
  )
}

export default function CourseLearnPage() {
  const { courseId } = useParams<{ creatorName: string; courseName: string; courseId: string }>()
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [currentId, setCurrentId] = useState('')
  const [completed, setCompleted] = useState<number[]>([])
  const [quizResults, setQuizResults] = useState<Enrollment['quiz_results']>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showEnroll, setShowEnroll] = useState(false)
  const [creatorProfile, setCreatorProfile] = useState<any>(null)
  const [contentUrl, setContentUrl] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [savingProgress, setSavingProgress] = useState(false)
  const [demoTelegramToken, setDemoTelegramToken] = useState('')
  const [generatingDemoToken, setGeneratingDemoToken] = useState(false)
  const [enrolledTelegramToken, setEnrolledTelegramToken] = useState('')
  const [showCertModal, setShowCertModal] = useState(false)
  const [certGenerating, setCertGenerating] = useState(false)
  const [certId, setCertId] = useState<string | null>(null)
  const [studentFullName, setStudentFullName] = useState('')
  const [savingStudentName, setSavingStudentName] = useState(false)
  
  const [assignmentSubmission, setAssignmentSubmission] = useState<any>(null)
  const [assignmentLoadedForLesson, setAssignmentLoadedForLesson] = useState<string | null>(null)
  const [certPdfUrl, setCertPdfUrl] = useState<string | null>(null)
  const [sessionToken, setSessionToken] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user: me } } = await supabase.auth.getUser()
      setUser(me)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) setSessionToken(session.access_token)

      const { data: courseData } = await supabase
        .from('courses').select('*').eq('id', courseId).single()
      if (!courseData) {
        if (me) {
          const type = await resolveAccountType(me)
          router.push(type === 'creator' ? '/dashboard' : '/my-courses')
        } else {
          router.push('/my-courses')
        }
        return
      }
      setCourse(courseData)

      try {
        const creatorRes = await fetch(`/api/creator/${courseData.creator_id}`)
        if (creatorRes.ok) {
          const creatorData = await creatorRes.json()
          setCreatorProfile(creatorData)
        } else {
          setCreatorProfile(null)
        }
      } catch (err) {
        console.error('Failed to load creator profile:', err)
        setCreatorProfile(null)
      }

      const { data: lessonData } = await supabase
        .from('lessons').select('*')
        .eq('course_id', courseData.id)
        .eq('is_published', true)
        .order('order_num', { ascending: true })
      const fetchedLessons = lessonData || []
      setLessons(fetchedLessons)

      const initialSearchParams = new URLSearchParams(window.location.search)
      const lessonFromUrl = Number(initialSearchParams.get('lesson') || '')
      const fromUrl = fetchedLessons.find((l: Lesson) => l.order_num === lessonFromUrl)

      if (me) {
        const enrollData = await findPaidEnrollment({ courseId: courseData.id, user: me })

        if (enrollData) {
          setIsEnrolled(true)
          setEnrollment(enrollData)
          setCompleted(enrollData.completed_lessons || [])
          setQuizResults(enrollData.quiz_results || [])

          // Link student_id to this enrollment if missing (bot-created enrollment fix)
          if (!enrollData.student_id && me.id) {
            const { data: studentRow } = await supabase
              .from('students')
              .select('id')
              .eq('auth_id', me.id)
              .limit(1)
              .single()
            if (studentRow?.id) {
              await linkStudentToEnrollment(enrollData.id, studentRow.id)
            }
          }

          // Resume from URL param, or from saved current_lesson, or lesson 1
          const resume = fromUrl
            || fetchedLessons.find((l: Lesson) => l.order_num === (enrollData.current_lesson || 1))
            || fetchedLessons[0]
          if (resume) setCurrentId(resume.id)
        } else {
          // Not enrolled — start from URL param or lesson 1
          setCurrentId(fromUrl?.id || fetchedLessons[0]?.id || '')
        }
      } else {
        setCurrentId(fromUrl?.id || fetchedLessons[0]?.id || '')
      }

      setLoading(false)
      setMounted(true)
    }
    load()
  }, [courseId, router])

  // Load (or generate + persist) the enrolled student's Telegram deep-link token.
  // Runs once when enrollment + creatorProfile + course are all ready.
  useEffect(() => {
    async function getEnrolledToken() {
      if (!isEnrolled || !enrollment || !creatorProfile?.telegram_bot_username || !course || enrolledTelegramToken) return

      // Re-use the persisted token if it exists and hasn't expired
      const stored = enrollment.telegram_start_token
      const expiresAt = enrollment.telegram_start_token_expires_at
      if (stored && expiresAt && new Date(expiresAt) > new Date()) {
        setEnrolledTelegramToken(stored)
        return
      }

      // No valid stored token — generate a fresh one and persist it
      try {
        const res = await fetch('/api/telegram/create-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: user?.id,
            studentPhone: user?.user_metadata?.phone || '',
            studentEmail: user?.email || '',
            studentName: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
            creatorId: course.creator_id,
            courseId: course.id,
            paymentId: null,
          }),
        })
        const { token, expiresAt: newExpiry } = await res.json()
        if (token) {
          setEnrolledTelegramToken(token)
          // Persist so the next page load skips regeneration
          fetch('/api/telegram/save-enrollment-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enrollmentId: enrollment.id, token, expiresAt: newExpiry }),
          }).catch(e => console.error('[enrolledToken save]', e))
        }
      } catch (e) {
        console.error('[enrolledToken]', e)
      }
    }
    getEnrolledToken()
  }, [isEnrolled, enrollment, creatorProfile, course, user, enrolledTelegramToken])

  useEffect(() => {
    async function getDemoToken() {
      if (!user || isEnrolled || !creatorProfile?.telegram_bot_username || !course || demoTelegramToken || generatingDemoToken) return
      setGeneratingDemoToken(true)
      try {
        const res = await fetch('/api/telegram/create-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: user.id,
            studentPhone: user.phone || user.user_metadata?.phone || '',
            studentEmail: user.email || '',
            studentName: user.user_metadata?.full_name || user.user_metadata?.name || '',
            creatorId: course.creator_id,
            courseId: course.id,
            paymentId: null,
          }),
        })
        const data = await res.json()
        if (data?.token) {
          setDemoTelegramToken(data.token)
        }
      } catch (e) {
        console.error('[demoToken]', e)
      }
      setGeneratingDemoToken(false)
    }
    getDemoToken()
  }, [user, isEnrolled, creatorProfile, course, demoTelegramToken, generatingDemoToken])

  const currentLesson = lessons.find(l => l.id === currentId) || lessons[0]
  const currentIndex = lessons.findIndex(l => l.id === currentId)
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null
  const plannedTotal = Math.max(course?.total_lessons || 0, lessons.length)
  const progress = lessons.length > 0
    ? Math.round((completed.length / Math.max(plannedTotal, lessons.length)) * 100)
    : 0
  const remainingPlanned = Math.max(plannedTotal - lessons.length, 0)
  const isFree = currentLesson && isLessonFree(currentLesson, course?.free_preview_config || 'nothing free')
  const canAccess = isEnrolled || isFree
  const allDone = plannedTotal > 0 && remainingPlanned === 0 && completed.length >= plannedTotal
  const currentQuizResult = quizResults.find(r => r.lessonId === currentLesson?.id)
  

  // Load signed content URL
  useEffect(() => {
    if (!currentLesson || !canAccess) { setContentUrl(null); return }
    setLoadingContent(true)
    setContentUrl(null)
    const type = currentLesson.content_type === 'pdf' ? 'pdf' : 'video'
    getSignedContentUrl(currentLesson.id, type)
      .then(url => { setContentUrl(url); setLoadingContent(false) })
      .catch(() => setLoadingContent(false))
  }, [currentLesson?.id, canAccess])

  // Load assignment submission when lesson changes
  useEffect(() => {
    async function loadAssignment() {
      if (!enrollment?.id || !currentLesson?.id || !sessionToken) return
      if (assignmentLoadedForLesson === currentLesson.id) return
      setAssignmentLoadedForLesson(currentLesson.id)
      setAssignmentSubmission(null)
      try {
        const res = await fetch(
          `/api/assignments/my?lessonId=${currentLesson.id}&enrollmentId=${enrollment.id}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        )
        if (res.ok) {
          const json = await res.json()
          setAssignmentSubmission(json.assignment || null)
        }
      } catch { /* non-fatal */ }
    }
    loadAssignment()
  }, [currentLesson?.id, enrollment?.id, sessionToken])

  async function markComplete(orderNum: number) {
    if (completed.includes(orderNum)) return
    const next = [...completed, orderNum]
    setCompleted(next)

    if (enrollment && isEnrolled) {
      setSavingProgress(true)
      const res = await fetch('/api/lesson/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: enrollment.id,
          lessonId: currentLesson?.id,
          lessonNum: orderNum,
          currentLesson: orderNum + 1,
          courseId: course?.id,
          source: 'web',
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setEnrollment(e => e ? {
          ...e,
          completed_lessons: data.completed,
          current_lesson: data.currentLesson,
        } : e)
      }
      setSavingProgress(false)
    }
  }

  async function submitQuiz(score: number, total: number) {
    if (!currentLesson || !enrollment) return
    const res = await fetch('/api/lesson/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enrollmentId: enrollment.id,
        lessonId: currentLesson.id,
        lessonNum: currentLesson.order_num,
        courseId: course?.id,
        source: 'web',
        quizScore: score,
        quizTotal: total,
      }),
    })
    const data = await res.json()
    if (data.ok && data.quizResults) {
      setQuizResults(data.quizResults)
    }
  }

  async function goTo(lesson: Lesson) {
    setCurrentId(lesson.id)
    setSidebarOpen(false)

    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set('lesson', String(lesson.order_num))
    router.replace(`${window.location.pathname}?${nextParams.toString()}`, { scroll: false })

    if (enrollment && isEnrolled) {
      // Update current_lesson to max(current, target) — don't go backwards
      const newCurrent = Math.max(enrollment.current_lesson ?? 1, lesson.order_num)
      setEnrollment({ ...enrollment, current_lesson: newCurrent })
      await supabase
        .from('enrollments')
        .update({
          current_lesson: newCurrent,
          last_accessed: new Date().toISOString(),
          last_web_sync: new Date().toISOString(),
        })
        .eq('id', enrollment.id)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function openCertificate() {
    setShowCertModal(true)
    
    let currentName = studentFullName
    // Load saved student name from enrollment if available
    if (enrollment?.certificate_student_name && !studentFullName) {
      setStudentFullName(enrollment.certificate_student_name)
      currentName = enrollment.certificate_student_name
    }

    if (certId) return // already fetched this session
    if (!enrollment?.id || !course?.id) return
    if (!currentName.trim()) return // wait for student to enter name
    setCertGenerating(true)
    try {
      const res = await fetch('/api/certificate/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enrollmentId: enrollment.id, 
          courseId: course.id,
          studentName: studentFullName.trim(),
        }),
      })
      const data = await res.json()
      if ((data.issued || data.alreadyIssued) && data.pdfUrl) {
        setCertId(data.certificateId)
        setCertPdfUrl(data.pdfUrl)
      }
    } catch (err) {
      console.error('[certificate]', err)
    }
    setCertGenerating(false)
  }

  async function saveStudentNameToEnrollment() {
    if (!enrollment?.id || !studentFullName.trim()) return
    setSavingStudentName(true)
    try {
      await supabase
        .from('enrollments')
        .update({ certificate_student_name: studentFullName.trim() })
        .eq('id', enrollment.id)
    } catch (err) {
      console.error('[saveStudentName]', err)
    }
    setSavingStudentName(false)
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg animate-pulse" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }} />
      </div>
    )
  }
  if (!course) return null

  const freeLessons = lessons.filter(l => isLessonFree(l, course.free_preview_config || 'nothing free')).length
  const isNextLocked = nextLesson && !isEnrolled && !isLessonFree(nextLesson, course.free_preview_config || 'nothing free')
  const quizQuestions = Array.isArray(currentLesson?.quiz_questions) && currentLesson!.quiz_questions!.length > 0
    ? currentLesson!.quiz_questions!
    : null

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
            telegramBotUsername: creatorProfile?.telegram_bot_username,
            free_preview_config: course.free_preview_config,
          }}
        />
      )}

      {/* NAV */}
      <nav style={{
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', background: 'rgba(8,8,8,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSidebarOpen(v => !v)} className="md:hidden"
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
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
            <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b' }}>
              {completed.length}/{plannedTotal || lessons.length}
            </span>
          </div>
          {allDone && (
            <button
              onClick={openCertificate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'rgba(234,179,8,0.08)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Award className="w-3.5 h-3.5" /> Certificate
            </button>
          )}
          {isEnrolled && (
            <a href="/my-courses"
              style={{
                fontSize: 11, color: '#52525b',
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}
              className="hidden sm:block hover:text-white transition-colors">
              ← My Courses
            </a>
          )}
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <aside style={{
          position: 'fixed', left: 0, top: 52, bottom: 0, zIndex: 40,
          width: 272, background: '#0a0a0a',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s',
          overflowY: 'auto',
        }} className="md:relative md:translate-x-0 md:flex-shrink-0">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {course.host_name || 'Instructor'}
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }} className="truncate">{course.name}</p>
          </div>

          <div style={{ paddingBottom: 40 }}>
            {lessons.map(lesson => {
              const isActive = lesson.id === currentId
              const isDone = completed.includes(lesson.order_num)
              const isLocked = !isEnrolled && !isLessonFree(lesson, course.free_preview_config || 'nothing free')
              const lessonQuizResult = quizResults.find(r => r.lessonId === lesson.id)
              const hasQuiz = Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0

              return (
                <button key={lesson.id} onClick={() => goTo(lesson)} style={{
                  width: '100%', padding: '10px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: isActive ? 'rgba(124,58,237,0.1)' : 'transparent',
                  borderRight: isActive ? '2px solid #7c3aed' : '2px solid transparent',
                  borderLeft: 'none', borderTop: 'none', borderBottom: 'none',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                }}>
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
                      {lesson.duration && <span style={{ fontSize: 10, color: '#3f3f46' }}>{lesson.duration}</span>}
                      {hasQuiz && (
                        <span style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 4,
                          background: lessonQuizResult ? 'rgba(74,222,128,0.08)' : 'rgba(124,58,237,0.08)',
                          color: lessonQuizResult ? '#4ade80' : '#a78bfa',
                          fontWeight: 700, textTransform: 'uppercase',
                        }}>
                          {lessonQuizResult ? `Quiz ${lessonQuizResult.score}/${lessonQuizResult.total}` : 'Quiz'}
                        </span>
                      )}
                      {!isEnrolled && isLessonFree(lesson, course.free_preview_config || 'nothing free') && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontWeight: 700 }}>Free</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {!canAccess ? (
            <LockedScreen course={course} onEnroll={() => setShowEnroll(true)} />
          ) : (
            <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 60px' }}>

              {!isEnrolled && (
                <div style={{ marginBottom: 18, padding: 16, borderRadius: 12, background: 'rgba(124,58,237,0.09)', border: '1px solid rgba(124,58,237,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                      Free preview — {freeLessons} lesson{freeLessons !== 1 ? 's' : ''} available
                    </p>
                    <p style={{ color: '#a1a1aa', fontSize: 12 }}>
                      Enroll to unlock all {plannedTotal || lessons.length} lessons + Telegram delivery.
                    </p>
                  </div>
                  <button onClick={() => setShowEnroll(true)}
                    style={{ padding: '10px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                    Enroll — ₹{course.price.toLocaleString()}
                  </button>
                </div>
              )}

              {/* Content */}
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
                      studentName={user?.email || 'Preview Student'}
                      studentId={enrollment?.phone || user?.phone || user?.user_metadata?.phone || ''}
                      lessonTitle={currentLesson?.title}
                      onEnded={() => currentLesson && markComplete(currentLesson.order_num)}
                    />
                  )}
                </div>
              ) : (
                <div style={{ aspectRatio: '16/9', background: '#111', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ color: '#52525b', fontSize: 14 }}>Content unavailable</p>
                </div>
              )}

              {/* Title + complete */}
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
                      Lesson {currentLesson?.order_num} of {plannedTotal || lessons.length}
                    </span>
                  </div>
                </div>

                {currentLesson && (
                  completed.includes(currentLesson.order_num) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', fontSize: 13, fontWeight: 700 }}>
                      <CheckCircle className="w-4 h-4" /> Completed
                    </div>
                  ) : (
                    <button onClick={() => markComplete(currentLesson.order_num)} disabled={savingProgress}
                      style={{ padding: '8px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: savingProgress ? 0.6 : 1 }}>
                      {savingProgress ? 'Saving…' : 'Mark as Complete'}
                    </button>
                  )
                )}
              </div>

              {/* Resources row */}
              {currentLesson && (currentLesson.summary_url || currentLesson.notes_url || quizQuestions) && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                  {currentLesson.summary_url && (
                    <Link href={`/resource/${currentLesson.id}?type=summary`} target="_blank"
                      style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.12)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.22)', fontSize: 12, fontWeight: 700 }}>
                      📄 Summary
                    </Link>
                  )}
                  {currentLesson.notes_url && (
                    <Link href={`/resource/${currentLesson.id}?type=notes`} target="_blank"
                      style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.12)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.22)', fontSize: 12, fontWeight: 700 }}>
                      📝 Notes
                    </Link>
                  )}
                  {quizQuestions && (
                    <Link href={`/resource/${currentLesson.id}?type=quiz`} target="_blank"
                      style={{
                        padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                        background: currentQuizResult ? 'rgba(74,222,128,0.1)' : 'rgba(124,58,237,0.12)',
                        color: currentQuizResult ? '#4ade80' : '#c4b5fd',
                        border: currentQuizResult ? '1px solid rgba(74,222,128,0.22)' : '1px solid rgba(124,58,237,0.22)',
                      }}>
                      🧠 {currentQuizResult ? `Quiz: ${currentQuizResult.score}/${currentQuizResult.total}` : 'Take Quiz'}
                    </Link>
                  )}
                </div>
              )}

              {/* Prev / Next */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 18 }}>
                <button
                  onClick={() => prevLesson && goTo(prevLesson)}
                  disabled={!prevLesson}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#a1a1aa', background: 'none', border: 'none', cursor: prevLesson ? 'pointer' : 'default', opacity: prevLesson ? 1 : 0.3 }}>
                  <ChevronLeft className="w-4 h-4" />
                  {prevLesson ? prevLesson.title : 'Previous'}
                </button>

                {nextLesson ? (
                  isNextLocked ? (
                    <button onClick={() => setShowEnroll(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Enroll to unlock — ₹{course.price.toLocaleString()} <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => goTo(nextLesson)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {nextLesson.title} <ChevronRight className="w-4 h-4" />
                    </button>
                  )
                ) : remainingPlanned > 0 ? (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#eab308', fontSize: 13, fontWeight: 800 }}>Next lessons upcoming</p>
                    <p style={{ color: '#71717a', fontSize: 11 }}>
                      {course.next_lesson_date
                        ? `Next: ${new Date(course.next_lesson_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : `${remainingPlanned} more lesson${remainingPlanned > 1 ? 's' : ''} planned`}
                    </p>
                  </div>
                  
                ) : (
                  <button
                    onClick={openCertificate}
                    style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(234,179,8,0.08)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    <Award className="w-4 h-4 inline mr-1" />Get Certificate
                  </button>
                )}
              </div>

              {/* Assignment section */}
              {currentLesson?.assignment_prompt && isEnrolled && (
                <div style={{
                  marginBottom: 18, padding: 16, borderRadius: 12,
                  background: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>
                    📝 Assignment{currentLesson.assignment_required ? ' (Required)' : ' (Optional)'}
                  </p>
                  <p style={{ fontSize: 13, color: '#e4e4e7', marginBottom: 12, lineHeight: 1.6 }}>
                    {currentLesson.assignment_prompt}
                  </p>

                  {assignmentSubmission ? (
                    <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>
                        ✅ Submitted {new Date(assignmentSubmission.submitted_at).toLocaleDateString('en-IN')}
                      </p>
                      {assignmentSubmission.submission_text && (
                        <p style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 8 }}>
                          {assignmentSubmission.submission_text.slice(0, 200)}
                          {assignmentSubmission.submission_text.length > 200 ? '…' : ''}
                        </p>
                      )}
                      {assignmentSubmission.submission_url && (
                        <a
                          href={assignmentSubmission.submission_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: '#a78bfa', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Download className="w-3.5 h-3.5" /> View attached file
                        </a>
                      )}
                      {assignmentSubmission.status === 'reviewed' && (
                        <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>
                            Instructor Feedback:
                          </p>
                          <p style={{ fontSize: 12, color: '#e4e4e7' }}>{assignmentSubmission.creator_feedback}</p>
                          {assignmentSubmission.score !== null && assignmentSubmission.score !== undefined && (
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginTop: 6 }}>
                              Score: {assignmentSubmission.score}/10
                            </p>
                          )}
                        </div>
                      )}
                      {assignmentSubmission.status === 'pending' && (
                        <p style={{ fontSize: 11, color: '#71717a' }}>Awaiting instructor review…</p>
                      )}
                    </div>
                  ) : currentLesson && enrollment?.id && course?.id && sessionToken ? (
                    <AssignmentSubmit
                      key={currentLesson.id}
                      sessionToken={sessionToken}
                      lessonId={currentLesson.id}
                      courseId={course.id}
                      enrollmentId={enrollment.id}
                      onSubmitted={setAssignmentSubmission}
                    />
                  ) : null}
                </div>
              )}

              {/* Telegram CTA for all users (enrolled or previewing) */}
              {creatorProfile?.telegram_bot_username && (
                isEnrolled ? (
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(34,158,217,0.06)', border: '1px solid rgba(34,158,217,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                    <div>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Continue on Telegram</p>
                      <p style={{ color: '#71717a', fontSize: 12 }}>Lessons delivered to your chat. Progress syncs automatically.</p>
                    </div>
                    {enrolledTelegramToken ? (
                      <a
                        href={`https://t.me/${creatorProfile.telegram_bot_username.replace('@', '')}?start=${enrolledTelegramToken}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ padding: '8px 16px', borderRadius: 10, background: '#229ED9', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        Open Telegram
                      </a>
                    ) : (
                      <button disabled
                        style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(34,158,217,0.5)', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'not-allowed', whiteSpace: 'nowrap' }}>
                        Preparing Link...
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(34,158,217,0.06)', border: '1px solid rgba(34,158,217,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                    <div>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Learn on Telegram</p>
                      <p style={{ color: '#71717a', fontSize: 12 }}>Get these free preview lessons delivered straight to your chat.</p>
                    </div>
                    {user ? (
                      demoTelegramToken ? (
                        <a href={`https://t.me/${creatorProfile.telegram_bot_username.replace('@', '')}?start=${demoTelegramToken}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ padding: '8px 16px', borderRadius: 10, background: '#229ED9', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          Start Free on Telegram
                        </a>
                      ) : (
                        <button disabled
                          style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(34,158,217,0.5)', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'not-allowed', whiteSpace: 'nowrap' }}>
                          Preparing Link...
                        </button>
                      )
                    ) : (
                      <button onClick={() => setShowEnroll(true)}
                        style={{ padding: '8px 16px', borderRadius: 10, background: '#229ED9', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Start Free on Telegram
                      </button>
                    )}
                  </div>
                )
              )}

            </div>
          )}
        </main>
      </div>

      {/* ── CERTIFICATE MODAL ── */}
      {showCertModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowCertModal(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
          <div style={{
            width: '100%', maxWidth: 420, borderRadius: 20, padding: 32,
            background: '#0a0a0a', border: '1px solid rgba(234,179,8,0.25)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18, margin: '0 auto 20px',
              background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Award style={{ width: 36, height: 36, color: '#eab308' }} />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              Course Completed! 🎉
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 24 }}>
              You've completed <strong style={{ color: '#fff' }}>{course?.name}</strong>
            </p>

            {/* Name input field */}
            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', marginBottom: 8 }}>
                Enter your full name for the certificate:
              </label>
              <input
                type="text"
                value={studentFullName}
                onChange={(e) => setStudentFullName(e.target.value)}
                placeholder="John Doe"
                autoComplete="name"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, color: '#fff',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(234,179,8,0.5)'}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                  if (studentFullName.trim()) {
                    saveStudentNameToEnrollment()
                  }
                }}
              />
              <p style={{ fontSize: 11, color: '#52525b', marginTop: 6 }}>
                This name will appear on your certificate. Make sure it's spelled correctly.
                {savingStudentName && ' Saving...'}
              </p>
            </div>

            {/* Certificate preview card */}
            <div style={{
              borderRadius: 12, padding: 18, marginBottom: 24, textAlign: 'left',
              background: 'rgba(234,179,8,0.04)', border: '1px solid rgba(234,179,8,0.12)',
            }}>
              <p style={{ fontSize: 10, color: '#52525b', marginBottom: 4 }}>This certifies that</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                {studentFullName.trim() || user?.user_metadata?.full_name || user?.email || 'Your Name'}
              </p>
              <p style={{ fontSize: 11, color: '#52525b', marginBottom: 4 }}>has successfully completed</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#eab308', marginBottom: 8 }}>{course?.name}</p>
              <p style={{ fontSize: 11, color: '#52525b' }}>
                Issued by {course?.host_name || 'Creator'} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {studentFullName.trim() && !certPdfUrl && !certGenerating && (
                <button
                  onClick={() => openCertificate()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                    color: '#eab308', background: 'rgba(234,179,8,0.1)',
                    border: '1px solid rgba(234,179,8,0.25)', cursor: 'pointer',
                  }}>
                  <Download style={{ width: 16, height: 16 }} /> Generate Certificate
                </button>
              )}

              {certGenerating && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', color: '#a1a1aa', fontSize: 13 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#7c3aed', animation: 'pulse 1s infinite' }} />
                  Generating certificate…
                </div>
              )}

              {certPdfUrl && (
                <a
                  href={certPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14,
                    color: '#eab308', background: 'rgba(234,179,8,0.1)',
                    border: '1px solid rgba(234,179,8,0.25)', textDecoration: 'none',
                  }}>
                  <Download style={{ width: 16, height: 16 }} /> Download Certificate PDF
                </a>
              )}

              {certId && (
                <Link
                  href={`/certificate/${certId}`}
                  target="_blank"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px 0', fontSize: 12, fontWeight: 600,
                    color: '#a78bfa', textDecoration: 'none',
                  }}>
                  <ExternalLink style={{ width: 13, height: 13 }} /> View verification page
                </Link>
              )}

              <button
                onClick={() => setShowCertModal(false)}
                style={{
                  padding: '11px 0', borderRadius: 12, fontWeight: 700, fontSize: 13,
                  color: '#a1a1aa', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                }}>
                Back to Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
