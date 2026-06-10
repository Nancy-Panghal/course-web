/**
 * src/app/api/broadcast/preview/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET — returns the count of students who will receive a broadcast
 *       for a given courseId (or all courses if omitted).
 *       Used by the broadcast UI to show "X students will receive this"
 *       before the creator hits Send.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const creatorId = data.user.id
    const url = new URL(req.url)
    const courseId = url.searchParams.get('courseId')

    // Total paid enrollments
    let totalQ = supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('payment_status', 'paid')

    // With telegram only
    let telegramQ = supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('payment_status', 'paid')
      .not('telegram_chat_id', 'is', null)

    if (courseId) {
      totalQ = totalQ.eq('course_uuid', courseId)
      telegramQ = telegramQ.eq('course_uuid', courseId)
    }

    const [{ count: total }, { count: withTelegram }] = await Promise.all([totalQ, telegramQ])

    return NextResponse.json({
      total: total || 0,
      withTelegram: withTelegram || 0,
      noTelegram: (total || 0) - (withTelegram || 0),
    })
  } catch (err: any) {
    console.error('[broadcast/preview]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
