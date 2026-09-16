/**
 * GET /api/creator/ratings
 * Lists every rating across the logged-in creator's courses, newest first,
 * for the Ratings & Reviews dashboard page.
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

export async function GET(req: NextRequest) {
  try {
    const creatorId = await getCreatorId(req)
    if (!creatorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: courses } = await supabase
      .from('courses')
      .select('id, name')
      .eq('creator_id', creatorId)

    const courseIds = (courses || []).map(c => c.id)
    if (courseIds.length === 0) return NextResponse.json({ ratings: [] })

    const { data: ratings, error } = await supabase
      .from('course_ratings')
      .select('id, course_id, enrollment_id, student_name, rating, review_text, creator_reply, creator_reply_at, flagged_for_review, created_at')
      .in('course_id', courseIds)
      .order('created_at', { ascending: false })

    if (error) throw error

    const courseNameById = new Map((courses || []).map(c => [c.id, c.name]))
    const enriched = (ratings || []).map(r => ({
      ...r,
      course_name: courseNameById.get(r.course_id) || 'Course',
    }))

    return NextResponse.json({ ratings: enriched })
  } catch (err: any) {
    console.error('[creator/ratings GET] error:', err.message)
    return NextResponse.json({ error: 'Failed to load ratings' }, { status: 500 })
  }
}