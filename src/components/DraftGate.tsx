'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { findPaidEnrollment } from '@/lib/enrollments'
import { slugify } from '@/lib/utils'

interface CourseData {
  id: string
  name: string
  creatorSlug: string
  creatorName: string
}

export default function DraftGate({
  isPublished,
  courseData,
  children,
}: {
  isPublished: boolean
  courseData: CourseData
  children: React.ReactNode
}) {
  // Published courses skip all checks — render immediately, no flicker.
  const [status, setStatus] = useState<'checking' | 'allow' | 'block'>(
    isPublished ? 'allow' : 'checking'
  )

  useEffect(() => {
    if (isPublished) return

    let cancelled = false

    async function check() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setStatus('block')
        return
      }

      const enrollment = await findPaidEnrollment({
        courseId: courseData.id,
        user,
        select: 'id',
      })

      if (cancelled) return

      if (enrollment) {
        // Paid student — send them to their actual lesson page,
        // not the marketing page they bookmarked/were sent.
        const creatorSlug = slugify(courseData.creatorName || 'instructor')
        const courseSlug = slugify(courseData.name)
        window.location.href = `/course/${creatorSlug}/${courseSlug}/${courseData.id}`
        return
      }

      setStatus('block')
    }

    check()
    return () => { cancelled = true }
  }, [isPublished, courseData.id, courseData.name, courseData.creatorName])

  if (status === 'allow') return <>{children}</>

  if (status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', animation: 'pulse 1s infinite' }} />
      </div>
    )
  }

  // status === 'block' — not enrolled (or not signed in), course is draft
  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, marginBottom: 12 }}>
          Course Not Available
        </h2>
        <p style={{ color: '#71717a', fontSize: '0.95rem', lineHeight: 1.6 }}>
          This course is currently unavailable. It may be under maintenance or not yet launched.
        </p>
      </div>
    </div>
  )
}