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
    const { enrollmentId, courseId, studentName } = body

    console.log('[certificate/issue] Request received:', { enrollmentId, courseId, studentName })

    if (!enrollmentId || !courseId) {
      return NextResponse.json({ error: 'enrollmentId and courseId are required' }, { status: 400 })
    }

    // ── Fetch enrollment (only match on enrollmentId, courseId check is secondary) ──
    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .select('id, student_id, completed_lessons, payment_status, certificate_id, certificate_url, course_uuid, certificate_student_name')
      .eq('id', enrollmentId)
      .maybeSingle()

    console.log('[certificate/issue] Enrollment lookup:', { found: !!enrollment, error: enrollErr?.message })

    if (enrollErr || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    // Verify the enrollment belongs to the given course (using course_uuid from enrollment)
    const effectiveCourseId = enrollment.course_uuid || courseId

    console.log('[certificate/issue] Using effectiveCourseId:', effectiveCourseId)

    // Allow paid OR completely-free enrollments
    if (enrollment.payment_status !== 'paid' && enrollment.payment_status !== 'completely free') {
      return NextResponse.json({ issued: false, reason: 'not_paid' })
    }

    // ── Resolve the planned lesson total from courses.total_lessons ───────
    const { data: courseForCount } = await supabase
      .from('courses')
      .select('total_lessons')
      .eq('id', enrollment.course_uuid)
      .maybeSingle()

    // Also fetch all published lessons so we can check the last lesson is done
    const { data: publishedLessons, count: publishedCount } = await supabase
      .from('lessons')
      .select('order_num', { count: 'exact' })
      .eq('course_id', enrollment.course_uuid)
      .eq('is_published', true)
      .order('order_num', { ascending: true })

    // Use creator's planned total as the hard gate; fall back to published count
    const plannedTotal: number = (courseForCount?.total_lessons && courseForCount.total_lessons > 0)
      ? courseForCount.total_lessons
      : (publishedCount ?? 0)

    console.log('[certificate/issue] Total lessons (planned):', plannedTotal)

    const completedLessons: number[] = Array.isArray(enrollment.completed_lessons)
      ? enrollment.completed_lessons
      : []

    console.log('[certificate/issue] Completed:', completedLessons.length, '/', plannedTotal)

    // Must have completed at least every planned lesson
    if (plannedTotal === 0 || completedLessons.length < plannedTotal) {
      return NextResponse.json({
        issued: false,
        reason: 'incomplete',
        completed: completedLessons.length,
        total: plannedTotal,
      })
    }

    // Must have the last published lesson explicitly marked complete (anti-cheat)
    const lastPublishedOrderNum = publishedLessons?.length
      ? Math.max(...publishedLessons.map((l: any) => l.order_num))
      : null

    if (lastPublishedOrderNum !== null && !completedLessons.includes(lastPublishedOrderNum)) {
      return NextResponse.json({
        issued: false,
        reason: 'last_lesson_not_completed',
        message: 'Please complete the final lesson before claiming your certificate.',
        lastLesson: lastPublishedOrderNum,
        completedLessons,
      })
    }

    // ── Fetch course cert settings ───────────────────────────────────────
    console.log('[certificate/issue] Looking up course:', effectiveCourseId)
    // Use the enrollment's own course_uuid as the authoritative course ID
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, name, host_name, cert_enabled, cert_template, cert_custom_message, duration, total_hours, skills, instructor_name, instructor_title, cert_logo_url, cert_signature_url, brand_logo_url, use_logo_on_certificate')
      .eq('id', enrollment.course_uuid)
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
    let finalStudentName = 'Student'

    // Use provided studentName from request if available
    if (studentName && studentName.trim()) {
      finalStudentName = studentName.trim()
    } else if (enrollment.certificate_student_name?.trim()) {
      finalStudentName = enrollment.certificate_student_name.trim()
    } else if (enrollment.student_id) {
      // Fallback to database lookup
      const { data: student } = await supabase
        .from('students')
        .select('name, phone')
        .eq('id', enrollment.student_id)
        .maybeSingle()
      if (student?.name?.trim()) finalStudentName = student.name.trim()
      else if (student?.phone) finalStudentName = `Student ****${String(student.phone).slice(-4)}`
    }

    // ── Issue ─────────────────────────────────────────────────────────────
    const { certificateId, pdfUrl } = await issueCertificate(supabase, {
      enrollmentId,
      courseId: effectiveCourseId,
      studentId: enrollment.student_id ?? null,
      studentName: finalStudentName,
      courseName: course.name,
      creatorName: course.host_name || 'Creator',
      template: (course.cert_template ?? 'classic') as CertTemplate,
      customMessage: course.cert_custom_message ?? undefined,
      courseDuration: course.duration,
      instructorName: course.instructor_name,
      instructorTitle: course.instructor_title,
      skills: course.skills,
      // Shared brand logo wins when the creator has switched the toggle on
      // (Settings → Certificate → "Use Brand Logo on Certificate"); otherwise
      // fall back to the legacy cert-specific logo for courses set up before
      // the brand logo / Design Landing Page feature existed.
      logoUrl: course.use_logo_on_certificate
        ? (course.brand_logo_url || undefined)
        : (course.cert_logo_url || undefined),
      signatureUrl: course.cert_signature_url || undefined
    })
    

    return NextResponse.json({ issued: true, certificateId, pdfUrl })

  } catch (err: any) {
    console.error('[certificate/issue]', err.message)
    return NextResponse.json({ error: 'Certificate generation failed', detail: err.message }, { status: 500 })
  }
}