/**
 * GET  /api/student/ratings?enrollmentIds=id1,id2,...
 *   Returns which of the given enrollment IDs already have a rating —
 *   used by the my-courses page to decide whether to show the "Rate this
 *   course" prompt.
 *
 * POST /api/student/ratings
 *   Submits a rating for a completed course. Body: { enrollmentId, courseId,
 *   rating, reviewText }. Only allowed once a certificate has been issued
 *   for the enrollment (the same completion gate the certificate itself
 *   uses). One rating per enrollment — enforced by the unique constraint
 *   on course_ratings(course_id, enrollment_id).
 *
 * Auth model deliberately matches /api/certificate/issue: authorized by
 * enrollmentId + courseId match, no bearer token required. That's the
 * existing trust model for my-courses actions in this app — not a new one
 * introduced for this route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get('enrollmentIds') || ''
    const enrollmentIds = raw.split(',').map(s => s.trim()).filter(Boolean)
    if (enrollmentIds.length === 0) return NextResponse.json({ rated: [] })

    const { data, error } = await supabase
      .from('course_ratings')
      .select('enrollment_id')
      .in('enrollment_id', enrollmentIds)

    if (error) throw error

    return NextResponse.json({ rated: (data || []).map(r => r.enrollment_id) })
  } catch (err: any) {
    console.error('[student/ratings GET] error:', err.message)
    return NextResponse.json({ error: 'Failed to load ratings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { enrollmentId, courseId, rating, reviewText } = body

    if (!enrollmentId || !courseId) {
      return NextResponse.json({ error: 'enrollmentId and courseId are required' }, { status: 400 })
    }

    const ratingNum = Number(rating)
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: 'rating must be an integer from 1 to 5' }, { status: 400 })
    }

    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .select('id, course_uuid')
      .eq('id', enrollmentId)
      .maybeSingle()

    if (enrollErr || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }
    if (enrollment.course_uuid !== courseId) {
      return NextResponse.json({ error: 'Course mismatch' }, { status: 403 })
    }

    // Completion gate — same rule as certificate issuance: a certificate
    // row must already exist for this enrollment.
    const { data: certificate } = await supabase
      .from('certificates')
      .select('student_name')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle()

    if (!certificate) {
      return NextResponse.json({ error: 'Complete the course to unlock rating.' }, { status: 403 })
    }

    const { error: insertErr } = await supabase.from('course_ratings').insert({
      course_id: courseId,
      enrollment_id: enrollmentId,
      student_name: certificate.student_name,
      rating: ratingNum,
      review_text: (typeof reviewText === 'string' && reviewText.trim()) ? reviewText.trim().slice(0, 1000) : null,
    })

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'You already rated this course.' }, { status: 409 })
      }
      throw insertErr
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[student/ratings POST] error:', err.message)
    return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 })
  }
}