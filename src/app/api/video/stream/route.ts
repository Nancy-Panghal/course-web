/**
 * app/api/video/stream/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Secure video proxy.
 * - Verifies signed URL (HMAC + expiry)
 * - Verifies enrollment in Supabase
 * - Fetches video from storage via short-lived signed URL (server only)
 * - Streams bytes to client — real storage URL NEVER reaches browser
 * - Supports HTTP range requests (required for video seeking)
 * - Sets anti-download headers
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyVideoUrl } from '@/lib/signer'
import { Redis } from '@upstash/redis'
import { isLessonFree } from '@/lib/freeLesson'
import { getWebAccessContext } from '@/lib/webAccess'
import { getR2SignedUrl } from '@/lib/r2'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // server only
)

// Redis-backed rate limiter — shared across all serverless instances,
// unlike an in-memory Map which resets per cold start / per instance.
const redis = Redis.fromEnv()

const RATE_WINDOW_SECONDS = 60   // 1 minute
const RATE_MAX = 40              // max chunk requests per minute per identity+lesson

async function isRateLimited(key: string): Promise<boolean> {
  const rateLimitKey = `videoratelimit:${key}`
  const count = await redis.incr(rateLimitKey)
  if (count === 1) {
    // First hit in this window — set the window to expire in 60s.
    await redis.expire(rateLimitKey, RATE_WINDOW_SECONDS)
  }
  return count > RATE_MAX
}

// ── Enrollment result cache (avoids 5 DB queries on every range request) ──
// Also Redis-backed now, for the same cross-instance-consistency reason.
const ENROLLMENT_CACHE_TTL_SECONDS = 5 * 60   // 5 minutes

async function getCachedEnrollment(key: string): Promise<boolean | null> {
  const value = await redis.get<boolean>(`enrollcache:${key}`)
  return value === null || value === undefined ? null : value
}

async function setCachedEnrollment(key: string, result: boolean): Promise<void> {
  await redis.set(`enrollcache:${key}`, result, { ex: ENROLLMENT_CACHE_TTL_SECONDS })
}

async function verifyEnrollment(
  lessonId: string,
  identity: string,
  req?: NextRequest
): Promise<boolean> {
  const cacheKey = `${lessonId}:${identity}`
  const cached = await getCachedEnrollment(cacheKey)
  if (cached !== null) return cached

  const { data: lesson } = await supabase
    .from('lessons')
    .select('course_id, order_num, is_free')
    .eq('id', lessonId)
    .single()

  if (!lesson) { await setCachedEnrollment(cacheKey, false); return false }

  const { data: course } = await supabase
    .from('courses')
    .select('is_free_course')
    .eq('id', lesson.course_id)
    .single()

  const isFree = isLessonFree(
    { is_free: lesson.is_free ?? false },
    { is_free_course: course?.is_free_course ?? false }
  )
  if (isFree) { await setCachedEnrollment(cacheKey, true); return true }

  if (identity === 'web') {
  const webAccess = req ? await getWebAccessContext(req) : null

  const allowed = webAccess?.courseId === lesson.course_id

  await setCachedEnrollment(cacheKey, allowed)
  return allowed
}

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
        .eq('course_uuid', lesson.course_id)
        .eq('payment_status', 'paid')
        .limit(1)
        .single()

      if (enrollment) { await setCachedEnrollment(cacheKey, true); return true }
    }

    if (student) {
      const identifiers: string[] = []
      if (student.phone) identifiers.push(student.phone)
      if (student.email) identifiers.push(student.email)

      if (identifiers.length > 0) {
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id')
          .eq('course_uuid', lesson.course_id)
          .eq('payment_status', 'paid')
          .in('phone', identifiers)
          .limit(1)
          .single()

        if (enrollment) { await setCachedEnrollment(cacheKey, true); return true }
      }
    }

    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(identity)
      if (user) {
        const phone = user.phone || user.user_metadata?.phone
        const email = user.email
        const fallbackIdentifiers = [phone, email].filter(Boolean) as string[]

        if (fallbackIdentifiers.length > 0) {
          const { data: enrollment } = await supabase
            .from('enrollments')
            .select('id')
            .eq('course_uuid', lesson.course_id)
            .eq('payment_status', 'paid')
            .in('phone', fallbackIdentifiers)
            .limit(1)
            .single()

          if (enrollment) { await setCachedEnrollment(cacheKey, true); return true }
        }
      }
    } catch (e) {
      console.warn('[verifyEnrollment] admin auth user lookup failed:', e)
    }

    await setCachedEnrollment(cacheKey, false)
    return false
  }

  // Raw phone number (WhatsApp) or Telegram chat ID — the signed link
  // never tags which channel it came from, and both are just numeric
  // strings, so check both columns rather than guessing from the shape.
  if (!/^[0-9]+$/.test(identity)) {
    await setCachedEnrollment(cacheKey, false)
    return false
  }

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('payment_status')
    .eq('course_uuid', lesson.course_id)
    .or(`phone.eq.${identity},telegram_chat_id.eq.${identity}`)
    .limit(1)
    .single()

  if (enrollment && enrollment.payment_status === 'paid') {
    await setCachedEnrollment(cacheKey, true)
    return true
  }

  await setCachedEnrollment(cacheKey, false)
  return false
}

async function getStorageUrl(lessonId: string): Promise<string | null> {
  const { data: lesson, error: lessonErr } = await supabase
    .from('lessons')
    .select('content_url, video_storage_path, is_published, content_type')
    .eq('id', lessonId)
    .single()

  if (lessonErr) {
    console.error('[video/stream] lesson lookup failed', lessonId, lessonErr.message)
    return null
  }
  if (!lesson) {
    console.error('[video/stream] no lesson row for id', lessonId)
    return null
  }
  if (!lesson.is_published) {
    console.error('[video/stream] lesson not published', lessonId)
    return null
  }
  if (lesson.content_type !== 'video' && !(lesson.content_type === 'live' && lesson.video_storage_path)) {
    console.error('[video/stream] content_type is not "video" and no protected live recording, got:', JSON.stringify(lesson.content_type), lessonId)
    return null
  }

    const path = lesson.video_storage_path
  console.error('[video/stream] resolving', lessonId, '| video_storage_path:', path, '| content_url:', lesson.content_url)

  if (path && !path.startsWith('http')) {
    const signedUrl = await getR2SignedUrl(path, 60) // 60s — server only, never sent to client
    if (!signedUrl) {
      console.error('[video/stream] R2 signed URL failed for key', JSON.stringify(path))
      return null
    }
    return signedUrl
  }

  if (!lesson.content_url) {
    console.error('[video/stream] no video_storage_path AND no content_url set', lessonId)
  }
  return lesson.content_url || null
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  // 1. Verify signature + expiry
  const { valid, lessonId, identity } = verifyVideoUrl(params)
  if (!valid) {
    return new NextResponse('Link expired or invalid', { status: 401 })
  }

    // 2. Rate limit
  if (await isRateLimited(`${lessonId}:${identity}`)) {
    return new NextResponse('Too many requests', { status: 429 })
  }

  // 3. Enrollment check
  const allowed = await verifyEnrollment(lessonId, identity, req)
  if (!allowed) {
    return new NextResponse('Not enrolled', { status: 403 })
  }

  // 4. Get storage URL (server side, never exposed to client)
  const storageUrl = await getStorageUrl(lessonId)
  if (!storageUrl) {
    return new NextResponse('Video not found', { status: 404 })
  }

  // 5. Forward range header for seeking support
  const rangeHeader = req.headers.get('range')
  const upstreamHeaders: Record<string, string> = {
    'User-Agent': 'Kurso-Proxy/1.0',
  }
  if (rangeHeader) upstreamHeaders['Range'] = rangeHeader

  // 6. Fetch from storage
  let upstream: Response
  try {
    upstream = await fetch(storageUrl, { headers: upstreamHeaders })
  } catch {
    return new NextResponse('Storage fetch failed', { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse('Storage error', { status: 502 })
  }

  // 7. Build response headers — anti-download
  const responseHeaders = new Headers()
  responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  responseHeaders.set('Pragma', 'no-cache')
  responseHeaders.set('Content-Disposition', 'inline')
  responseHeaders.set('X-Content-Type-Options', 'nosniff')

  // Forward only safe headers
  const forwardHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges']
  forwardHeaders.forEach(h => {
    const v = upstream.headers.get(h)
    if (v) responseHeaders.set(h, v)
  })

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const maxDuration = 60