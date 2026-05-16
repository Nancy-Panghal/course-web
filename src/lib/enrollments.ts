import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

type EnrollmentLookupOptions = {
  courseId: string
  user?: User | null
  phone?: string | null
  select?: string
}

function uniq(values: Array<string | null | undefined>) {
  return [...new Set(values.map(v => v?.trim()).filter(Boolean) as string[])]
}

async function firstEnrollment(query: any) {
  const { data, error } = await query.limit(1)
  if (error) {
    console.warn('Enrollment lookup failed:', error.message)
    return null
  }
  return data?.[0] || null
}

async function findStudentId(user: User) {
  const { data: byAuth } = await supabase
    .from('students')
    .select('id')
    .eq('auth_id', user.id)
    .limit(1)

  if (byAuth?.[0]?.id) return byAuth[0].id

  if (!user.email) return null

  const { data: byEmail } = await supabase
    .from('students')
    .select('id')
    .eq('email', user.email)
    .limit(1)

  return byEmail?.[0]?.id || null
}

export async function findPaidEnrollment({
  courseId,
  user,
  phone,
  select = '*',
}: EnrollmentLookupOptions) {
  const studentId = user ? await findStudentId(user) : null

  for (const id of uniq([studentId, user?.id])) {
    const enrollment = await firstEnrollment(
      supabase
        .from('enrollments')
        .select(select)
        .eq('course_uuid', courseId)
        .eq('payment_status', 'paid')
        .eq('student_id', id)
        .order('enrolled_at', { ascending: false })
    )

    if (enrollment) return enrollment
  }

  for (const identifier of uniq([phone, user?.user_metadata?.phone, user?.email])) {
    const enrollment = await firstEnrollment(
      supabase
        .from('enrollments')
        .select(select)
        .eq('course_uuid', courseId)
        .eq('payment_status', 'paid')
        .eq('phone', identifier)
        .order('enrolled_at', { ascending: false })
    )

    if (enrollment) return enrollment
  }

  return null
}

export async function findPaidEnrollmentByPhone(courseId: string, phone: string, select = 'id') {
  return firstEnrollment(
    supabase
      .from('enrollments')
      .select(select)
      .eq('course_uuid', courseId)
      .eq('phone', phone)
      .eq('payment_status', 'paid')
      .order('enrolled_at', { ascending: false })
  )
}
