'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Shield, CheckCircle, Play, ChevronRight,
  ChevronLeft, Award, Menu, X, Clock, Lock, Download
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { findPaidEnrollment } from '@/lib/enrollments'
import WatermarkedPlayer from '@/components/WatermarkedPlayer'

interface Lesson {
  id: string
  title: string
  content_url: string
  content_type: string
  order_num: number
  duration: string
  is_published: boolean
}

interface Course {
  id: string
  name: string
  slug: string
  creator_id: string
  delivery: string
  host_name: string
}

interface Enrollment {
  id: string
  current_lesson: number
  completed_lessons: number[]
  course_uuid: string
}

function groupBySections(lessons: Lesson[]) {
  const sections: Record<string, Lesson[]> = {}
  lessons.forEach((l, i) => {
    const section = `Module ${Math.floor(i / 3) + 1}`
    if (!sections[section]) sections[section] = []
    sections[section].push(l)
  })
  return sections
}

// ── LOCKED LESSON SCREEN ──
function LockedScreen({ courseName, courseSlug }: { courseName: string; courseSlug: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8"
      style={{background:'#0a0a0a'}}>
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)'}}>
          <Lock className="w-10 h-10" style={{color:'#8b5cf6'}} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">This lesson is locked</h2>
        <p className="mb-6" style={{color:'#a1a1aa'}}>
          You've watched the free preview. Enroll in <strong className="text-white">{courseName}</strong> to
          unlock all lessons, get WhatsApp delivery, and earn your certificate.
        </p>
        <Link href={`/c/${courseSlug}`}
          className="inline-flex items-center gap-2 violet-gradient px-8 py-4 rounded-xl font-semibold text-white hover:opacity-90 glow-strong transition-all">
          Enroll Now
          <ChevronRight className="w-5 h-5" />
        </Link>
        <div className="mt-4">
          <Link href={`/login?redirect=/learn/${courseSlug}`} className="text-xs text-zinc-500 hover:text-white transition-colors">
            Already enrolled? Sign In
          </Link>
        </div>
        <p className="text-xs mt-4" style={{color:'#52525b'}}>
          One-time payment · Lifetime access · 7-day refund
        </p>
      </div>
    </div>
  )
}

