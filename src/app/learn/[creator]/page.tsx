'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  Shield, CheckCircle, Play, ChevronRight,
  ChevronLeft, Award, Menu, X, Clock
} from 'lucide-react'

const mockCourse = {
  courseName: 'SEO Masterclass 2026',
  creatorName: 'Rahul Sharma',
  totalLessons: 12,
}

const mockLessons = [
  { id: 1, title: 'What is SEO in 2026', duration: '18 min', section: 'Module 1 — Foundations', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: true },
  { id: 2, title: 'How Google ranks pages', duration: '24 min', section: 'Module 1 — Foundations', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 3, title: 'Setting up your tools', duration: '15 min', section: 'Module 1 — Foundations', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 4, title: 'Finding buyer keywords', duration: '32 min', section: 'Module 2 — Keyword Research', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 5, title: 'Competitor keyword gaps', duration: '28 min', section: 'Module 2 — Keyword Research', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 6, title: 'Long-tail strategy', duration: '21 min', section: 'Module 2 — Keyword Research', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 7, title: 'Title and meta optimization', duration: '19 min', section: 'Module 3 — On-Page SEO', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 8, title: 'Content structure', duration: '26 min', section: 'Module 3 — On-Page SEO', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 9, title: 'Internal linking', duration: '22 min', section: 'Module 3 — On-Page SEO', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 10, title: 'What backlinks matter', duration: '30 min', section: 'Module 4 — Link Building', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 11, title: 'Outreach templates', duration: '25 min', section: 'Module 4 — Link Building', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
  { id: 12, title: 'Scaling your strategy', duration: '35 min', section: 'Module 4 — Link Building', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4', free: false },
]

function groupBySections(lessons: typeof mockLessons) {
  const sections: Record<string, typeof mockLessons> = {}
  lessons.forEach(l => {
    if (!sections[l.section]) sections[l.section] = []
    sections[l.section].push(l)
  })
  return sections
}

const STORAGE_KEY = (creator: string) => `academykit_progress_${creator}`

export default function LearnPage({ params }: { params: Promise<{ creator: string }> }) {
  const { creator } = use(params)

  // ── Start with empty state — load from localStorage after mount ──
  const [mounted, setMounted] = useState(false)
  const [currentLessonId, setCurrentLessonId] = useState(1)
  const [completed, setCompleted] = useState<number[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCertificate, setShowCertificate] = useState(false)

  // Load saved progress after mount (client only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY(creator))
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.completed) setCompleted(parsed.completed)
        if (parsed.currentLessonId) setCurrentLessonId(parsed.currentLessonId)
      }
    } catch (e) {
      // ignore parse errors
    }
    setMounted(true)
  }, [creator])

  // Save progress whenever completed changes
  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(STORAGE_KEY(creator), JSON.stringify({
        completed,
        currentLessonId,
        lastUpdated: new Date().toISOString(),
      }))
    } catch (e) {
      // ignore storage errors
    }
  }, [completed, currentLessonId, mounted, creator])

  const currentLesson = mockLessons.find(l => l.id === currentLessonId) || mockLessons[0]
  const sections = groupBySections(mockLessons)
  const currentIndex = mockLessons.findIndex(l => l.id === currentLesson.id)
  const prevLesson = currentIndex > 0 ? mockLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < mockLessons.length - 1 ? mockLessons[currentIndex + 1] : null
  const progress = Math.round((completed.length / mockLessons.length) * 100)
  const allDone = completed.length === mockLessons.length

  function markComplete(id: number) {
    if (completed.includes(id)) return
    const newCompleted = [...completed, id]
    setCompleted(newCompleted)
    if (newCompleted.length === mockLessons.length) {
      setTimeout(() => setShowCertificate(true), 400)
    }
  }

  function goToLesson(lesson: typeof mockLessons[0]) {
    setCurrentLessonId(lesson.id)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Show nothing until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 violet-gradient rounded-xl animate-pulse-glow" />
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
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-white" />}
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 violet-gradient rounded-md flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-white text-sm hidden sm:block">AcademyKit</span>
          </Link>
          <span className="hidden md:block text-sm truncate max-w-xs" style={{color:'#52525b'}}>
            / {mockCourse.courseName}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-32 h-1.5 rounded-full" style={{background:'rgba(255,255,255,0.08)'}}>
              <div
                className="h-1.5 rounded-full transition-all violet-gradient"
                style={{width:`${progress}%`}}
              />
            </div>
            <span className="text-xs font-medium" style={{color:'#a1a1aa'}}>{progress}%</span>
          </div>

          {allDone && (
            <button
              onClick={() => setShowCertificate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{background:'rgba(250,204,21,0.15)', color:'#facc15', border:'1px solid rgba(250,204,21,0.2)'}}>
              <Award className="w-3.5 h-3.5" />
              Get Certificate
            </button>
          )}

          <Link href={`/c/${creator}`}
            className="text-xs px-3 py-1.5 rounded-lg"
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
          }}
        >
          {/* Course info */}
          <div className="p-4 border-b flex-shrink-0"
            style={{borderColor:'rgba(255,255,255,0.06)'}}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1"
              style={{color:'#52525b'}}>
              {mockCourse.creatorName}
            </p>
            <p className="text-sm font-semibold text-white leading-tight">
              {mockCourse.courseName}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-1.5 rounded-full" style={{background:'rgba(255,255,255,0.06)'}}>
                <div className="h-1.5 rounded-full violet-gradient transition-all"
                  style={{width:`${progress}%`}} />
              </div>
              <span className="text-xs flex-shrink-0" style={{color:'#a1a1aa'}}>
                {completed.length}/{mockLessons.length}
              </span>
            </div>
          </div>

          {/* Lessons list */}
          <div className="flex-1 overflow-y-auto p-3">
            {Object.entries(sections).map(([section, lessons]) => (
              <div key={section} className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-2"
                  style={{color:'#52525b'}}>
                  {section}
                </p>
                {lessons.map(lesson => {
                  const isActive = lesson.id === currentLesson.id
                  const isDone = completed.includes(lesson.id)
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => goToLesson(lesson)}
                      className="w-full flex items-start gap-3 p-3 rounded-xl mb-1 text-left transition-all"
                      style={{
                        background: isActive ? 'rgba(124,58,237,0.15)' : 'transparent',
                        border: isActive
                          ? '1px solid rgba(124,58,237,0.25)'
                          : '1px solid transparent',
                      }}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {isDone ? (
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
                              {lesson.id}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug truncate"
                          style={{color: isActive ? '#fff' : isDone ? '#71717a' : '#a1a1aa'}}>
                          {lesson.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3" style={{color:'#52525b'}} />
                          <span className="text-xs" style={{color:'#52525b'}}>{lesson.duration}</span>
                          {lesson.free && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{background:'rgba(74,222,128,0.1)', color:'#4ade80'}}>
                              Free
                            </span>
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

          {/* Video player */}
          <div className="w-full bg-black" style={{aspectRatio:'16/9', maxHeight:'65vh'}}>
            <video
              key={currentLesson.id}
              controls
              className="w-full h-full"
              style={{maxHeight:'65vh'}}
              onEnded={() => markComplete(currentLesson.id)}
            >
              <source src={currentLesson.videoUrl} type="video/mp4" />
            </video>
          </div>

          <div className="max-w-3xl mx-auto px-6 py-8">

            <p className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{color:'#52525b'}}>
              {currentLesson.section}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">{currentLesson.title}</h1>
                <div className="flex items-center gap-3 text-sm" style={{color:'#52525b'}}>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />{currentLesson.duration}
                  </span>
                  <span>·</span>
                  <span>Lesson {currentLesson.id} of {mockLessons.length}</span>
                </div>
              </div>

              {completed.includes(currentLesson.id) ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0"
                  style={{background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)'}}>
                  <CheckCircle className="w-4 h-4" style={{color:'#4ade80'}} />
                  <span className="text-sm font-medium" style={{color:'#4ade80'}}>Completed</span>
                </div>
              ) : (
                <button
                  onClick={() => markComplete(currentLesson.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all flex-shrink-0 violet-gradient hover:opacity-90 glow"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Complete
                </button>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between py-4 border-y mb-6"
              style={{borderColor:'rgba(255,255,255,0.06)'}}>

              {/* Previous — fixed: no conditional disabled attribute */}
              <button
                onClick={() => { if (hasPrev && prevLesson) goToLesson(prevLesson) }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
                style={{
                  background:'rgba(255,255,255,0.05)',
                  color: hasPrev ? '#a1a1aa' : '#3f3f46',
                  cursor: hasPrev ? 'pointer' : 'not-allowed',
                  opacity: hasPrev ? 1 : 0.4,
                }}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {/* Dots */}
              <div className="flex items-center gap-2">
                {mockLessons.slice(
                  Math.max(0, currentIndex - 2),
                  currentIndex + 3
                ).map(l => (
                  <button
                    key={l.id}
                    onClick={() => goToLesson(l)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background: l.id === currentLesson.id
                        ? '#8b5cf6'
                        : completed.includes(l.id)
                        ? '#4ade80'
                        : 'rgba(255,255,255,0.15)'
                    }}
                  />
                ))}
              </div>

              {/* Next or Certificate */}
              {hasNext ? (
                <button
                  onClick={() => { if (nextLesson) goToLesson(nextLesson) }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white violet-gradient hover:opacity-90 transition-all"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowCertificate(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background:'rgba(250,204,21,0.15)',
                    color:'#facc15',
                    border:'1px solid rgba(250,204,21,0.2)'
                  }}
                >
                  <Award className="w-4 h-4" />
                  Get Certificate
                </button>
              )}
            </div>

            {/* Progress saved notice */}
            <div className="flex items-center gap-2 p-3 rounded-xl mb-3"
              style={{background:'rgba(124,58,237,0.05)', border:'1px solid rgba(124,58,237,0.1)'}}>
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{color:'#8b5cf6'}} />
              <p className="text-xs" style={{color:'#52525b'}}>
                Your progress is saved automatically. Come back anytime and continue where you left off.
              </p>
            </div>

            {/* Shield badge */}
            <div className="flex items-center gap-2 p-3 rounded-xl"
              style={{background:'rgba(74,222,128,0.04)', border:'1px solid rgba(74,222,128,0.1)'}}>
              <Shield className="w-4 h-4 flex-shrink-0" style={{color:'#4ade80'}} />
              <p className="text-xs" style={{color:'#52525b'}}>
                This content is protected by AcademyKit Anti-Piracy Shield.
                Unauthorized distribution is automatically detected and reported.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* ── CERTIFICATE MODAL ── */}
      {showCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)'}}>
          <div className="w-full max-w-md rounded-2xl p-8 text-center"
            style={{background:'#0a0a0a', border:'1px solid rgba(250,204,21,0.3)'}}>

            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{background:'rgba(250,204,21,0.1)', border:'1px solid rgba(250,204,21,0.2)'}}>
              <Award className="w-10 h-10" style={{color:'#facc15'}} />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Course Completed! 🎉</h2>
            <p className="mb-2" style={{color:'#a1a1aa'}}>
              You've completed{' '}
              <strong className="text-white">{mockCourse.courseName}</strong>
            </p>
            <p className="text-sm mb-6" style={{color:'#52525b'}}>
              Your certificate has been sent to your WhatsApp number.
            </p>

            {/* Certificate preview */}
            <div className="rounded-xl p-5 mb-6 text-left"
              style={{background:'rgba(250,204,21,0.05)', border:'1px solid rgba(250,204,21,0.15)'}}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 violet-gradient rounded flex items-center justify-center">
                  <Shield className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-white">
                  CERTIFICATE OF COMPLETION
                </span>
              </div>
              <p className="text-xs mb-1" style={{color:'#52525b'}}>This certifies that</p>
              <p className="text-lg font-bold text-white mb-1">You</p>
              <p className="text-xs mb-1" style={{color:'#52525b'}}>has successfully completed</p>
              <p className="text-sm font-semibold" style={{color:'#facc15'}}>
                {mockCourse.courseName}
              </p>
              <p className="text-xs mt-2" style={{color:'#52525b'}}>
                Issued by {mockCourse.creatorName}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowCertificate(false)}
                className="w-full py-3 rounded-xl font-medium text-white violet-gradient hover:opacity-90 transition-all glow"
              >
                Back to Course
              </button>
              <Link
                href={`/c/${creator}`}
                className="w-full py-3 rounded-xl text-sm font-medium text-center transition-all"
                style={{background:'rgba(255,255,255,0.05)', color:'#a1a1aa'}}
              >
                Back to Course Page
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}