/**
 * src/app/api/content/sign/route.ts
 * Fixed: BUG 7 — web access was not logged to lesson_access_logs
 * Fixed: auth token properly extracted from header
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { signVideoUrl, signPdfUrl } from '@/lib/signer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { lessonId, type } = await req.json()

    if (!lessonId || !type) {
      return NextResponse.json({ error: 'lessonId and type required' }, { status: 400 })
    }

    // Get user from Authorization header
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    let userId = 'web'
    let webUserId: string | null = null

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        userId = user.id
        webUserId = user.id
      }
    }

    // Verify lesson exists and is published
    const { data: lesson } = await supabase
      .from('lessons')
      .select('id, is_published, content_type, course_id, order_num')
      .eq('id', lessonId)
      .single()

    if (!lesson || !lesson.is_published) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // ── NEW: verify enrollment once here, then return direct signed URL ──
    const { data: course } = await supabase
      .from('courses')
      .select('free_preview_config')
      .eq('id', lesson.course_id)
      .single()

    const config = course?.free_preview_config || 'nothing free'
    const maxFree: Record<string, number> = {
      'lesson 1 free': 1, '2 lessons free': 2, '3 lessons free': 3,
      'module 1 free': 3, '2 modules free': 6,
    }
    const isFree = config === 'completely free' || lesson.order_num <= (maxFree[config] ?? 0)

    if (!isFree && userId === 'web') {
      return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
    }

    if (!isFree && userId !== 'web') {
      // Single query — check enrollment by student auth_id join
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('auth_id', userId)
        .limit(1)
        .single()

      const { data: enrollment } = student?.id ? await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', student.id)
        .eq('course_uuid', lesson.course_id)
        .eq('payment_status', 'paid')
        .limit(1)
        .single() : { data: null }

      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
      }
    }

    // ── NEW: for video, return a direct Supabase signed URL (no proxy) ──
    if (type === 'video') {
      const { data: lessonContent } = await supabase
        .from('lessons')
        .select('video_storage_path, content_url')
        .eq('id', lessonId)
        .single()

      const storagePath = lessonContent?.video_storage_path
      if (storagePath && !storagePath.startsWith('http')) {
        const { data: signed } = await supabase.storage
          .from('lessons')
          .createSignedUrl(storagePath, 60 * 60) // 1 hour — given directly to browser
        if (signed?.signedUrl) {
          // Log then return
          void supabase.from('lesson_access_logs').insert({
            lesson_id: lessonId,
            course_id: lesson.course_id,
            web_user_id: webUserId,
            source: 'web',
            accessed_at: new Date().toISOString(),
          }).then(() => {}, () => {})
          return NextResponse.json({ url: signed.signedUrl })
        }
      }
    }
    

    // Log access for piracy detection (web path)
    // Fire and forget — never block content delivery for logging
    void supabase.from('lesson_access_logs').insert({
      lesson_id: lessonId,
      course_id: lesson.course_id,
      web_user_id: webUserId,
      source: 'web',
      accessed_at: new Date().toISOString(),
    }).then(() => {}, () => {})

    // Generate signed URL
    const url = type === 'pdf'
      ? signPdfUrl(lessonId, userId)
      : signVideoUrl(lessonId, userId)

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error('[content/sign]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}