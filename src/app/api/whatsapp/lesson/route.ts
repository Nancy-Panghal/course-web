/**
 * app/api/whatsapp/lesson/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Entry point for WhatsApp lesson links.
 * WhatsApp bot sends:  https://yourapp.com/api/whatsapp/lesson?...signed params
 *
 * This route used to be a separate, stripped-down implementation with
 * no watermarking and no handling for quiz/assignment/live lessons —
 * it also exposed raw 2-hour Supabase storage URLs directly instead of
 * routing through the protected /api/video/stream and /api/pdf/view
 * proxies. It now mirrors /api/lesson/view (Telegram's route) almost
 * exactly, sharing the same renderer in src/lib/lessonPageHtml.ts.
 *
 * The only real differences from the Telegram route:
 *  - HMAC secret priority: WHATSAPP_LINK_SECRET first (must still match
 *    whatever the WhatsApp bot signs with).
 *  - Enrollment lookup is by `phone`, not `telegram_chat_id`.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { signVideoUrl, signPdfUrl, encodeFingerprint, signLessonResourceUrl } from '@/lib/signer'
import { renderLessonPage } from '@/lib/lessonPageHtml'
import { normalizePhone } from '@/lib/phone'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''

function safeCompare(a: string, b: string) {
  try {
    return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

async function logAccess(lessonId: string, courseId: string, identity: string) {
  try {
    await supabase.from('lesson_access_logs').insert({
      chat_id: identity,
      lesson_id: lessonId,
      course_id: courseId,
      accessed_at: new Date().toISOString(),
    })
  } catch {
    // non-critical
  }
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const courseId = params.get('courseId') || ''
  const lessonId = params.get('lessonId') || ''
  const lessonNum = Number(params.get('lesson') || 0)
  const identity = params.get('identity') || ''
  const expParam = params.get('exp') || ''
  const sig = params.get('sig') || ''

  if (!courseId || !lessonId || !lessonNum || !identity || !expParam || !sig) {
    return new NextResponse(invalidLinkHtml(), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (Date.now() > parseInt(expParam, 10)) {
    return new NextResponse(expiredHtml(), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // ── Verify HMAC — must match Whatsapp-bot/lessonSender.js signLessonPageUrl ──
  const secret = process.env.WHATSAPP_LINK_SECRET || process.env.LESSON_LINK_SECRET || process.env.TELEGRAM_LINK_SECRET
  if (!secret) {
    console.error('[whatsapp/lesson] no WHATSAPP_LINK_SECRET / LESSON_LINK_SECRET / TELEGRAM_LINK_SECRET configured')
    return new NextResponse(invalidLinkHtml(), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const payload = `lesson.${courseId}.${lessonId}.${lessonNum}.${identity}.${expParam}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  if (!safeCompare(expected, sig)) {
    console.error('[whatsapp/lesson] bad sig | lesson:', lessonNum, '| identity:', identity)
    return new NextResponse(invalidLinkHtml(), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const { data: lesson } = await supabase
    .from('lessons')
    .select(`
      id, title, content_type, order_num, duration, is_published, course_id,
      summary_url, notes_url, quiz_questions,
      assignment_prompt, assignment_required, assignment_file_url, assignment_file_name,
      content_url
    `)
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single()

  if (!lesson || !lesson.is_published) {
    return new NextResponse(notFoundHtml(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, name')
    .eq('id', courseId)
    .single()

  // Enrollment lookup by phone — `identity` here is the student's WhatsApp
  // phone number (see Whatsapp-bot/lessonSender.js), not a chat ID.
  //
  // Normalized separately from `identity` itself: the bot signs the link
  // using whatever raw format it has on hand (e.g. "+919306385029"), and
  // that exact string must stay untouched for everything tied to the
  // signature (already verified above) and the signed video/pdf/resource
  // URLs below. The `enrollments.phone` column, however, is stored
  // normalized (digits only, no "+") — see src/lib/phone.ts — so the
  // lookup itself needs the normalized form or it silently misses an
  // existing enrollment row whenever the formats don't match exactly.
  const lookupPhone = normalizePhone(identity) || identity

  let studentName = `User ${identity.slice(-4)}`
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('phone, payment_status, completed_lessons, quiz_results')
    .eq('phone', lookupPhone)
    .eq('course_uuid', courseId)
    .limit(1)
    .single()

  if (enrollment?.phone) studentName = enrollment.phone

  logAccess(lessonId, courseId, identity)

  // Same protected proxies Telegram uses — never expose raw storage URLs.
  const contentUrl =
    lesson.content_type === 'video' ? signVideoUrl(lessonId, identity) :
    lesson.content_type === 'pdf' ? signPdfUrl(lessonId, identity) :
    null

  const fingerprint = encodeFingerprint(identity)

  const summaryUrl = lesson.summary_url ? signLessonResourceUrl(lesson.id, 'summary', identity) : null
  const notesUrl = lesson.notes_url ? signLessonResourceUrl(lesson.id, 'notes', identity) : null
  const quizUrl = (Array.isArray(lesson.quiz_questions) && lesson.quiz_questions.length > 0)
    ? signLessonResourceUrl(lesson.id, 'quiz', identity)
    : null

  const quizResult = Array.isArray(enrollment?.quiz_results)
    ? enrollment.quiz_results.find((r: any) => r.lessonId === lesson.id)
    : null

  const isCompleted = Array.isArray(enrollment?.completed_lessons) && enrollment.completed_lessons.includes(lesson.order_num)

  const html = renderLessonPage({
    platform: 'whatsapp',
    lesson,
    course: course ? { id: course.id, name: course.name } : null,
    studentName,
    identity,
    contentUrl,
    fingerprint,
    summaryUrl,
    notesUrl,
    quizUrl,
    quizResult: quizResult || null,
    isCompleted,
    ctaUrl: WA_NUMBER ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('done:' + lessonNum)}` : null,
    ctaLabel: 'Continue on WhatsApp',
    ctaColor: '#25D366',
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, private',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

function expiredHtml() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link Expired</title>
  <style>body{background:#080808;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px}</style></head>
  <body><div><div style="font-size:48px;margin-bottom:16px">⏱</div><h2 style="margin-bottom:12px">Link Expired</h2>
  <p style="color:#71717a;margin-bottom:24px">This lesson link has expired. Go back to WhatsApp and send "lesson" to get a fresh link.</p>
  </div></body></html>`
}

function invalidLinkHtml() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link Not Valid</title>
  <style>body{background:#080808;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px}</style></head>
  <body><div><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="margin-bottom:12px">Link Not Valid</h2>
  <p style="color:#71717a;margin-bottom:24px">This lesson link could not be verified. Go back to WhatsApp and request a fresh link. If this keeps happening, please let your instructor know — there may be a configuration issue.</p>
  </div></body></html>`
}

function notFoundHtml() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not Found</title>
  <style>body{background:#080808;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px}</style></head>
  <body><div><div style="font-size:48px;margin-bottom:16px">🔍</div><h2 style="margin-bottom:12px">Lesson Not Found</h2>
  <p style="color:#71717a">This lesson may not be published yet. Contact your instructor.</p>
  </div></body></html>`
}