/**
 * POST /api/certificate/issue
 * Fully idempotent: safe to call multiple times for the same enrollment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { issueCertificate, type CertTemplate } from '@/lib/certificate'
import { getWebAccessContext } from '@/lib/webAccess'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const webAccess = await getWebAccessContext(req)

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

if (enrollment.course_uuid !== courseId) {
  return NextResponse.json({ error: 'Course mismatch' }, { status: 403 })
}

if (webAccess) {
  if (
    webAccess.courseId !== courseId ||
    webAccess.enrollment.id !== enrollment.id ||
    enrollment.payment_status !== 'paid'
  ) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
}

const effectiveCourseId = enrollment.course_uuid

    console.log('[certificate/issue] Using effectiveCourseId:', effectiveCourseId)

    // Allow paid OR completely-free enrollments
    if (enrollment.payment_status !== 'paid' && enrollment.payment_status !== 'completely free') {
      return NextResponse.json({ issued: false, reason: 'not_paid' })
    }

           // Fetch all published lessons — this is the baseline "course length" now
    // that manual total_lessons overrides are gone.
    const { data: publishedLessons, count: publishedCount } = await supabase
      .from('lessons')
      .select('order_num', { count: 'exact' })
      .eq('course_id', enrollment.course_uuid)
      .eq('is_published', true)
      .order('order_num', { ascending: true })

    // A creator-marked "last lesson" overrides everything else when set.
    const { data: lastLessonRow } = await supabase
      .from('lessons')
      .select('order_num')
      .eq('course_id', enrollment.course_uuid)
      .eq('is_last_lesson', true)
      .maybeSingle()

    const completedLessons: number[] = Array.isArray(enrollment.completed_lessons)
      ? enrollment.completed_lessons
      : []

    const plannedTotal: number = lastLessonRow ? lastLessonRow.order_num : (publishedCount ?? 0)
    const isComplete = lastLessonRow
      ? completedLessons.includes(lastLessonRow.order_num)
      : (plannedTotal > 0 && completedLessons.length >= plannedTotal)

    console.log('[certificate/issue] Total lessons:', plannedTotal, lastLessonRow ? '(via marked last lesson)' : '')
    console.log('[certificate/issue] Completed:', completedLessons.length, '/', plannedTotal)

    if (!isComplete) {
      return NextResponse.json({
        issued: false,
        reason: 'incomplete',
        completed: completedLessons.length,
        total: plannedTotal,
      })
    }

    // Anti-cheat: the gating lesson must be explicitly marked complete.
    // When a last lesson is marked, THAT lesson is the gate — extra lessons
    // published afterward (bonus content, etc.) don't block the certificate.
    // Otherwise, fall back to the actual last published lesson, as before.
    const requiredLastLesson = lastLessonRow
      ? lastLessonRow.order_num
      : (publishedLessons?.length ? Math.max(...publishedLessons.map((l: any) => l.order_num)) : null)

    if (requiredLastLesson !== null && !completedLessons.includes(requiredLastLesson)) {
      return NextResponse.json({
        issued: false,
        reason: 'last_lesson_not_completed',
        message: 'Please complete the final lesson before claiming your certificate.',
        lastLesson: requiredLastLesson,
        completedLessons,
      })
    }

    // ── Fetch course cert settings ───────────────────────────────────────
    console.log('[certificate/issue] Looking up course:', effectiveCourseId)
    // Use the enrollment's own course_uuid as the authoritative course ID
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, name, host_name, cert_enabled, cert_template, cert_palette, cert_custom_message, duration, total_hours, skills, instructor_name, instructor_title, cert_logo_url, cert_signature_url, brand_logo_url, use_logo_on_certificate')
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
      paletteId: course.cert_palette ?? 'classic-gold',
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
