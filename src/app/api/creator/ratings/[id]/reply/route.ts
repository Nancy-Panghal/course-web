/**
 * POST /api/creator/ratings/[id]/reply
 * Saves a creator's public reply to a single rating. Body: { replyText }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCreatorId(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creatorId = await getCreatorId(req)
    if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const replyText = String(body.replyText || '').trim()
    if (!replyText) return NextResponse.json({ error: 'Reply cannot be empty' }, { status: 400 })

    const { data: rating } = await supabase
      .from('course_ratings')
      .select('id, course_id')
      .eq('id', id)
      .maybeSingle()
    if (!rating) return NextResponse.json({ error: 'Rating not found' }, { status: 404 })

    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', rating.course_id)
      .eq('creator_id', creatorId)
      .maybeSingle()
    if (!course) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const { error } = await supabase
      .from('course_ratings')
      .update({ creator_reply: replyText.slice(0, 1000), creator_reply_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[creator/ratings/reply] error:', err.message)
    return NextResponse.json({ error: 'Failed to save reply' }, { status: 500 })
  }
}