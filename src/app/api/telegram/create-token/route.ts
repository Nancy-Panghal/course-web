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
      studentId,
      studentEmail,
      studentName,
      studentPhone,
      creatorId,
      courseId,
      paymentId,
    } = await req.json()

    if (!courseId || !creatorId || (!studentEmail && !studentPhone)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: existingRows } = await supabase
      .from('telegram_tokens')
      .select('token')
      .eq('course_id', courseId)
      .eq('student_email', studentEmail || '')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1)

    if (existingRows?.[0]?.token) {
      return NextResponse.json({ token: existingRows[0].token })
    }

    const token = crypto.randomBytes(24).toString('hex')
    const { error } = await supabase.from('telegram_tokens').insert({
      token,
      student_auth_id: studentId || null,
      student_email: studentEmail || null,
      student_name: studentName || null,
      student_phone: studentPhone || null,
      creator_id: creatorId,
      course_id: courseId,
      payment_id: paymentId || null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })

    if (error) throw error

    return NextResponse.json({ token })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
