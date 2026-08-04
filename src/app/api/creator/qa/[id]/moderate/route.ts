/**
 * src/app/api/creator/qa/[id]/moderate/route.ts
 * POST { action: 'approve' | 'reject' | 'remove' }
 *  - approve: pending_review -> visible
 *  - reject:  pending_review -> rejected (soft — row stays, for audit trail)
 *  - remove:  visible -> removed_by_creator (creator taking down an
 *             already-visible comment after the fact)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, resolveCreatorId } from '@/lib/qaIdentity'

const STATUS_BY_ACTION: Record<string, string> = {
  approve: 'visible',
  reject: 'rejected',
  remove: 'removed_by_creator',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { action } = await req.json()
    const newStatus = STATUS_BY_ACTION[action]
    if (!newStatus) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    const creatorId = await resolveCreatorId(req)
    if (!creatorId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

    const { data: comment } = await supabaseAdmin
      .from('lesson_comments')
      .select('id, course_id')
      .eq('id', id)
      .single()

    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('creator_id')
      .eq('id', comment.course_id)
      .single()

    if (course?.creator_id !== creatorId) {
      return NextResponse.json({ error: 'Not authorized for this course' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('lesson_comments')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, status: newStatus })
  } catch (err: any) {
    console.error('[creator/qa/moderate]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}