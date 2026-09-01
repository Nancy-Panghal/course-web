/**
 * app/api/upload/r2-sign/route.ts
 * ─────────────────────────────────────────────────────────────────
 * Issues a short-lived presigned R2 upload URL for a creator's own
 * lesson video / live-recording upload. The browser then PUTs the
 * file directly to that URL — this route never sees the file bytes,
 * only hands out permission to upload one specific object.
 *
 * Unlike the old (deleted) /api/upload route, this REQUIRES a valid
 * creator session and verifies course ownership before issuing a URL.
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedCreator } from '@/app/api/razorpay/subscription-auth'
import { getR2UploadUrl } from '@/lib/r2'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Only video-type content goes to R2. Anything else (pdfs, images,
// assignments, etc.) stays on Supabase and doesn't use this route.
const ALLOWED_FOLDERS = ['videos', 'live-recordings', 'live-session-recordings']

export async function POST(req: NextRequest) {
  try {
    const { creator, error: authError } = await getAuthenticatedCreator(req)
    if (authError || !creator) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    const { fileName, contentType, folder, courseId } = await req.json()

    if (!fileName || !contentType || !folder || !courseId) {
      return NextResponse.json(
        { error: 'fileName, contentType, folder and courseId are required' },
        { status: 400 }
      )
    }

    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
    }

    // Verify this creator actually owns the course they're uploading into —
    // without this, any logged-in creator could upload into any course.
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('creator_id', creator.id)
      .single()

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const ext = (fileName.split('.').pop() || 'bin').toLowerCase()
    const key = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`

    const uploadUrl = await getR2UploadUrl(key, contentType)
    if (!uploadUrl) {
      return NextResponse.json({ error: 'Could not generate upload URL' }, { status: 502 })
    }

    return NextResponse.json({ uploadUrl, key })
  } catch (err: any) {
    console.error('[upload/r2-sign]', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}