/**
 * src/app/api/broadcast/route.ts
 * ─────────────────────────────────────────────────────────────────
 * POST  — send a broadcast message to all enrolled students of a course
 * GET   — fetch broadcast history for the authenticated creator
 *
 * Messages are sent directly via Telegram Bot API at max 20/sec.
 * Students with no telegram_chat_id are counted as undelivered (logged, not fatal).
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const RATE_LIMIT_MS = 50 // 20 messages/sec = 1 every 50ms

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Resolve the authenticated creator from the Bearer token */
async function getCreator(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// ── POST /api/broadcast ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const creator = await getCreator(req)
    if (!creator) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { courseId, message, targetEnrollmentId } = body as {
      courseId?: string
      message?: string
      targetEnrollmentId?: string
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    if (message.trim().length > 500) {
      return NextResponse.json({ error: 'Message must be 500 characters or less' }, { status: 400 })
    }

    // ── Verify course ownership if a courseId was provided ────────
    if (courseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .eq('creator_id', creator.id)
        .maybeSingle()

      if (!course) {
        return NextResponse.json({ error: 'Course not found or access denied' }, { status: 403 })
      }
    }

    // ── Single-student nudge (from analytics page) ────────────────
    if (targetEnrollmentId) {
      // Verify this enrollment belongs to a course owned by the creator
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id, telegram_chat_id, creator_id')
        .eq('id', targetEnrollmentId)
        .eq('creator_id', creator.id)
        .maybeSingle()

      if (!enrollment?.telegram_chat_id) {
        return NextResponse.json({ error: 'Student has no Telegram connected' }, { status: 400 })
      }

      try {
        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: enrollment.telegram_chat_id,
            text: message.trim(),
            protect_content: true,
            parse_mode: 'HTML',
          }),
        })
        const delivered = res.ok ? 1 : 0
        return NextResponse.json({ ok: true, delivered, failed: res.ok ? 0 : 1, noTelegram: 0 })
      } catch {
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
      }
    }

    // ── Fetch enrollments with telegram_chat_id ───────────────────
    let enrollQuery = supabase
      .from('enrollments')
      .select('id, telegram_chat_id, phone')
      .eq('creator_id', creator.id)
      .eq('payment_status', 'paid')
      .not('telegram_chat_id', 'is', null)

    if (courseId) {
      enrollQuery = enrollQuery.eq('course_uuid', courseId)
    }

    const { data: enrollments, error: enrollErr } = await enrollQuery

    if (enrollErr) throw enrollErr

    const targets = (enrollments || []).filter(
      e => e.telegram_chat_id && String(e.telegram_chat_id).trim() !== ''
    )

    // Count students who have no telegram_chat_id (undeliverable)
    let totalQuery = supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creator.id)
      .eq('payment_status', 'paid')

    if (courseId) {
      totalQuery = totalQuery.eq('course_uuid', courseId)
    }

    const { count: totalStudents } = await totalQuery

    // ── Insert broadcast record (pending) ─────────────────────────
    const { data: broadcast, error: insertErr } = await supabase
      .from('broadcasts')
      .insert({
        creator_id: creator.id,
        course_id: courseId || null,
        message: message.trim(),
        student_count: totalStudents || 0,
        status: 'sending',
      })
      .select('id')
      .single()

    if (insertErr || !broadcast) throw insertErr || new Error('Failed to create broadcast record')

    const broadcastId = broadcast.id

    // ── Send messages with rate limiting ──────────────────────────
    let delivered = 0
    let failed = 0

    for (let i = 0; i < targets.length; i++) {
      const chatId = targets[i].telegram_chat_id

      try {
        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message.trim(),
            protect_content: true,   // students cannot forward it
            parse_mode: 'HTML',
          }),
        })

        if (res.ok) {
          delivered++
        } else {
          const errBody = await res.json().catch(() => ({}))
          // 403 = bot was blocked by user — expected, non-fatal
          console.warn(`[broadcast] Failed to send to ${chatId}:`, errBody?.description || res.status)
          failed++
        }
      } catch (sendErr: any) {
        console.warn(`[broadcast] Network error sending to ${chatId}:`, sendErr.message)
        failed++
      }

      // Rate limit: 20 messages/sec
      if (i < targets.length - 1) {
        await sleep(RATE_LIMIT_MS)
      }
    }

    // ── Update broadcast record with final counts ─────────────────
    await supabase
      .from('broadcasts')
      .update({
        delivered_count: delivered,
        failed_count: failed,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', broadcastId)

    return NextResponse.json({
      ok: true,
      broadcastId,
      totalStudents: totalStudents || 0,
      delivered,
      failed,
      noTelegram: (totalStudents || 0) - targets.length,
    })
  } catch (err: any) {
    console.error('[broadcast POST]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── GET /api/broadcast ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const creator = await getCreator(req)
    if (!creator) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const courseId = url.searchParams.get('courseId')
    const limit = Math.min(Number(url.searchParams.get('limit') || '20'), 50)

    let query = supabase
      .from('broadcasts')
      .select('id, course_id, message, sent_at, student_count, delivered_count, failed_count, status')
      .eq('creator_id', creator.id)
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (courseId) {
      query = query.eq('course_id', courseId)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ broadcasts: data || [] })
  } catch (err: any) {
    console.error('[broadcast GET]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
