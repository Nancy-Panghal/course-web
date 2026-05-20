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

const BASE = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

if (!SECRET && process.env.NODE_ENV === 'production') {
  console.error('[signer] LESSON_LINK_SECRET is not set — all signed URLs will fail verification')
}

// ── TTLs ───────────────────────────────────────────────────────────
export const TTL = {
  VIDEO: 2 * 60 * 60 * 1000,      // 2 hours  — video stream
  PDF:   1 * 60 * 60 * 1000,      // 1 hour   — PDF view
  LESSON: 2 * 60 * 60 * 1000,     // 2 hours  — lesson page (from Telegram)
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