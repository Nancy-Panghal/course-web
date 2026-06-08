/**
 * POST /api/certificate/issue
 * ─────────────────────────────────────────────────────────────────────────────
 * On-demand certificate issue endpoint.
 * The lesson/complete route calls issueCertificate() directly (faster),
 * but this endpoint exists as a fallback — e.g. if a student reloads My Courses
 * and their cert was never generated, the frontend can call this to trigger it.
 *
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
    const { enrollmentId, courseId } = await req.json()
    
    console.log('[certificate/issue] Request received:', { enrollmentId, courseId })

    if (!enrollmentId || !courseId) {
      console.error('[certificate/issue] Missing required fields:', { enrollmentId, courseId })
      return NextResponse.json({ error: 'enrollmentId and courseId are required' }, { status: 400 })
    }

    // ── Fetch enrollment ─────────────────────────────────────────────────────
    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .select('id, student_id, completed_lessons, payment_status, certificate_id, certificate_url')
      .eq('id', enrollmentId)
      .eq('course_uuid', courseId)
      .maybeSingle()

    console.log('[certificate/issue] Enrollment lookup:', { enrollmentId, courseId, found: !!enrollment, error: enrollErr?.message })

    if (enrollErr || !enrollment) {
      console.error('[certificate/issue] Enrollment not found:', enrollErr?.message)
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    console.log('[certificate/issue] Enrollment found:', { payment_status: enrollment.payment_status, has_cert: !!enrollment.certificate_id })

    if (enrollment.payment_status !== 'paid') {
      console.log('[certificate/issue] Payment not completed:', enrollment.payment_status)
      return NextResponse.json({ issued: false, reason: 'not_paid' })
    }

    // Already issued — return immediately (idempotent)
    if (enrollment.certificate_id) {
      console.log('[certificate/issue] Certificate already issued')
      return NextResponse.json({
        issued:        true,
        alreadyIssued: true,
        certificateId: enrollment.certificate_id,
        pdfUrl:        enrollment.certificate_url,
      })
    }

    // ── Check completion ─────────────────────────────────────────────────────
    console.log('[certificate/issue] Checking completion with course_id:', courseId)
    const { count: totalLessons } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .eq('is_published', true)

    console.log('[certificate/issue] Total lessons found:', totalLessons)

    const completedLessons: number[] = Array.isArray(enrollment.completed_lessons)
      ? enrollment.completed_lessons
      : []

    console.log('[certificate/issue] Completed lessons:', completedLessons.length, '/', totalLessons)

    if (!totalLessons || completedLessons.length < totalLessons) {
      console.log('[certificate/issue] Course not complete')
      return NextResponse.json({
        issued:    false,
        reason:    'incomplete',
        completed: completedLessons.length,
        total:     totalLessons ?? 0,
      })
    }

    // ── Fetch course cert settings ───────────────────────────────────────────
    console.log('[certificate/issue] Looking up course with id:', courseId)
    let { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, name, host_name, cert_enabled, cert_template, cert_custom_message')
      .eq('id', courseId)
      .maybeSingle()
    
    console.log('[certificate/issue] Course lookup result:', { found: !!course, error: courseErr?.message, course_id: course?.id })

    // Fallback: try looking up by uuid if id didn't work
    if (!course && courseErr) {
      console.log('[certificate/issue] First lookup failed, trying alternate column name (uuid)')
      const { data: altCourse } = await supabase
        .from('courses')
        .select('id, uuid, name, host_name, cert_enabled, cert_template, cert_custom_message')
        .eq('uuid', courseId)
        .maybeSingle()
      if (altCourse) {
        console.log('[certificate/issue] Found course using uuid column')
        course = altCourse
      }
    }
    
    if (!course) return NextResponse.json({ error: 'Course not found', debug: { courseId, courseErr: courseErr?.message } }, { status: 404 })

    if (course.cert_enabled === false) {
      return NextResponse.json({ issued: false, reason: 'cert_disabled' })
    }

    // ── Resolve student name ─────────────────────────────────────────────────
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

    // ── Issue ────────────────────────────────────────────────────────────────
    const { certificateId, pdfUrl } = await issueCertificate(supabase, {
      enrollmentId,
      courseId,
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
    return NextResponse.json({ error: 'Certificate generation failed' }, { status: 500 })
  }
}
