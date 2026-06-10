/**
 * src/app/api/live-sessions/route.ts
 * ─────────────────────────────────────────────────────────────────
 * GET  — fetch live sessions for a course (public, no auth needed)
 * POST — create a new live session (creator only)
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCreator(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// ── GET — public, used by about-course and course manage page ─────
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const courseId = url.searchParams.get('courseId')
    if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

    const { data, error } = await supabase
      .from('live_sessions')
      .select('id, title, description, scheduled_at, duration_minutes, join_url, recording_url')
      .eq('course_id', courseId)
      .order('scheduled_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ sessions: data || [] })
  } catch (err: any) {
    console.error('[live-sessions GET]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── POST — create live session ────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const creator = await getCreator(req)
    if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { courseId, title, description, scheduledAt, durationMinutes, joinUrl } = body

    if (!courseId || !title?.trim() || !scheduledAt || !joinUrl?.trim()) {
      return NextResponse.json(
        { error: 'courseId, title, scheduledAt and joinUrl are required' },
        { status: 400 }
      )
    }

    // Verify creator owns this course
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('creator_id', creator.id)
      .maybeSingle()

    if (!course) return NextResponse.json({ error: 'Course not found or access denied' }, { status: 403 })

    const { data, error } = await supabase
      .from('live_sessions')
      .insert({
        course_id: courseId,
        creator_id: creator.id,
        title: title.trim(),
        description: description?.trim() || null,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes || 60,
        join_url: joinUrl.trim(),
      })
      .select('id, title, scheduled_at, duration_minutes, join_url')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, session: data })
  } catch (err: any) {
    console.error('[live-sessions POST]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
