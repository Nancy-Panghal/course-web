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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // server only
)

// In-memory rate limiter (swap for Redis/Upstash in production)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()
const RATE_WINDOW = 60_000   // 1 minute
const RATE_MAX    = 40       // max chunk requests per minute per identity+lesson

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



// ── Enrollment result cache (avoids 5 DB queries on every range request) ──
const enrollmentCache = new Map<string, { result: boolean; expiresAt: number }>()

function getCachedEnrollment(key: string): boolean | null {
  const entry = enrollmentCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { enrollmentCache.delete(key); return null }
  return entry.result
}

function setCachedEnrollment(key: string, result: boolean) {
  enrollmentCache.set(key, { result, expiresAt: Date.now() + 5 * 60 * 1000 })
}

async function verifyEnrollment(lessonId: string, identity: string): Promise<boolean> {
  const cacheKey = `${lessonId}:${identity}`
  const cached = getCachedEnrollment(cacheKey)
  if (cached !== null) return cached

  const { data: lesson } = await supabase
    .from('lessons')
    .select('course_id, order_num')
    .eq('id', lessonId)
    .single()

  if (!lesson) { setCachedEnrollment(cacheKey, false); return false }

  const { data: course } = await supabase
    .from('courses')
    .select('free_preview_config')
    .eq('id', lesson.course_id)
    .single()

  const config = course?.free_preview_config || 'nothing free'
  const maxFree: Record<string, number> = {
    'lesson 1 free': 1, '2 lessons free': 2, '3 lessons free': 3,
    'module 1 free': 3, '2 modules free': 6,
  }
  const isFree = config === 'completely free' || lesson.order_num <= (maxFree[config] ?? 0)
  if (isFree) { setCachedEnrollment(cacheKey, true); return true }

  if (identity === 'web') { setCachedEnrollment(cacheKey, false); return false }

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

      if (enrollment) { setCachedEnrollment(cacheKey, true); return true }
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

        if (enrollment) { setCachedEnrollment(cacheKey, true); return true }
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

          if (enrollment) { setCachedEnrollment(cacheKey, true); return true }
        }
      }
    } catch (e) {
      console.warn('[verifyEnrollment] admin auth user lookup failed:', e)
    }

    setCachedEnrollment(cacheKey, false)
    return false
  }

  // Telegram chat ID path
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('payment_status')
    .eq('telegram_chat_id', identity)
    .eq('course_uuid', lesson.course_id)
    .limit(1)
    .single()

  if (enrollment && enrollment.payment_status === 'paid') {
    setCachedEnrollment(cacheKey, true)
    return true
  }

  setCachedEnrollment(cacheKey, false)
  return false
}

async function getStorageUrl(lessonId: string): Promise<string | null> {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('content_url, video_storage_path, is_published, content_type')
    .eq('id', lessonId)
    .single()

  if (!lesson || !lesson.is_published || lesson.content_type !== 'video') return null

  const path = lesson.video_storage_path
  if (path && !path.startsWith('http')) {
    const { data, error } = await supabase.storage
      .from('lessons')
      .createSignedUrl(path, 60) // 60s — server only, never sent to client
    if (error || !data?.signedUrl) return null
    return data.signedUrl
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
  if (isRateLimited(`${lessonId}:${identity}`)) {
    return new NextResponse('Too many requests', { status: 429 })
  }

  // 3. Enrollment check
  const allowed = await verifyEnrollment(lessonId, identity)
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
    'User-Agent': 'AcademyKit-Proxy/1.0',
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