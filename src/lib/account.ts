import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AccountType = 'creator' | 'student' | 'unknown'

/**
 * Resolve whether the signed-in user is a course creator or a student.
 * Role metadata is preferred; enrollments / courses are used as fallback.
 */
export async function resolveAccountType(user: User): Promise<AccountType> {
  const role = user.user_metadata?.role
  if (role === 'creator') return 'creator'
  if (role === 'student') return 'student'

  const { count: courseCount } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', user.id)

  if (courseCount && courseCount > 0) return 'creator'

  const { data: studentRow } = await supabase
    .from('students')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (studentRow?.id) {
    const { count } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentRow.id)

    if (count && count > 0) return 'student'
  }

  const phones = [user.user_metadata?.phone, user.phone].filter(Boolean) as string[]
  for (const phone of phones) {
    const { count } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)

    if (count && count > 0) return 'student'
  }

  if (user.email) {
    const { count } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('phone', user.email)

    if (count && count > 0) return 'student'
  }

  const { data: creatorRow } = await supabase
    .from('creators')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (creatorRow) return 'creator'

  return 'unknown'
}

const STUDENT_PREFIXES = ['/my-courses', '/course/', '/learn/', '/c/']

function isStudentPath(path: string) {
  return STUDENT_PREFIXES.some(prefix => path.startsWith(prefix))
}

/**
 * Safe post-login redirect — students never land on creator dashboard.
 */
export async function resolvePostLoginRedirect(user: User, requested?: string | null): Promise<string> {
  const type = await resolveAccountType(user)
  const req = (requested || '').trim()

  if (type === 'student') {
    if (req && isStudentPath(req)) return req
    return '/my-courses'
  }

  if (type === 'creator') {
    if (req && req.startsWith('/dashboard')) return req
    return '/dashboard'
  }

  if (req && (isStudentPath(req) || req.startsWith('/dashboard'))) return req
  return '/my-courses'
}
