/**
 * POST — upload an assignment file before or during submission.
 * Returns a public URL stored in assignments.submission_url.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  assignmentMimeForExt,
  assignmentStoragePath,
  sanitizeAssignmentFilename,
  validateAssignmentFile,
} from '@/lib/assignment-files'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUser(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file')
    const lessonId = String(form.get('lessonId') || '')
    const courseId = String(form.get('courseId') || '')
    const enrollmentId = String(form.get('enrollmentId') || '')

    if (!lessonId || !courseId || !enrollmentId) {
      return NextResponse.json({ error: 'lessonId, courseId and enrollmentId are required' }, { status: 400 })
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, student_id')
      .eq('id', enrollmentId)
      .eq('course_uuid', courseId)
      .maybeSingle()

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 403 })
    }

    // Verify this enrollment belongs to the signed-in student
    if (enrollment.student_id) {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (!student || student.id !== enrollment.student_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const phones = [user.user_metadata?.phone, user.phone, user.email].filter(Boolean) as string[]
      const { data: phoneEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('id', enrollmentId)
        .in('phone', phones)
        .maybeSingle()

      if (!phoneEnrollment) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const validation = validateAssignmentFile(file.name, file.type, file.size)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const storagePath = assignmentStoragePath(courseId, enrollmentId, lessonId, validation.ext)
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('lessons')
      .upload(storagePath, buffer, {
        contentType: assignmentMimeForExt(validation.ext),
        upsert: false,
      })

    if (uploadError) {
      console.error('[assignments/upload]', uploadError.message)
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('lessons').getPublicUrl(storagePath)

    return NextResponse.json({
      ok: true,
      submissionUrl: urlData.publicUrl,
      storagePath,
      filename: sanitizeAssignmentFilename(file.name),
    })
  } catch (err: any) {
    console.error('[assignments/upload]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
