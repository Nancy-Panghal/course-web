import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const {
      studentPhone,
      studentEmail,
      studentName,
      creatorId,
      courseSlug,
      paymentId,
    } = await req.json()

    if (!studentPhone || !courseSlug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if unused token already exists for this student+course
    const { data: existingRows } = await supabase
      .from('whatsapp_tokens')
      .select('token')
      .eq('student_phone', studentPhone)
      .eq('course_slug', courseSlug)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
    const existing = existingRows?.[0]

    // Reuse existing token if valid
    if (existing) {
      return NextResponse.json({ token: existing.token })
    }

    // Generate new secure token
    const token = crypto.randomBytes(32).toString('hex')

    const { error } = await supabase.from('whatsapp_tokens').insert({
      token,
      student_phone: studentPhone,
      student_email: studentEmail,
      student_name: studentName,
      creator_id: creatorId,
      course_slug: courseSlug,
      payment_id: paymentId,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })

    if (error) throw error

    return NextResponse.json({ token })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
