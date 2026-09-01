/**
 * lib/signer.ts
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for ALL signed/expiring URLs.
 * Used by: video proxy, PDF proxy, Telegram lesson links, web lesson links.
 *
 * NEVER import this in client components — server only.
 * ─────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto'

const SECRET = process.env.LESSON_LINK_SECRET
  || process.env.TELEGRAM_LINK_SECRET
  || process.env.WHATSAPP_LINK_SECRET
  || ''

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kurso.in').replace(/\/$/, '')

if (!SECRET && process.env.NODE_ENV === 'production') {
  console.error('[signer] LESSON_LINK_SECRET is not set — all signed URLs will fail verification')
}

// ── TTLs ───────────────────────────────────────────────────────────
export const TTL = {
  VIDEO: 15 * 60 * 1000,      // 15 min  — video stream (was 2h; safe to shorten now that WatermarkedPlayer refreshes + resumes silently)
  LIVE_SESSION_VIDEO: 15 * 60 * 1000, // 15 min — live session recording stream (same reasoning)
  
  LIVE_SESSION_RECORDING_PAGE: 90 * 24 * 60 * 60 * 1000, // 90 days — the link sent in the WhatsApp/Telegram message itself. Long-lived because a student may not open the message for days; the actual video-stream URL embedded inside the page is generated fresh, short-lived, at click time (see LIVE_SESSION_VIDEO above).
  PDF:   1 * 60 * 60 * 1000,      // 1 hour   — PDF view
  LESSON: 2 * 60 * 60 * 1000,     // 2 hours  — lesson page (from Telegram)
  RESOURCE: 2 * 60 * 60 * 1000,   // 2 hours  — notes, summary, quiz pages
  STORAGE: 60 * 1000,             // 60 sec   — Supabase signed URL (server-only)
}

// ── HMAC helper ────────────────────────────────────────────────────
function hmac(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

// ══════════════════════════════════════════════════════════════════
// VIDEO STREAM URL
// ══════════════════════════════════════════════════════════════════

export function signVideoUrl(lessonId: string, identity: string, ttl = TTL.VIDEO): string {
  const exp = Date.now() + ttl
  const payload = `video.${lessonId}.${identity}.${exp}`
  const sig = hmac(payload)
  const p = new URLSearchParams({ lessonId, identity, exp: String(exp), sig, t: 'v' })
  return `${BASE}/api/video/stream?${p}`
}

export function verifyVideoUrl(params: URLSearchParams): { valid: boolean; lessonId: string; identity: string } {
  const lessonId = params.get('lessonId') || ''
  const identity = params.get('identity') || ''
  const exp = params.get('exp') || ''
  const sig = params.get('sig') || ''

  if (!lessonId || !identity || !exp || !sig) return { valid: false, lessonId, identity }
  if (Date.now() > parseInt(exp, 10)) return { valid: false, lessonId, identity }

  const payload = `video.${lessonId}.${identity}.${exp}`
  const expected = hmac(payload)
  return { valid: timingSafeEqual(sig, expected), lessonId, identity }
}

// ══════════════════════════════════════════════════════════════════
// LIVE SESSION RECORDING STREAM URL
// Deliberately separate from signVideoUrl/verifyVideoUrl — the video
// proxy resolves storage by looking up the `lessons` table, and a
// live_sessions row is a different table entirely, so this uses its
// own payload namespace ("lsvideo.") to avoid a signature from one
// ever being replayable against the other's route.
// ══════════════════════════════════════════════════════════════════

export function signLiveSessionVideoUrl(sessionId: string, identity: string, ttl = TTL.LIVE_SESSION_VIDEO): string {
  const exp = Date.now() + ttl
  const payload = `lsvideo.${sessionId}.${identity}.${exp}`
  const sig = hmac(payload)
  const p = new URLSearchParams({ sessionId, identity, exp: String(exp), sig, t: 'lsv' })
  return `${BASE}/api/live-session-video/stream?${p}`
}

export function verifyLiveSessionVideoUrl(params: URLSearchParams): { valid: boolean; sessionId: string; identity: string } {
  const sessionId = params.get('sessionId') || ''
  const identity = params.get('identity') || ''
  const exp = params.get('exp') || ''
  const sig = params.get('sig') || ''

  if (!sessionId || !identity || !exp || !sig) return { valid: false, sessionId, identity }
  if (Date.now() > parseInt(exp, 10)) return { valid: false, sessionId, identity }

  const payload = `lsvideo.${sessionId}.${identity}.${exp}`
  const expected = hmac(payload)
  return { valid: timingSafeEqual(sig, expected), sessionId, identity }
}

// ══════════════════════════════════════════════════════════════════
// LIVE SESSION RECORDING PAGE URL
// This is the link actually sent in the WhatsApp/Telegram notification
// — long-lived (see TTL.LIVE_SESSION_RECORDING_PAGE above), points at a
// no-login wrapper page that resolves the current recording state
// (uploaded file / external link / not available yet) at click time,
// same pattern as signLessonPageUrl below.
// ══════════════════════════════════════════════════════════════════

export function signLiveSessionRecordingPageUrl(
  sessionId: string,
  identity: string,
  ttl = TTL.LIVE_SESSION_RECORDING_PAGE
): string {
  const exp = Date.now() + ttl
  const payload = `lsrecpage.${sessionId}.${identity}.${exp}`
  const sig = hmac(payload)
  const p = new URLSearchParams({ sessionId, identity, exp: String(exp), sig })
  return `${BASE}/api/live-session-recording?${p}`
}

export function verifyLiveSessionRecordingPageUrl(params: URLSearchParams): { valid: boolean; sessionId: string; identity: string } {
  const sessionId = params.get('sessionId') || ''
  const identity = params.get('identity') || ''
  const exp = params.get('exp') || ''
  const sig = params.get('sig') || ''

  if (!sessionId || !identity || !exp || !sig) return { valid: false, sessionId, identity }
  if (Date.now() > parseInt(exp, 10)) return { valid: false, sessionId, identity }

  const payload = `lsrecpage.${sessionId}.${identity}.${exp}`
  const expected = hmac(payload)
  return { valid: timingSafeEqual(sig, expected), sessionId, identity }
}
// ══════════════════════════════════════════════════════════════════
// PDF VIEW URL
// ══════════════════════════════════════════════════════════════════

export function signPdfUrl(lessonId: string, identity: string, ttl = TTL.PDF): string {
  const exp = Date.now() + ttl
  const payload = `pdf.${lessonId}.${identity}.${exp}`
  const sig = hmac(payload)
  const p = new URLSearchParams({ lessonId, identity, exp: String(exp), sig, t: 'p' })
  return `${BASE}/api/pdf/view?${p}`
}

export function verifyPdfUrl(params: URLSearchParams): { valid: boolean; lessonId: string; identity: string } {
  const lessonId = params.get('lessonId') || ''
  const identity = params.get('identity') || ''
  const exp = params.get('exp') || ''
  const sig = params.get('sig') || ''

  if (!lessonId || !identity || !exp || !sig) return { valid: false, lessonId, identity }
  if (Date.now() > parseInt(exp, 10)) return { valid: false, lessonId, identity }

  const payload = `pdf.${lessonId}.${identity}.${exp}`
  const expected = hmac(payload)
  return { valid: timingSafeEqual(sig, expected), lessonId, identity }
}

// ══════════════════════════════════════════════════════════════════
// LESSON PAGE URL (opened from Telegram bot)
// ══════════════════════════════════════════════════════════════════

export function signLessonPageUrl(
  courseId: string,
  lessonId: string,
  lessonNum: number,
  identity: string,   // chatId (Telegram) or userId (web)
  ttl = TTL.LESSON
): string {
  const exp = Date.now() + ttl
  const payload = `lesson.${courseId}.${lessonId}.${lessonNum}.${identity}.${exp}`
  const sig = hmac(payload)
  const p = new URLSearchParams({
    courseId, lessonId,
    lesson: String(lessonNum),
    identity, exp: String(exp), sig,
  })
  return `${BASE}/api/lesson/view?${p}`
}

export function verifyLessonPageUrl(params: URLSearchParams): {
  valid: boolean
  courseId: string
  lessonId: string
  lessonNum: number
  identity: string
} {
  const courseId = params.get('courseId') || ''
  const lessonId = params.get('lessonId') || ''
  const lessonNum = parseInt(params.get('lesson') || '0', 10)
  const identity = params.get('identity') || ''
  const exp = params.get('exp') || ''
  const sig = params.get('sig') || ''

  const fail = { valid: false, courseId, lessonId, lessonNum, identity }

  if (!courseId || !lessonId || !identity || !exp || !sig) return fail
  if (Date.now() > parseInt(exp, 10)) return fail

  const payload = `lesson.${courseId}.${lessonId}.${lessonNum}.${identity}.${exp}`
  const expected = hmac(payload)
  return { ...fail, valid: timingSafeEqual(sig, expected) }
}

// ══════════════════════════════════════════════════════════════════
// ZERO-WIDTH FINGERPRINT (invisible watermark in text)
// Encodes identity into invisible Unicode chars that survive copy-paste.
// ══════════════════════════════════════════════════════════════════

export function signLessonResourceUrl(
  lessonId: string,
  type: 'summary' | 'notes' | 'quiz' | 'qa',
  identity: string,
  ttl = TTL.RESOURCE
): string {
  const exp = Date.now() + ttl
  const payload = `resource.${lessonId}.${type}.${identity}.${exp}`
  const sig = hmac(payload)
  const p = new URLSearchParams({ type, identity, exp: String(exp), sig })
  return `${BASE}/resource/${lessonId}?${p}`
}

export function verifyLessonResourceUrl(
  lessonId: string,
  params: URLSearchParams
): { valid: boolean; lessonId: string; type: 'summary' | 'notes' | 'quiz' | 'qa'; identity: string } {
  const rawType = params.get('type') || ''
  const type = (['summary', 'notes', 'quiz', 'qa'].includes(rawType) ? rawType : 'summary') as 'summary' | 'notes' | 'quiz' | 'qa'
  const identity = params.get('identity') || ''
  const exp = params.get('exp') || ''
  const sig = params.get('sig') || ''
  const fail = { valid: false, lessonId, type, identity }

  if (!lessonId || !identity || !exp || !sig) return fail
  if (Date.now() > parseInt(exp, 10)) return fail

  const payload = `resource.${lessonId}.${type}.${identity}.${exp}`
  const expected = hmac(payload)
  return { ...fail, valid: timingSafeEqual(sig, expected) }
}

// ══════════════════════════════════════════════════════════════════
// MY COURSES PAGE URL (opened from WhatsApp — phone-only, no login)
// ══════════════════════════════════════════════════════════════════

export function signMyCoursesUrl(identity: string, ttl = TTL.RESOURCE): string {
  const exp = Date.now() + ttl
  const payload = `mycourses.${identity}.${exp}`
  const sig = hmac(payload)
  const p = new URLSearchParams({ identity, exp: String(exp), sig })
  return `${BASE}/wa/my-courses?${p}`
}

export function verifyMyCoursesUrl(params: URLSearchParams): { valid: boolean; identity: string } {
  const identity = params.get('identity') || ''
  const exp = params.get('exp') || ''
  const sig = params.get('sig') || ''
  const fail = { valid: false, identity }

  if (!identity || !exp || !sig) return fail
  if (Date.now() > parseInt(exp, 10)) return fail

  const payload = `mycourses.${identity}.${exp}`
  const expected = hmac(payload)
  return { valid: timingSafeEqual(sig, expected), identity }
}

const ZWS  = '\u200B'   // zero-width space  = bit 0
const ZWNJ = '\u200C'   // zero-width non-joiner = bit 1

export function encodeFingerprint(text: string, maxChars = 12): string {
  let result = ''
  for (let i = 0; i < Math.min(text.length, maxChars); i++) {
    const code = text.charCodeAt(i)
    for (let bit = 7; bit >= 0; bit--) {
      result += (code >> bit) & 1 ? ZWNJ : ZWS
    }
  }
  return result
}

export function decodeFingerprint(text: string): string {
  const zwChars = text.split('').filter(c => c === ZWS || c === ZWNJ)
  let result = ''
  for (let i = 0; i < zwChars.length; i += 8) {
    let code = 0
    for (let bit = 0; bit < 8 && i + bit < zwChars.length; bit++) {
      if (zwChars[i + bit] === ZWNJ) code |= (1 << (7 - bit))
    }
    if (code > 0) result += String.fromCharCode(code)
  }
  return result
}