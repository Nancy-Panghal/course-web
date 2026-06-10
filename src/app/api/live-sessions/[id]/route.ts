/**
 * src/app/api/live-sessions/[id]/route.ts
 * ─────────────────────────────────────────────────────────────────
 * PATCH  — update a live session (add recording URL, edit details)
 * DELETE — delete a live session
 * Both require the creator to own the session's course.
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

async function verifyOwnership(sessionId: string, creatorId: string) {
  const { data } = await supabase
    .from('live_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('creator_id', creatorId)
    .maybeSingle()
  return !!data
}

// ── PATCH — update session ────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const creator = await getCreator(req)
    if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const owned = await verifyOwnership(id, creator.id)
    if (!owned) return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 })

    const body = await req.json()
    const allowed = ['title', 'description', 'scheduled_at', 'duration_minutes', 'join_url', 'recording_url']
    const updates: Record<string, any> = {}

    for (const key of allowed) {
      // Map camelCase from client to snake_case for DB
      const camelMap: Record<string, string> = {
        scheduledAt: 'scheduled_at',
        durationMinutes: 'duration_minutes',
        joinUrl: 'join_url',
        recordingUrl: 'recording_url',
      }
      // Accept both camelCase and snake_case
      const snakeKey = camelMap[key] || key
      const camelKey = Object.keys(camelMap).find(k => camelMap[k] === key)
      const value = body[key] ?? (camelKey ? body[camelKey] : undefined)
      if (value !== undefined) {
        updates[key] = typeof value === 'string' ? value.trim() || null : value
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('live_sessions')
      .update(updates)
      .eq('id', id)
      .select('id, title, scheduled_at, duration_minutes, join_url, recording_url')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, session: data })
  } catch (err: any) {
    console.error('[live-sessions PATCH]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── DELETE — remove session ───────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const creator = await getCreator(req)
    if (!creator) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const owned = await verifyOwnership(id, creator.id)
    if (!owned) return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 })

    const { error } = await supabase
      .from('live_sessions')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[live-sessions DELETE]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
