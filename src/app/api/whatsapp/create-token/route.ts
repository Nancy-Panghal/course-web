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
      studentId,      // Supabase auth UUID
      studentEmail,
      studentName,
      studentPhone,
      creatorId,
      courseId,       // Course UUID
      paymentId,
    } = await req.json()

    if (!courseId || !creatorId || (!studentEmail && !studentPhone && !studentId)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // ── Dedup: re-use valid unused token for this student+course ──────────────

    // 1. By auth UUID (most reliable)
    if (studentId) {
      const { data: byId } = await supabase
        .from('whatsapp_tokens')
        .select('token, expires_at')
        .eq('course_slug', courseId)           // We store UUID in course_slug column
        .eq('student_auth_id', studentId)
        .eq('used', false)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)

      if (byId?.[0]?.token) {
        return NextResponse.json({ token: byId[0].token, expiresAt: byId[0].expires_at })
      }
    }

    // 2. By email
    const email = studentEmail?.trim() || null
    if (email) {
      const { data: byEmail } = await supabase
        .from('whatsapp_tokens')
        .select('token, expires_at')
        .eq('course_slug', courseId)
        .eq('student_email', email)
        .eq('used', false)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)

      if (byEmail?.[0]?.token) {
        return NextResponse.json({ token: byEmail[0].token, expiresAt: byEmail[0].expires_at })
      }
    }

    // 3. By phone
    const phone = normalizePhone(studentPhone)
    if (phone) {
      const { data: byPhone } = await supabase
        .from('whatsapp_tokens')
        .select('token, expires_at')
        .eq('course_slug', courseId)
        .eq('student_phone', phone)
        .eq('used', false)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)

      if (byPhone?.[0]?.token) {
        return NextResponse.json({ token: byPhone[0].token, expiresAt: byPhone[0].expires_at })
      }
    }

    // ── Create new token ──────────────────────────────────────────────────────
    const token = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase.from('whatsapp_tokens').insert({
      token,
      student_auth_id: studentId || null,
      student_phone: phone || null,
      student_email: email || null,
      student_name: studentName || null,
      creator_id: creatorId,
      course_slug: courseId,    // Always store UUID here; bot handles UUID format
      payment_id: paymentId || null,
      expires_at: expiresAt,
      used: false,
    })

    if (error) throw error

    return NextResponse.json({ token, expiresAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}