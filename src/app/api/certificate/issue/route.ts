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

    if (!enrollmentId || !courseId) {
      return NextResponse.json({ error: 'enrollmentId and courseId are required' }, { status: 400 })
    }

    // ── Fetch enrollment ─────────────────────────────────────────────────────
    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .select('id, student_id, completed_lessons, payment_status, certificate_id, certificate_url')
      .eq('id', enrollmentId)
      .eq('course_uuid', courseId)
      .maybeSingle()

    if (enrollErr || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

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

    // ── Check completion ─────────────────────────────────────────────────────
    const { count: totalLessons } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId)
      .eq('is_published', true)

    const completedLessons: number[] = Array.isArray(enrollment.completed_lessons)
      ? enrollment.completed_lessons
      : []

    if (!totalLessons || completedLessons.length < totalLessons) {
      return NextResponse.json({
        issued:    false,
        reason:    'incomplete',
        completed: completedLessons.length,
        total:     totalLessons ?? 0,
      })
    }

    // ── Fetch course cert settings ───────────────────────────────────────────
    const { data: course } = await supabase
      .from('courses')
      .select('name, host_name, cert_enabled, cert_template, cert_custom_message')
      .eq('id', courseId)
      .maybeSingle()

    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

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
