'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Shield, CheckCircle, Play, ChevronRight,
  ChevronLeft, Award, Menu, X, Clock, Lock
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import EnrollModal from '@/components/EnrollModal'

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
  price: number
  free_preview_config?: string
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

function isLessonFree(lesson: Lesson, config: string) {
  if (config === 'lesson 1 free') return lesson.order_num === 1
  if (config === '2 lessons free') return lesson.order_num <= 2
  if (config === '3 lessons free') return lesson.order_num <= 3
  if (config === 'module 1 free') return lesson.order_num <= 3
  if (config === '2 modules free') return lesson.order_num <= 6
  if (config === 'nothing free') return false
  return false
}

// ── LOCKED LESSON SCREEN ──
function LockedScreen({ course, onEnroll }: { course: Course; onEnroll: () => void }) {
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
          You've watched the free preview. Enroll in <strong className="text-white">{course.name}</strong> to
          unlock all lessons, get WhatsApp delivery, and earn your certificate.
        </p>
        <button onClick={onEnroll}
          className="inline-flex items-center gap-2 violet-gradient px-8 py-4 rounded-xl font-semibold text-white hover:opacity-90 glow-strong transition-all">
          Enroll Now — ₹{course.price.toLocaleString()}
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="mt-4">
          <p className="text-xs text-zinc-500">
            Already enrolled? Sign in to access your content.
          </p>
        </div>
        <p className="text-xs mt-4" style={{color:'#52525b'}}>
          One-time payment · Lifetime access · 256-bit Secure
        </p>
      </div>
    </div>
  )
}

