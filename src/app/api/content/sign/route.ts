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