/**
 * app/api/live-session-video/stream/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Secure proxy for `live_sessions.recording_storage_path` — the
 * counterpart to /api/video/stream, but for the separate live_sessions
 * table (scheduled live classes) rather than `lessons`.
 * - Verifies signed URL (HMAC + expiry) via verifyLiveSessionVideoUrl
 * - Verifies the caller has a PAID enrollment in the session's course
 * - Fetches the recording from storage via a short-lived signed URL
 *   (server only) and streams bytes to the client — the real storage
 *   URL never reaches the browser
 * - Supports HTTP range requests (required for seeking)
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLiveSessionVideoUrl } from '@/lib/signer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const rateLimitMap = new Map<string, { count: number; windowStart: number }>()
const RATE_WINDOW = 60_000
const RATE_MAX = 40

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key) ?? { count: 0, windowStart: now }
  if (now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(key, { count: 1, windowStart: now })
    return false
  }
  entry.count++
  rateLimitMap.set(key, entry)
  return entry.count > RATE_MAX
}

async function verifyEnrollment(courseId: string, identity: string): Promise<boolean> {
  if (identity === 'web') return false

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity)

  if (isUuid) {
    const { data: student } = await supabase
      .from('students')
      .select('id, email, phone')
      .eq('auth_id', identity)
      .limit(1)
      .single()

    if (student?.id) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', student.id)
        .eq('course_uuid', courseId)
        .eq('payment_status', 'paid')
        .limit(1)
        .single()
      if (enrollment) return true
    }

    const identifiers: string[] = []
    if (student?.phone) identifiers.push(student.phone)
    if (student?.email) identifiers.push(student.email)

    if (identifiers.length === 0) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(identity)
        if (user?.phone) identifiers.push(user.phone)
        if (user?.email) identifiers.push(user.email)
        if (user?.user_metadata?.phone) identifiers.push(user.user_metadata.phone)
      } catch { /* fall through */ }
    }

    if (identifiers.length === 0) return false

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_uuid', courseId)
      .eq('payment_status', 'paid')
      .in('phone', identifiers)
      .limit(1)
      .single()

    return !!enrollment
  }

  // Raw phone (WhatsApp) or Telegram chat ID
  if (!/^[0-9]+$/.test(identity)) return false

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('payment_status')
    .eq('course_uuid', courseId)
    .or(`phone.eq.${identity},telegram_chat_id.eq.${identity}`)
    .limit(1)
    .single()

  return !!enrollment && enrollment.payment_status === 'paid'
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const { valid, sessionId, identity } = verifyLiveSessionVideoUrl(params)
  if (!valid) {
    return new NextResponse('Link expired or invalid', { status: 401 })
  }

  if (isRateLimited(`${sessionId}:${identity}`)) {
    return new NextResponse('Too many requests', { status: 429 })
  }

  const { data: session } = await supabase
    .from('live_sessions')
    .select('course_id, recording_storage_path')
    .eq('id', sessionId)
    .single()

  if (!session) return new NextResponse('Session not found', { status: 404 })
  if (!session.recording_storage_path) return new NextResponse('Recording not found', { status: 404 })

  const allowed = await verifyEnrollment(session.course_id, identity)
  if (!allowed) return new NextResponse('Not enrolled', { status: 403 })

  const { data: signed, error } = await supabase.storage
    .from('lessons')
    .createSignedUrl(session.recording_storage_path, 60)

  if (error || !signed?.signedUrl) {
    return new NextResponse('Storage error', { status: 502 })
  }

  const rangeHeader = req.headers.get('range')
  const upstreamHeaders: Record<string, string> = { 'User-Agent': 'Kurso-Proxy/1.0' }
  if (rangeHeader) upstreamHeaders['Range'] = rangeHeader

  let upstream: Response
  try {
    upstream = await fetch(signed.signedUrl, { headers: upstreamHeaders })
  } catch {
    return new NextResponse('Storage fetch failed', { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse('Storage error', { status: 502 })
  }

  const responseHeaders = new Headers()
  responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  responseHeaders.set('Pragma', 'no-cache')
  responseHeaders.set('Content-Disposition', 'inline')
  responseHeaders.set('X-Content-Type-Options', 'nosniff')

  const forwardHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges']
  forwardHeaders.forEach(h => {
    const v = upstream.headers.get(h)
    if (v) responseHeaders.set(h, v)
  })

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders })
}

export const maxDuration = 60