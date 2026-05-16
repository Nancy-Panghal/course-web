'use client'
import { useState, useEffect } from 'react'
import { ArrowRight, Copy, Check, Share2, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { findPaidEnrollment } from '@/lib/enrollments'
import EnrollModal from '@/components/EnrollModal'

interface CourseData {
  id: string
  name: string
  price: number
  creatorSlug: string
  creatorName: string
  creatorId: string
  waNumber?: string
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

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) { setChecking(false); return }

      // Check if this user is the creator
      if (user.id === course.creatorId) {
        setIsCreator(true)
        setChecking(false)
        return
      }

      // Check if student is already enrolled
      const enrollment = await findPaidEnrollment({
        courseId: course.id,
        user,
        select: 'id',
      })

      if (enrollment) {
        setIsEnrolled(true)
        // Automatic redirect to learn page if already enrolled
        window.location.href = `/learn/${course.creatorSlug}`
      }
      setChecking(false)
    }
    check()
  }, [course.id, course.creatorId])

  function copyCourseLink() {
    navigator.clipboard.writeText(`${window.location.origin}/c/${course.creatorSlug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const courseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/c/${course.creatorSlug}`
    : ''

  // ── CREATOR VIEW ──
  if (isCreator) {
    if (variant === 'nav') {
      return null // Remove from nav for creator
    }

    if (variant === 'card') {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-center" style={{color:'#52525b'}}>
            You are viewing your own course
          </p>
        </div>
      )
    }

    if (variant === 'cta') {
      return null // Remove from bottom CTA for creator
    }
  }

  // ── ALREADY ENROLLED ──
  if (isEnrolled) {
    const learnUrl = `/learn/${course.creatorSlug}`

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
      return (
        <div className="w-24 h-9 rounded-lg animate-pulse"
          style={{background:'rgba(255,255,255,0.06)'}} />
      )
    }
    return (
      <div className="w-full h-12 rounded-xl animate-pulse"
        style={{background:'rgba(255,255,255,0.06)'}} />
    )
  }

  // ── STUDENT / GUEST ENROLL BUTTON ──
  if (variant === 'nav') {
    return (
      <button onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white violet-gradient hover:opacity-90 glow transition-all">
        Enroll Now
        {showModal && (
          <EnrollModal
            onClose={() => setShowModal(false)}
            course={course}
          />
        )}
      </button>
    )
  }

  if (variant === 'cta') {
    return (
      <>
        <button onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 violet-gradient px-8 py-4 rounded-xl font-semibold text-white hover:opacity-90 glow-strong transition-all">
          Enroll for ₹{course.price.toLocaleString()}
          <ArrowRight className="w-5 h-5" />
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

  // card variant
  return (
    <>
      <button onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white violet-gradient hover:opacity-90 glow transition-all">
        Enroll Now — ₹{course.price.toLocaleString()}
        <ArrowRight className="w-4 h-4" />
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
