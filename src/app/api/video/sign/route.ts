/**
 * app/api/video/sign/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Generates signed video stream URLs for authenticated users.
 * Called by the lesson page after the user authenticates.
 * Returns: signed /api/video/stream URL (valid for 2 hours)
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { signVideoUrl } from '@/lib/signer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { lessonId } = await req.json()

    if (!lessonId) {
      return NextResponse.json(
        { error: 'Missing lessonId' },
        { status: 400 }
      )
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Verify lesson exists and is published
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, course_id, order_num, content_type, is_published')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { error: 'Lesson not found' },
        { status: 404 }
      )
    }

    if (!lesson.is_published || lesson.content_type !== 'video') {
      return NextResponse.json(
        { error: 'Lesson not available' },
        { status: 403 }
      )
    }

    // Check enrollment OR if it's lesson 1 (free preview)
    const isFirstLesson = lesson.order_num === 1

    if (!isFirstLesson) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('payment_status, completed_lessons')
        .eq('user_id', user.id)
        .eq('course_uuid', lesson.course_id)
        .single()

      if (!enrollment || enrollment.payment_status !== 'paid') {
        return NextResponse.json(
          { error: 'Not enrolled in this course' },
          { status: 403 }
        )
      }
    }

    // Generate signed URL
    // Use 'web' as identity for website access
    const signedUrl = signVideoUrl(lessonId, 'web')

    return NextResponse.json({ signedUrl })
  } catch (error) {
    console.error('[/api/video/sign]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
