import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function getWebAccessContext(req: NextRequest) {
  const rawSession = req.cookies.get('kurso_web_session')?.value
  if (!rawSession) return null

  const sessionHash = hashToken(rawSession)

  const { data: access } = await supabase
    .from('web_bootstrap_tokens')
    .select('id, course_id, enrollment_id, student_id, channel, session_expires_at')
    .eq('session_token_hash', sessionHash)
    .gt('session_expires_at', new Date().toISOString())
    .not('used_at', 'is', null)
    .maybeSingle()

  if (!access) return null

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('*')
    .eq('id', access.enrollment_id)
    .eq('course_uuid', access.course_id)
    .eq('payment_status', 'paid')
    .maybeSingle()

  if (!enrollment) return null

  return {
    access,
    enrollment,
    courseId: access.course_id,
  }
}