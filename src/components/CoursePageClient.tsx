'use client'
import { useState, useEffect } from 'react'
import { ArrowRight, Copy, Check, Share2, MessageCircle } from 'lucide-react'
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

  const creatorSlug = slugify(course.creatorName)
  const courseSlug = slugify(course.name)
  const aboutUrl = `/about-course/${creatorSlug}/${courseSlug}/${course.id}`
  const learnUrl = `/course/${creatorSlug}/${courseSlug}/${course.id}`

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

  // ── CREATOR VIEW ──
  if (isCreator) {
    if (variant === 'nav') return null
    if (variant === 'card') {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-center" style={{color:'#52525b'}}>
            You are viewing your own course
          </p>
        </div>
      )
    }
    if (variant === 'cta') return null
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
