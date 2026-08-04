/**
 * src/lib/qaIdentity.ts
 * ─────────────────────────────────────────────────────────────────
 * Shared identity resolution for lesson Q&A API routes. A request can
 * come from:
 *  - A logged-in web session (Authorization: Bearer <supabase token>) —
 *    resolves to either the course's creator, or a student's enrollment.
 *  - A bot-referred, non-logged-in student (WhatsApp/Telegram) — resolves
 *    from a client-supplied `enrollmentId`, trusted the same way
 *    /api/lesson/complete already trusts an enrollmentId handed to the
 *    client after /api/resource/resolve verified a signed link. This
 *    matches the app's existing trust boundary rather than inventing a
 *    stricter one just for this feature.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type QaIdentity =
  | { kind: 'creator'; creatorId: string }
  | { kind: 'student'; enrollmentId: string }

export async function resolveQaIdentity(
  req: NextRequest,
  courseId: string,
  bodyEnrollmentId?: string | null
): Promise<QaIdentity | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (token) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (user) {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('creator_id')
        .eq('id', courseId)
        .single()

      if (course?.creator_id === user.id) {
        return { kind: 'creator', creatorId: user.id }
      }

      const { data: student } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('auth_id', user.id)
        .limit(1)
        .single()

      const { data: enrollment } = student?.id ? await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('student_id', student.id)
        .eq('course_uuid', courseId)
        .limit(1)
        .single() : { data: null }

      return enrollment?.id ? { kind: 'student', enrollmentId: enrollment.id } : null
    }
  }

  if (bodyEnrollmentId) {
    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .eq('id', bodyEnrollmentId)
      .eq('course_uuid', courseId)
      .single()

    if (enrollment?.id) return { kind: 'student', enrollmentId: enrollment.id }
  }

  return null
}

/** Resolves just the creator's auth id from a request — used by the
 * moderation dashboard routes, which are always web/logged-in only. */
export async function resolveCreatorId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user?.id || null
}