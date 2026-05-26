/**
 * src/lib/enrollments.ts
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for enrollment lookups.
 * Tries every possible identifier so a paid student is NEVER shown
 * the enroll button again regardless of how they signed up.
 * ─────────────────────────────────────────────────────────────────
 */

import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

type EnrollmentLookupOptions = {
  courseId: string
  user?: User | null
  phone?: string | null
  telegramChatId?: string | null
  select?: string
}

function dedup(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map(v => v?.trim()).filter((v): v is string => Boolean(v)))]
}

async function firstRow(query: any): Promise<any | null> {
  const { data, error } = await query.limit(1)
  if (error) {
    console.warn('[enrollments] lookup error:', error.message)
    return null
  }
  return data?.[0] ?? null
}

/**
 * Find the student row for a given auth user.
 * Tries auth_id first (fastest), falls back to email.
 */
async function findStudentId(user: User): Promise<string | null> {
  const byAuth = await firstRow(
    supabase.from('students').select('id').eq('auth_id', user.id)
  )
  if (byAuth?.id) return byAuth.id

  if (!user.email) return null

  const byEmail = await firstRow(
    supabase.from('students').select('id').eq('email', user.email)
  )
  return byEmail?.id ?? null
}

/**
 * Find a PAID enrollment for this course using every possible identifier.
 * Order: student_id → auth_id direct → phone → email → telegram_chat_id
 *
 * This is the authoritative check used by:
 *  - CoursePageClient (show enroll vs continue button)
 *  - EnrollModal (redirect if already enrolled)
 *  - Web lesson page (grant access)
 *  - Payment verify route (confirm enrollment was created)
 */
export async function findPaidEnrollment({
  courseId,
  user,
  phone,
  telegramChatId,
  select = '*',
}: EnrollmentLookupOptions): Promise<any | null> {
  const base = supabase
    .from('enrollments')
    .select(select)
    .eq('course_uuid', courseId)
    .eq('payment_status', 'paid')
    .order('enrolled_at', { ascending: false })

  // 1. By student_id (most reliable for web users)
  if (user) {
    const studentId = await findStudentId(user)
    if (studentId) {
      const row = await firstRow(base.eq('student_id', studentId))
      if (row) return row
    }

    // 2. By auth_id stored directly on enrollment (legacy path)
    // Some older enrollments may have been created before students table was used
    const byAuthId = await firstRow(
      supabase
        .from('enrollments')
        .select(select)
        .eq('course_uuid', courseId)
        .eq('payment_status', 'paid')
        .eq('phone', user.email ?? '')  // edge case: email used as phone key
        .order('enrolled_at', { ascending: false })
    )
    if (byAuthId) return byAuthId
  }

  // 3. By phone (works for both web and Telegram enrollments)
  const phones = dedup([phone, user?.user_metadata?.phone, user?.phone])
  for (const p of phones) {
    const row = await firstRow(base.eq('phone', p))
    if (row) return row
  }

  // 4. By email used as phone field (happens when WhatsApp delivery used email)
  if (user?.email) {
    const row = await firstRow(base.eq('phone', user.email))
    if (row) return row
  }

  // 5. By telegram_chat_id (student enrolled via Telegram first)
  if (telegramChatId) {
    const row = await firstRow(
      supabase
        .from('enrollments')
        .select(select)
        .eq('course_uuid', courseId)
        .eq('payment_status', 'paid')
        .eq('telegram_chat_id', telegramChatId)
        .order('enrolled_at', { ascending: false })
    )
    if (row) return row
  }

  return null
}

/**
 * Check if a phone number already has a paid enrollment for a course.
 * Used during signup to prevent duplicate enrollments.
 */
export async function findPaidEnrollmentByPhone(
  courseId: string,
  phone: string,
  select = 'id'
): Promise<any | null> {
  return firstRow(
    supabase
      .from('enrollments')
      .select(select)
      .eq('course_uuid', courseId)
      .eq('phone', phone)
      .eq('payment_status', 'paid')
      .order('enrolled_at', { ascending: false })
  )
}

/**
 * Sync the student_id onto an enrollment that was created by the Telegram bot
 * (which only has telegram_chat_id + phone, no student_id).
 * Called after web login when we can identify the student.
 */
export async function linkStudentToEnrollment(
  enrollmentId: string,
  studentId: string
): Promise<void> {
  await supabase
    .from('enrollments')
    .update({ student_id: studentId })
    .eq('id', enrollmentId)
    .is('student_id', null) // only update if not already linked
}