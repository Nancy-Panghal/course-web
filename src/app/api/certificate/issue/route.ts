/**
 * POST /api/certificate/issue
 * Fully idempotent: safe to call multiple times for the same enrollment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { issueCertificate, type CertTemplate } from '@/lib/certificate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { enrollmentId, courseId } = body

    console.log('[certificate/issue] Request received:', { enrollmentId, courseId })

    if (!enrollmentId || !courseId) {
      return NextResponse.json({ error: 'enrollmentId and courseId are required' }, { status: 400 })
    }

    // ── Fetch enrollment (only match on enrollmentId, courseId check is secondary) ──
    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .select('id, student_id, completed_lessons, payment_status, certificate_id, certificate_url, course_uuid')
      .eq('id', enrollmentId)
      .maybeSingle()

    console.log('[certificate/issue] Enrollment lookup:', { found: !!enrollment, error: enrollErr?.message })

    if (enrollErr || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    // Verify the enrollment belongs to the given course (using course_uuid from enrollment)
    const effectiveCourseId = enrollment.course_uuid || courseId

    console.log('[certificate/issue] Using effectiveCourseId:', effectiveCourseId)

    if (enrollment.payment_status !== 'paid') {
      return NextResponse.json({ issued: false, reason: 'not_paid' })
    }

    // Already issued — return immediately (idempotent)
    if (enrollment.certificate_id) {
      return NextResponse.json({
        issued:        true,
        alreadyIssued: true,
        certificateId: enrollment.certificate_id,
        pdfUrl:        enrollment.certificate_url,
      })
    }

    // ── Check completion ──────────────────────────────────────────────────
    const { count: totalLessons } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', effectiveCourseId)
      .eq('is_published', true)

    console.log('[certificate/issue] Total lessons:', totalLessons)

    const completedLessons: number[] = Array.isArray(enrollment.completed_lessons)
      ? enrollment.completed_lessons
      : []

    console.log('[certificate/issue] Completed:', completedLessons.length, '/', totalLessons)

    if (!totalLessons || completedLessons.length < totalLessons) {
      return NextResponse.json({
        issued:    false,
        reason:    'incomplete',
        completed: completedLessons.length,
        total:     totalLessons ?? 0,
      })
    }

    // ── Fetch course cert settings ───────────────────────────────────────
    console.log('[certificate/issue] Looking up course:', effectiveCourseId)
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, name, host_name, cert_enabled, cert_template, cert_custom_message')
      .eq('id', effectiveCourseId)
      .maybeSingle()

    console.log('[certificate/issue] Course lookup:', { found: !!course, error: courseErr?.message })

    if (!course) {
      return NextResponse.json({
        error: 'Course not found',
        debug: { effectiveCourseId, courseId, enrollmentCourseUuid: enrollment.course_uuid, courseErr: courseErr?.message }
      }, { status: 404 })
    }

    if (course.cert_enabled === false) {
      return NextResponse.json({ issued: false, reason: 'cert_disabled' })
    }

    // ── Resolve student name ─────────────────────────────────────────────
    let studentName = 'Student'
    if (enrollment.student_id) {
      const { data: student } = await supabase
        .from('students')
        .select('name, phone')
        .eq('id', enrollment.student_id)
        .maybeSingle()
      if (student?.name?.trim()) studentName = student.name.trim()
      else if (student?.phone) studentName = `Student ****${String(student.phone).slice(-4)}`
    }

    // ── Issue ─────────────────────────────────────────────────────────────
    const { certificateId, pdfUrl } = await issueCertificate(supabase, {
      enrollmentId,
      courseId: effectiveCourseId,
      studentId:     enrollment.student_id ?? null,
      studentName,
      courseName:    course.name,
      creatorName:   course.host_name || 'Creator',
      template:      (course.cert_template ?? 'classic') as CertTemplate,
      customMessage: course.cert_custom_message ?? undefined,
    })

    return NextResponse.json({ issued: true, certificateId, pdfUrl })

  } catch (err: any) {
    console.error('[certificate/issue]', err.message)
    return NextResponse.json({ error: 'Certificate generation failed', detail: err.message }, { status: 500 })
  }
}