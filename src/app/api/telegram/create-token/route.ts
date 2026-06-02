/**
 * src/app/api/telegram/create-token/route.ts
 *
 * Production-safe rewrite.
 *
 * Changes from original:
 *  1. Uses the upsert_telegram_token Postgres function (atomic,
 *     race-condition-safe) instead of a JS-level SELECT then INSERT.
 *  2. Dedup is keyed by student_id (not broken empty-email logic).
 *  3. Never stores empty strings — NULLs are used for missing values.
 *  4. Returns the token and its expiry so callers can persist it.
 *  5. Validates required fields strictly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      studentId,      // auth.users UUID (Supabase auth id)
      studentEmail,
      studentName,
      studentPhone,
      creatorId,
      courseId,
      paymentId,      // null for free/demo tokens, payment id for paid
    } = body

    // courseId and creatorId are always required
    if (!courseId || !creatorId) {
      return NextResponse.json(
        { error: 'courseId and creatorId are required' },
        { status: 400 }
      )
    }

    // At least one student identifier must be present
    if (!studentId && !studentEmail && !studentPhone) {
      return NextResponse.json(
        { error: 'At least one student identifier (studentId, studentEmail, or studentPhone) is required' },
        { status: 400 }
      )
    }

    // Resolve the students.id (UUID in the students table) from auth id
    let studentRowId: string | null = null

    if (studentId) {
      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .eq('auth_id', studentId)
        .limit(1)
        .single()

      if (studentRow?.id) {
        studentRowId = studentRow.id
      }
    }

    // Fallback: find student by email
    if (!studentRowId && studentEmail) {
      const { data: studentRow } = await supabase
        .from('students')
        .select('id')
        .eq('email', studentEmail)
        .limit(1)
        .single()

      if (studentRow?.id) {
        studentRowId = studentRow.id
      }
    }

    // Call the atomic Postgres function — handles dedup + insert in one round-trip
    const { data, error } = await supabase.rpc('upsert_telegram_token', {
      p_student_id:      studentRowId   || null,
      p_student_auth_id: studentId      || null,
      p_student_email:   studentEmail   || null,
      p_student_name:    studentName    || null,
      p_student_phone:   studentPhone   || null,
      p_creator_id:      creatorId,
      p_course_id:       courseId,
      p_payment_id:      paymentId      || null,
    })

    if (error) {
      console.error('[telegram/create-token] rpc error:', error.message)
      return NextResponse.json({ error: 'Failed to create token' }, { status: 500 })
    }

    const token = data as string
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    return NextResponse.json({ token, expiresAt })
  } catch (err: any) {
    console.error('[telegram/create-token] error:', err.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}