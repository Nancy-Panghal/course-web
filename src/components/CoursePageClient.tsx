'use client'
import { useState, useEffect } from 'react'
import { ArrowRight, Copy, Check, Share2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { findPaidEnrollment } from '@/lib/enrollments'
import EnrollModal from '@/components/EnrollModal'
import { slugify } from '@/lib/utils'

interface CourseData {
  id: string
  name: string
  price: number
  creatorSlug: string
  creatorName: string
  creatorId: string
  telegramBotUsername?: string
  free_preview_config?: string
}

interface Props {
  course: CourseData
  variant: 'nav' | 'card' | 'cta'
}

export default function CoursePageClient({ course, variant }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [checking, setChecking] = useState(true)
  const [copied, setCopied] = useState(false)

  const creatorSlug = slugify(course.creatorName)
  const courseSlug = slugify(course.name)
  const aboutUrl = `/about-course/${creatorSlug}/${courseSlug}/${course.id}`
  const learnUrl = `/course/${creatorSlug}/${courseSlug}/${course.id}`

  // REPLACE WITH:
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) { setChecking(false); return }

      // STEP 1: Owner check runs FIRST — before any enrollment query.
      // This prevents even one frame where the enroll button could render
      // for the course owner. creatorId is passed from the server-rendered page
      // so it is always available synchronously here.
      if (user.id === course.creatorId) {
        setIsCreator(true)
        setChecking(false)
        return
      }

      // STEP 2: Enrollment check — only runs for non-owners.
      // A creator viewing ANOTHER creator's course reaches this path,
      // which is correct: they should be able to enroll as a student.
      const enrollment = await findPaidEnrollment({
        courseId: course.id,
        user,
        select: 'id',
      })

      if (enrollment) {
        setIsEnrolled(true)
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/course/')) {
          window.location.href = learnUrl
        }
      }
      setChecking(false)
    }
    check()
  }, [course.id, course.creatorId, learnUrl])

  function copyCourseLink() {
    navigator.clipboard.writeText(`${window.location.origin}${aboutUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // REPLACE WITH:
  // ── OWNER VIEW ──
  // The course creator should never see an enroll button on their own course.
  // We show a friendly badge for card/cta variants and nothing for nav.
  if (isCreator) {
    if (variant === 'nav') return null

    if (variant === 'card' || variant === 'cta') {
      return (
        <div
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
          style={{
            background: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(124,58,237,0.2)',
            color: '#a78bfa',
            cursor: 'default',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4 flex-shrink-0"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          You are the creator of this course
        </div>
      )
    }
  }

  // ── ALREADY ENROLLED ──
  if (isEnrolled) {
    if (variant === 'nav') {
      return (
        <a href={learnUrl}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all violet-gradient text-white hover:opacity-90">
          Continue Learning →
        </a>
      )
    }

    return (
      <div className="flex flex-col gap-2 w-full">
        <a href={learnUrl}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 glow transition-all">
          Continue Learning →
        </a>
        <p className="text-xs text-center" style={{color:'#4ade80'}}>
          ✓ You are enrolled in this course
        </p>
      </div>
    )
  }

  // ── LOADING ──
  if (checking) {
    if (variant === 'nav') {
      return <div className="w-24 h-9 rounded-lg animate-pulse bg-white/5" />
    }
    return <div className="w-full h-12 rounded-xl animate-pulse bg-white/5" />
  }

  // ── STUDENT / GUEST ENROLL BUTTON ──
  return (
    <>
      <button onClick={() => setShowModal(true)}
        className={`flex items-center justify-center gap-2 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 glow transition-all ${
          variant === 'nav' ? 'px-4 py-2 text-sm' : 
          variant === 'cta' ? 'px-8 py-4 text-lg' : 'w-full py-3 text-base'
        }`}>
        {variant === 'nav' ? 'Enroll Now' : 
         variant === 'cta' ? `Enroll for ₹${course.price.toLocaleString()}` : 
         `Enroll Now — ₹${course.price.toLocaleString()}`}
        <ArrowRight className={variant === 'nav' ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>

      {showModal && (
        <EnrollModal
          onClose={() => setShowModal(false)}
          course={course}
        />
      )}
    </>
  )
}