export default function LearnPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [currentLessonId, setCurrentLessonId] = useState<string>('')
  const [completed, setCompleted] = useState<number[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCertificate, setShowCertificate] = useState(false)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [savingProgress, setSavingProgress] = useState(false)
  const [videoStreamUrl, setVideoStreamUrl] = useState<string>('')
  const [certGenerating, setCertGenerating] = useState(false)
  const [certificateId, setCertificateId] = useState<string | null>(null)
  const [certificatePdfUrl, setCertificatePdfUrl] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      // Fetch course by slug
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('slug', slug)
        .single()

      if (!courseData) {
        router.push('/')
        return
      }
      setCourse(courseData)

      // Fetch published lessons
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseData.id)
        .eq('is_published', true)
        .order('order_num', { ascending: true })

      const fetchedLessons = lessonData || []
      setLessons(fetchedLessons)

      if (fetchedLessons.length > 0) {
        setCurrentLessonId(fetchedLessons[0].id)
      }

      // Check enrollment if user is logged in
      if (currentUser) {
        const enrollmentData = await findPaidEnrollment({
          courseId: courseData.id,
          user: currentUser,
        })

        if (enrollmentData) {
          setIsEnrolled(true)
          setEnrollment(enrollmentData)

          // Restore progress
          const savedCompleted = enrollmentData.completed_lessons || []
          setCompleted(savedCompleted)

          // Resume from last lesson
          const currentOrder = enrollmentData.current_lesson || 1
          const resumeLesson = fetchedLessons.find(
            (l: Lesson) => l.order_num === currentOrder
          ) || fetchedLessons[0]

          if (resumeLesson) setCurrentLessonId(resumeLesson.id)
        }
      } else {
        // Not logged in — load progress from localStorage as fallback
        try {
          const saved = localStorage.getItem(`academykit_progress_${slug}`)
          if (saved) {
            const parsed = JSON.parse(saved)
            if (parsed.completed) setCompleted(parsed.completed)
          }
        } catch (e) {}
      }

      setLoading(false)
      setMounted(true)
    }
    load()
  }, [slug, router])

  const currentLesson = lessons.find(l => l.id === currentLessonId) || lessons[0]
  const currentIndex = lessons.findIndex(l => l.id === currentLessonId)
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null
  const progress = lessons.length > 0 ? Math.round((completed.length / lessons.length) * 100) : 0
  const allDone = lessons.length > 0 && completed.length === lessons.length
  console.log('[computed] allDone:', allDone, 'completed:', completed.length, 'total:', lessons.length, 'enrolled:', isEnrolled)
  const sections = groupBySections(lessons)

  // Generate signed video URL when lesson changes
  useEffect(() => {
    async function generateSignedUrl() {
      if (!currentLesson || currentLesson.content_type !== 'video') {
        setVideoStreamUrl('')
        return
      }

      try {
        const res = await fetch('/api/video/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: currentLesson.id })
        })

        if (!res.ok) {
          console.error('[signed URL] Generation failed:', res.status)
          setVideoStreamUrl('')
          return
        }

        const { signedUrl } = await res.json()
        setVideoStreamUrl(signedUrl)
      } catch (error) {
        console.error('[signed URL]', error)
        setVideoStreamUrl('')
      }
    }

    generateSignedUrl()
  }, [currentLesson?.id, currentLesson?.content_type])

  // Issue certificate when modal is shown and enrollment is available
  useEffect(() => {
    console.log('[cert-effect] useEffect triggered', { showCertificate, enrollmentId: enrollment?.id, courseId: course?.id, certificateId })
    async function issueCert() {
      console.log('[cert-issueFunc] issueCert() called')
      if (!showCertificate || !enrollment?.id || !course?.id || certificateId) {
        console.log('[cert-blocked] blocked:', { showCertificate, enrollmentId: enrollment?.id, courseId: course?.id, certificateId })
        return
      }
      console.log('[cert-proceeding] proceeding with:', { enrollmentId: enrollment.id, courseId: course.id })
      
      console.log('[cert-gen] setCertGenerating(true)')
      setCertGenerating(true)
      try {
        console.log('[cert-fetch] Fetching /api/certificate/issue')
        const res = await fetch('/api/certificate/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enrollmentId: enrollment.id,
            courseId: course.id,
          }),
        })
        console.log('[cert-response] Response status:', res.status)
        const data = await res.json()
        console.log('[cert-data] Response data:', data)
        if ((data.issued || data.alreadyIssued) && data.pdfUrl) {
          console.log('[cert-success] Certificate issued/already issued, setting state')
          setCertificateId(data.certificateId)
          setCertificatePdfUrl(data.pdfUrl)
        } else {
          console.log('[cert-nodata] No pdfUrl in response or not issued')
        }
      } catch (err) {
        console.error('[cert-error] API call failed:', err)
      }
      console.log('[cert-done] setCertGenerating(false)')
      setCertGenerating(false)
    }
    console.log('[cert-calling] Calling issueCert() from useEffect')
    issueCert()
  }, [showCertificate, enrollment?.id, course?.id, certificateId])



  // Check if current lesson is accessible
  const isFirstLesson = currentLesson?.order_num === 1
  const canAccessLesson = isEnrolled || isFirstLesson

  async function markComplete(lessonOrderNum: number) {
    if (completed.includes(lessonOrderNum)) return
    const newCompleted = [...completed, lessonOrderNum]
    setCompleted(newCompleted)

    // Save to localStorage always
    try {
      localStorage.setItem(`academykit_progress_${slug}`, JSON.stringify({
        completed: newCompleted,
        lastUpdated: new Date().toISOString(),
      }))
    } catch (e) {}

    // Save to Supabase if enrolled
    if (enrollment && isEnrolled) {
      setSavingProgress(true)
      const nextOrder = lessonOrderNum + 1
      await supabase
        .from('enrollments')
        .update({
          completed_lessons: newCompleted,
          current_lesson: nextOrder,
          last_accessed: new Date().toISOString(),
        })
        .eq('id', enrollment.id)
      setSavingProgress(false)
    }

    if (newCompleted.length === lessons.length) {
      setTimeout(() => setShowCertificate(true), 400)
    }
  }

  function goToLesson(lesson: Lesson) {
    // Block access to non-free lessons if not enrolled
    if (!isEnrolled && lesson.order_num !== 1) {
      setCurrentLessonId(lesson.id)
      setSidebarOpen(false)
      return
    }
    setCurrentLessonId(lesson.id)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 violet-gradient rounded-xl animate-pulse-glow" />
          <p className="text-sm" style={{color:'#a1a1aa'}}>Loading course...</p>
        </div>
      </div>
    )
  }

  if (!course || lessons.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white font-semibold mb-2">No lessons available yet</p>
          <p className="text-sm mb-4" style={{color:'#a1a1aa'}}>
            The creator hasn't published any lessons yet.
          </p>
          <Link href="/" className="text-sm" style={{color:'#8b5cf6'}}>← Back to home</Link>
        </div>
      </div>
    )
  }

  const hasPrev = prevLesson !== null
  const hasNext = nextLesson !== null

  return (
    <div className="min-h-screen bg-black flex flex-col">

      {/* ── TOP NAV ── */}
      <nav className="h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-50"
        style={{background:'#0a0a0a', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>

        <div className="flex items-center gap-3">
          <button
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg"
            style={{background:'rgba(255,255,255,0.06)'}}
            onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-white" />}
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 violet-gradient rounded-md flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-white text-sm hidden sm:block">AcademyKit</span>
          </Link>
          <span className="hidden md:block text-sm truncate max-w-xs" style={{color:'#52525b'}}>
            / {course.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-32 h-1.5 rounded-full" style={{background:'rgba(255,255,255,0.08)'}}>
              <div className="h-1.5 rounded-full transition-all violet-gradient"
                style={{width:`${progress}%`}} />
            </div>
            <span className="text-xs font-medium" style={{color:'#a1a1aa'}}>{progress}%</span>
          </div>

          {allDone && (
            <button onClick={() => {
              console.log('[cert-btn] Certificate button clicked')
              setShowCertificate(true)
            }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{background:'rgba(250,204,21,0.15)', color:'#facc15', border:'1px solid rgba(250,204,21,0.2)'}}>
              <Award className="w-3.5 h-3.5" />
              Certificate
            </button>
          )}

          <Link href={`/c/${course.slug}`}
            className="text-xs px-3 py-1.5 rounded-lg hidden sm:flex"
            style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}>
            Course Page
          </Link>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden relative">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-30 bg-black/60"
            onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── SIDEBAR ── */}
        <aside
          className={`fixed md:relative z-40 md:z-auto w-80 md:w-72 lg:w-80 flex flex-col flex-shrink-0 transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
          style={{
            background:'#0a0a0a',
            borderRight:'1px solid rgba(255,255,255,0.06)',
            height:'calc(100vh - 56px)',
            overflowY:'auto',
            top:'56px',
          }}>

          {/* Course info */}
          <div className="p-4 border-b flex-shrink-0"
            style={{borderColor:'rgba(255,255,255,0.06)'}}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1"
              style={{color:'#52525b'}}>
              {course.host_name || 'Course Creator'}
            </p>
            <p className="text-sm font-semibold text-white leading-tight">{course.name}</p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-1.5 rounded-full" style={{background:'rgba(255,255,255,0.06)'}}>
                <div className="h-1.5 rounded-full violet-gradient transition-all"
                  style={{width:`${progress}%`}} />
              </div>
              <span className="text-xs flex-shrink-0" style={{color:'#a1a1aa'}}>
                {completed.length}/{lessons.length}
              </span>
            </div>

            {!isEnrolled && (
              <div className="mt-3 p-2.5 rounded-xl"
                style={{background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)'}}>
                <p className="text-xs" style={{color:'#8b5cf6'}}>
                  👀 You're watching the free preview — Lesson 1 only
                </p>
              </div>
            )}
          </div>

          {/* Lessons list */}
          <div className="flex-1 overflow-y-auto p-3">
            {Object.entries(sections).map(([section, sectionLessons]) => (
              <div key={section} className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-2"
                  style={{color:'#52525b'}}>
                  {section}
                </p>
                {sectionLessons.map(lesson => {
                  const isActive = lesson.id === currentLessonId
                  const isDone = completed.includes(lesson.order_num)
                  const isLocked = !isEnrolled && lesson.order_num !== 1

                  return (
                    <button key={lesson.id}
                      onClick={() => goToLesson(lesson)}
                      className="w-full flex items-start gap-3 p-3 rounded-xl mb-1 text-left transition-all"
                      style={{
                        background: isActive ? 'rgba(124,58,237,0.15)' : 'transparent',
                        border: isActive ? '1px solid rgba(124,58,237,0.25)' : '1px solid transparent',
                      }}>

                      {/* Status icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {isLocked ? (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{background:'rgba(255,255,255,0.06)'}}>
                            <Lock className="w-3 h-3" style={{color:'#52525b'}} />
                          </div>
                        ) : isDone ? (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{background:'rgba(74,222,128,0.2)'}}>
                            <CheckCircle className="w-3.5 h-3.5" style={{color:'#4ade80'}} />
                          </div>
                        ) : isActive ? (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center violet-gradient">
                            <Play className="w-2.5 h-2.5 text-white" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{background:'rgba(255,255,255,0.06)'}}>
                            <span className="text-xs font-bold" style={{color:'#52525b'}}>
                              {lesson.order_num}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug truncate"
                          style={{color: isLocked ? '#52525b' : isActive ? '#fff' : isDone ? '#71717a' : '#a1a1aa'}}>
                          {lesson.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {lesson.duration && (
                            <>
                              <Clock className="w-3 h-3" style={{color:'#52525b'}} />
                              <span className="text-xs" style={{color:'#52525b'}}>{lesson.duration}</span>
                            </>
                          )}
                          {lesson.order_num === 1 && !isEnrolled && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{background:'rgba(74,222,128,0.1)', color:'#4ade80'}}>
                              Free
                            </span>
                          )}
                          {isLocked && (
                            <span className="text-xs" style={{color:'#52525b'}}>Enroll to unlock</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto" style={{height:'calc(100vh - 56px)'}}>

          {/* Show locked screen if not enrolled and not lesson 1 */}
          {!canAccessLesson ? (
            <LockedScreen courseName={course.name} courseSlug={course.slug} />
          ) : (
            <>
              {/* Video player */}
              <div className="w-full bg-black" style={{ aspectRatio: '16/9', maxHeight: '65vh' }}>
                {currentLesson?.content_type === 'pdf' ? (
                  <iframe
                    src={currentLesson.content_url}
                    className="w-full h-full"
                    style={{ maxHeight: '65vh', border: 'none' }}
                    title={currentLesson.title}
                  />
                ) : (
                  (() => {
                    const url = currentLesson?.content_url || ''
                    const isTelegram = url.includes('t.me/')
                    const isSupabase = url.includes('.supabase.co/')
                    const isDirectVideo = url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) || isSupabase
                    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
                    
                    if (isTelegram) {
                      // Handle Telegram embed with a "Clean Mask"
                      // Ensure the URL is a post link, not just a channel link
                      const isPostLink = /\/\d+/.test(url)
                      if (!isPostLink) {
                        return (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-500 text-sm p-8 text-center">
                            Invalid Telegram link. Please ensure you are using a Public Channel post link (e.g., t.me/channel/123)
                          </div>
                        )
                      }

                      const embedUrl = url.includes('?embed=1') ? url : `${url}?embed=1`
                      return (
                        <div className="relative w-full h-full overflow-hidden bg-black group flex items-center justify-center">
                          {/* Top Shield: Very thin to only block the channel link */}
                          <div className="absolute top-0 left-0 w-full h-12 z-10" />
                          
                          {/* Bottom Shield: Very thin to only block the "View in" link */}
                          <div className="absolute bottom-0 left-0 w-full h-10 z-10" />

                          <iframe
                            src={embedUrl}
                            className="w-full h-full scale-[1.02] origin-center"
                            style={{ 
                              border: 'none',
                              pointerEvents: 'auto'
                            }}
                            title={currentLesson?.title}
                            allowFullScreen
                          />

                          {/* Branding Overlay */}
                          <div className="absolute top-3 left-3 z-20 pointer-events-none">
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm border border-white/5">
                              <Shield className="w-3 h-3 text-violet-light" />
                              <span className="text-[9px] font-bold text-white/60 tracking-widest uppercase">
                                AcademyKit Stream
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    if (isYouTube) {
                      // Basic YouTube embed conversion
                      let videoId = ''
                      if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0]
                      else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0]
                      
                      return (
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}`}
                          className="w-full h-full"
                          style={{ maxHeight: '65vh', border: 'none' }}
                          title={currentLesson?.title}
                          allowFullScreen
                        />
                      )
                    }

                    if (isDirectVideo) {
                      // Use signed stream URL with watermarked player
                      if (!videoStreamUrl) {
                        return (
                          <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500">
                            <p className="text-sm">Loading secure player...</p>
                          </div>
                        )
                      }

                      return (
                        <div className="relative w-full h-full bg-black">
                          <WatermarkedPlayer
                            src={videoStreamUrl}
                            studentName={user?.user_metadata?.full_name || 'Student'}
                            studentId={user?.email || user?.id?.slice(0, 8) || ''}
                            lessonTitle={currentLesson?.title || ''}
                            onEnded={() => currentLesson && markComplete(currentLesson.order_num)}
                          />

                          {/* Branding Overlay */}
                          <div className="absolute top-3 left-3 z-20 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm border border-white/5">
                              <Shield className="w-3 h-3 text-violet-light" />
                              <span className="text-[9px] font-bold text-white/60 tracking-widest uppercase">
                                AcademyKit Stream
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    // Fallback to iframe for other types (Vimeo, Bunny, etc.)
                    return (
                      <iframe
                        src={url}
                        className="w-full h-full"
                        style={{ maxHeight: '65vh', border: 'none' }}
                        title={currentLesson?.title}
                        allowFullScreen
                      />
                    )
                  })()
                )}
              </div>

              <div className="max-w-3xl mx-auto px-6 py-8">

                {/* Section label */}
                <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{color:'#52525b'}}>
                  {Object.entries(sections).find(([_, ls]) =>
                    ls.some(l => l.id === currentLessonId)
                  )?.[0] || ''}
                </p>

                {/* Title + complete button */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-white mb-1">
                      {currentLesson?.title}
                    </h1>
                    <div className="flex items-center gap-3 text-sm" style={{color:'#52525b'}}>
                      {currentLesson?.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />{currentLesson.duration}
                        </span>
                      )}
                      <span>·</span>
                      <span>Lesson {currentLesson?.order_num} of {lessons.length}</span>
                      {savingProgress && (
                        <span style={{color:'#8b5cf6'}}>· Saving...</span>
                      )}
                    </div>
                  </div>

                  {currentLesson && completed.includes(currentLesson.order_num) ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0"
                      style={{background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)'}}>
                      <CheckCircle className="w-4 h-4" style={{color:'#4ade80'}} />
                      <span className="text-sm font-medium" style={{color:'#4ade80'}}>Completed</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => currentLesson && markComplete(currentLesson.order_num)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all flex-shrink-0 violet-gradient hover:opacity-90 glow">
                      <CheckCircle className="w-4 h-4" />
                      Mark as Complete
                    </button>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between py-4 border-y mb-6"
                  style={{borderColor:'rgba(255,255,255,0.06)'}}>

                  <button
                    onClick={() => { if (hasPrev && prevLesson) goToLesson(prevLesson) }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
                    style={{
                      background:'rgba(255,255,255,0.05)',
                      color: hasPrev ? '#a1a1aa' : '#3f3f46',
                      cursor: hasPrev ? 'pointer' : 'not-allowed',
                      opacity: hasPrev ? 1 : 0.4,
                    }}>
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  {/* Dots */}
                  <div className="flex items-center gap-2">
                    {lessons.slice(
                      Math.max(0, currentIndex - 2),
                      currentIndex + 3
                    ).map(l => (
                      <button key={l.id} onClick={() => goToLesson(l)}
                        className="w-2 h-2 rounded-full transition-all"
                        style={{
                          background: l.id === currentLessonId
                            ? '#8b5cf6'
                            : completed.includes(l.order_num)
                            ? '#4ade80'
                            : 'rgba(255,255,255,0.15)'
                        }} />
                    ))}
                  </div>

                  {/* Next or enroll or certificate */}
                  {hasNext ? (
                    nextLesson && (!isEnrolled && nextLesson.order_num !== 1) ? (
                      <Link href={`/c/${course.slug}`}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all text-white violet-gradient hover:opacity-90">
                        Enroll to Continue
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => { if (nextLesson) goToLesson(nextLesson) }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white violet-gradient hover:opacity-90 transition-all">
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )
                  ) : (
                    <button onClick={() => {
                      console.log('[cert-btn-nav] Navigation Get Certificate button clicked')
                      setShowCertificate(true)
                    }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{background:'rgba(250,204,21,0.15)', color:'#facc15', border:'1px solid rgba(250,204,21,0.2)'}}>
                      <Award className="w-4 h-4" />
                      Get Certificate
                    </button>
                  )}
                </div>

                {/* Progress saved */}
                <div className="flex items-center gap-2 p-3 rounded-xl mb-3"
                  style={{background:'rgba(124,58,237,0.05)', border:'1px solid rgba(124,58,237,0.1)'}}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0" style={{color:'#8b5cf6'}} />
                  <p className="text-xs" style={{color:'#52525b'}}>
                    {isEnrolled
                      ? 'Your progress is saved to your account automatically.'
                      : 'Sign in and enroll to save your progress across devices.'}
                  </p>
                </div>

                {/* Shield badge */}
                <div className="flex items-center gap-2 p-3 rounded-xl"
                  style={{background:'rgba(74,222,128,0.04)', border:'1px solid rgba(74,222,128,0.1)'}}>
                  <Shield className="w-4 h-4 flex-shrink-0" style={{color:'#4ade80'}} />
                  <p className="text-xs" style={{color:'#52525b'}}>
                    Protected by AcademyKit Anti-Piracy Shield.
                    Unauthorized distribution is automatically detected and reported.
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── CERTIFICATE MODAL ── */}
      {showCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)'}}>
          {(() => {
            console.log('[cert-modal] Modal is open, certGenerating:', certGenerating, 'certificatePdfUrl:', certificatePdfUrl)
            return null
          })()}
          <div className="w-full max-w-md rounded-2xl p-8 text-center"
            style={{background:'#0a0a0a', border:'1px solid rgba(250,204,21,0.3)'}}>

            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{background:'rgba(250,204,21,0.1)', border:'1px solid rgba(250,204,21,0.2)'}}>
              <Award className="w-10 h-10" style={{color:'#facc15'}} />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Course Completed! 🎉</h2>
            <p className="mb-2" style={{color:'#a1a1aa'}}>
              You've completed <strong className="text-white">{course.name}</strong>
            </p>
            <p className="text-sm mb-6" style={{color:'#52525b'}}>
              {course.delivery !== 'web'
                ? 'Your certificate has been sent to your WhatsApp number.'
                : 'Your certificate is ready to download.'}
            </p>

            {/* Certificate preview */}
            <div className="rounded-xl p-5 mb-6 text-left"
              style={{background:'rgba(250,204,21,0.05)', border:'1px solid rgba(250,204,21,0.15)'}}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 violet-gradient rounded flex items-center justify-center">
                  <Shield className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-white">CERTIFICATE OF COMPLETION</span>
              </div>
              <p className="text-xs mb-1" style={{color:'#52525b'}}>This certifies that</p>
              <p className="text-lg font-bold text-white mb-1">
                {user?.user_metadata?.full_name || user?.email || 'You'}
              </p>
              <p className="text-xs mb-1" style={{color:'#52525b'}}>has successfully completed</p>
              <p className="text-sm font-semibold" style={{color:'#facc15'}}>{course.name}</p>
              <p className="text-xs mt-2" style={{color:'#52525b'}}>
                Issued by {course.host_name || 'Course Creator'} · {new Date().toLocaleDateString('en-IN', {
                  day:'numeric', month:'long', year:'numeric'
                })}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => {
                console.log('[cert-modal-back] Back to Course button clicked in modal')
                setShowCertificate(false)
              }}
                className="w-full py-3 rounded-xl font-medium text-white violet-gradient hover:opacity-90 glow">
                Back to Course
              </button>
              
              {certificatePdfUrl && (
                <a href={certificatePdfUrl} download
                  className="w-full py-3 rounded-xl font-medium text-white text-center transition-all flex items-center justify-center gap-2"
                  style={{background:'rgba(250,204,21,0.15)', color:'#facc15', border:'1px solid rgba(250,204,21,0.2)'}}>
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
              )}

              {certGenerating && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm" style={{color:'#a1a1aa'}}>
                  <div className="w-4 h-4 rounded-full animate-pulse-glow" style={{background:'#8b5cf6'}} />
                  Generating certificate...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