export default function CourseLearnPage({
  params
}: {
  params: Promise<{ creatorName: string, courseName: string, courseId: string }>
}) {
  const { courseId } = use(params)
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
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [creatorProfile, setCreatorProfile] = useState<any>(null)

  useEffect(() => {
    async function load() {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      // Fetch course by ID
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (!courseData) {
        router.push('/')
        return
      }
      setCourse(courseData)

      // Fetch creator
      const { data: creatorData } = await supabase
        .from('creators')
        .select('id, name, whatsapp_number')
        .eq('id', courseData.creator_id)
        .single()
      setCreatorProfile(creatorData)

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
        const { data: enrollmentData } = await supabase
          .from('enrollments')
          .select('*')
          .eq('course_uuid', courseData.id)
          .eq('payment_status', 'paid')
          .single()

        if (enrollmentData) {
          setIsEnrolled(true)
          setEnrollment(enrollmentData)
          setCompleted(enrollmentData.completed_lessons || [])
          
          const currentOrder = enrollmentData.current_lesson || 1
          const resumeLesson = fetchedLessons.find((l: Lesson) => l.order_num === currentOrder) || fetchedLessons[0]
          if (resumeLesson) setCurrentLessonId(resumeLesson.id)
        }
      }

      setLoading(false)
      setMounted(true)
    }
    load()
  }, [courseId, router])

  const currentLesson = lessons.find(l => l.id === currentLessonId) || lessons[0]
  const currentIndex = lessons.findIndex(l => l.id === currentLessonId)
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null
  const progress = lessons.length > 0 ? Math.round((completed.length / lessons.length) * 100) : 0
  const allDone = lessons.length > 0 && completed.length === lessons.length
  const sections = groupBySections(lessons)

  // Check if current lesson is accessible
  const isFree = currentLesson && isLessonFree(currentLesson, course?.free_preview_config || 'nothing free')
  const canAccessLesson = isEnrolled || isFree

  async function markComplete(lessonOrderNum: number) {
    if (completed.includes(lessonOrderNum)) return
    const newCompleted = [...completed, lessonOrderNum]
    setCompleted(newCompleted)

    if (enrollment && isEnrolled) {
      setSavingProgress(true)
      await supabase
        .from('enrollments')
        .update({
          completed_lessons: newCompleted,
          current_lesson: lessonOrderNum + 1,
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
    setCurrentLessonId(lesson.id)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 violet-gradient rounded-lg animate-pulse-glow" />
      </div>
    )
  }

  if (!course) return null

  const hasPrev = prevLesson !== null
  const hasNext = nextLesson !== null
  const isNextLocked = nextLesson && !isEnrolled && !isLessonFree(nextLesson, course.free_preview_config || 'nothing free')

  return (
    <div className="min-h-screen bg-black flex flex-col text-white">
      {showEnrollModal && (
        <EnrollModal
          onClose={() => setShowEnrollModal(false)}
          course={{
            id: course.id,
            name: course.name,
            price: course.price,
            creatorSlug: course.slug,
            creatorName: course.host_name || creatorProfile?.name || '',
            creatorId: course.creator_id,
            waNumber: creatorProfile?.whatsapp_number,
            free_preview_config: course.free_preview_config,
          }}
        />
      )}

      {/* Nav */}
      <nav className="h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden">
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 violet-gradient rounded flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm hidden sm:block">AcademyKit</span>
          </Link>
          <span className="hidden md:block text-xs text-zinc-500 truncate max-w-[200px]">/ {course.name}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-24 h-1 rounded-full bg-white/5">
              <div className="h-full violet-gradient rounded-full" style={{width:`${progress}%`}} />
            </div>
            <span className="text-[10px] font-bold text-zinc-500">{progress}%</span>
          </div>
          {allDone && (
            <button onClick={() => setShowCertificate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[10px] font-bold uppercase">
              <Award className="w-3.5 h-3.5" /> Certificate
            </button>
          )}
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`fixed md:relative z-40 w-72 h-[calc(100vh-56px)] bg-black border-r border-white/5 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-4 border-b border-white/5">
            <p className="text-[10px] font-bold text-zinc-600 uppercase mb-1">{course.host_name || 'Instructor'}</p>
            <p className="text-sm font-bold truncate">{course.name}</p>
          </div>
          <div className="overflow-y-auto h-full pb-20">
            {Object.entries(sections).map(([section, sectionLessons]) => (
              <div key={section} className="mt-4">
                <p className="text-[10px] font-bold text-zinc-600 uppercase px-4 mb-2">{section}</p>
                {sectionLessons.map(lesson => {
                  const isActive = lesson.id === currentLessonId
                  const isDone = completed.includes(lesson.order_num)
                  const isLocked = !isEnrolled && !isLessonFree(lesson, course.free_preview_config || 'nothing free')
                  
                  return (
                    <button key={lesson.id} onClick={() => goToLesson(lesson)} className={`w-full px-4 py-3 flex items-start gap-3 transition-colors ${isActive ? 'bg-violet-500/10 border-r-2 border-violet-500' : 'hover:bg-white/5'}`}>
                      <div className="mt-0.5">
                        {isLocked ? <Lock className="w-3.5 h-3.5 text-zinc-600" /> : 
                         isDone ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> :
                         isActive ? <Play className="w-3.5 h-3.5 text-violet-500 fill-violet-500" /> :
                         <span className="text-[10px] font-bold text-zinc-600">{lesson.order_num}</span>}
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-xs font-medium ${isLocked ? 'text-zinc-600' : isActive ? 'text-white' : 'text-zinc-400'}`}>{lesson.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-zinc-600">{lesson.duration}</span>
                          {!isEnrolled && isLessonFree(lesson, course.free_preview_config || 'nothing free') && (
                            <span className="text-[9px] px-1 bg-green-500/10 text-green-500 rounded uppercase font-bold">Free</span>
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

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          {!canAccessLesson ? (
            <LockedScreen course={course} onEnroll={() => setShowEnrollModal(true)} />
          ) : (
            <div className="max-w-4xl mx-auto py-8 px-6">
              <div className="aspect-video rounded-2xl overflow-hidden bg-zinc-900 mb-8 border border-white/5">
                {currentLesson?.content_type === 'video' ? (
                  <iframe 
                    src={`https://www.youtube.com/embed/${currentLesson.content_url.split('v=')[1]?.split('&')[0] || currentLesson.content_url.split('youtu.be/')[1]}`}
                    className="w-full h-full"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500">
                    Document Content: <a href={currentLesson?.content_url} target="_blank" className="text-violet-400 ml-2">View File</a>
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                <div>
                  <h1 className="text-2xl font-bold mb-2">{currentLesson?.title}</h1>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {currentLesson?.duration}</span>
                    <span>Lesson {currentLesson?.order_num} of {lessons.length}</span>
                  </div>
                </div>
                {!completed.includes(currentLesson?.order_num) ? (
                  <button onClick={() => markComplete(currentLesson.order_num)} className="px-6 py-2.5 rounded-xl violet-gradient font-bold text-sm glow">
                    Mark as Complete
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm font-bold">
                    <CheckCircle className="w-4 h-4" /> Completed
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-6 border-y border-white/5">
                <button onClick={() => hasPrev && goToLesson(prevLesson)} disabled={!hasPrev} className="flex items-center gap-2 text-sm text-zinc-400 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                
                {hasNext ? (
                  isNextLocked ? (
                    <button onClick={() => setShowEnrollModal(true)} className="flex items-center gap-2 px-6 py-2 rounded-xl violet-gradient text-sm font-bold glow">
                      Enroll to Unlock Next — ₹{course.price.toLocaleString()} <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => goToLesson(nextLesson)} className="flex items-center gap-2 text-sm text-white font-bold">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  )
                ) : (
                  <button onClick={() => setShowCertificate(true)} className="px-6 py-2 rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-sm font-bold">
                    Get Certificate
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
