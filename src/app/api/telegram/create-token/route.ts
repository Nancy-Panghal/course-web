import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { normalizePhone } from '@/lib/phone'

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

    const now = new Date().toISOString()

    // Dedup by student_auth_id first — most reliable, no false-match risk
    if (studentId) {
      const { data: byId } = await supabase
        .from('telegram_tokens')
        .select('token')
        .eq('course_id', courseId)
        .eq('student_auth_id', studentId)
        .eq('used', false)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)

      if (byId?.[0]?.token) {
        return NextResponse.json({ token: byId[0].token })
      }
    }

    // Dedup by email — only if email is a non-empty string (prevents cross-student collisions)
    const email = studentEmail?.trim() || null
    if (email) {
      const { data: byEmail } = await supabase
        .from('telegram_tokens')
        .select('token')
        .eq('course_id', courseId)
        .eq('student_email', email)
        .eq('used', false)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)

      if (byEmail?.[0]?.token) {
        return NextResponse.json({ token: byEmail[0].token })
      }
    }

    const token = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // AFTER — never write empty string for student_email
const { error } = await supabase.from('telegram_tokens').insert({
  token,
  student_auth_id: studentId || null,
  student_email: email || null,          // 
  student_name: studentName || null,
  student_phone: normalizePhone(studentPhone) || null,
  creator_id: creatorId,
  course_id: courseId,
  payment_id: paymentId || null,
  expires_at: expiresAt,
})

    if (error) throw error

    return NextResponse.json({ token, expiresAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
